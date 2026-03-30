import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Wpp } from '../../lib/wpp';
import { Instance } from '../../entities/instance.entity';
import { EventsGateway } from '../../ws/events.gateway';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Contact } from '../../entities/contact.entity';
import { Conversation } from '../../entities/conversation.entity';
import { Message } from '../../entities/message.entity';
import fs from 'fs-extra';
import path from 'path';
import { uploadDirToS3 } from '../../lib/s3.client';
import * as wppconnect from '@wppconnect-team/wppconnect';
import { OnMessageUpsert, OnPresenceChanged } from '../../socket-events';
import _fs from 'fs';
import { ContactItem } from '../../interfaces';

const logger = new Logger('WppManager');

@Injectable()
export class WppManagerService {
  private instances: Map<string, any> = new Map();

  constructor(
    private readonly events: EventsGateway,
    @InjectRepository(Instance) private instanceRepo: Repository<Instance>,
    @InjectRepository(Contact) private contactRepo: Repository<Contact>,
    @InjectRepository(Conversation) private convRepo: Repository<Conversation>,
    @InjectRepository(Message) private msgRepo: Repository<Message>,
  ) {
    // register this instance manager globally for convenience
    // so other modules can call Wpp.getInstances()
    // Use setImmediate so registration happens after construction
    setImmediate(() => Wpp.registerManager(this));
  }

  async startInstance(instance: Instance) {
    const session = instance.wppconnect_session || instance.id;
    const baseDataDir = process.env.DATA_DIR || 'data';
    const sessionDir = path.resolve(process.cwd(), baseDataDir, session);
    const logs = new Logger('WhatsAppSession');
    logs.verbose &&
      logs.verbose(`[${instance.name}] using data basepath -> ${baseDataDir}`);
    const puppeteerDir = path.join(sessionDir, 'puppeteer');
    const tokensDir = path.resolve(process.cwd(), `data/wpp_data//tokens`);
    const uploadsDir = path.join(sessionDir, 'uploads');
    await fs.ensureDir(puppeteerDir);
    await fs.ensureDir(tokensDir);
    await fs.ensureDir(uploadsDir);

    // If session directory or tokens folder is missing/empty, force recreate clean session
    try {
      const sessionExists = await fs.pathExists(sessionDir);
      const tokensExist = await fs.pathExists(tokensDir);
      let tokensNonEmpty = false;
      if (tokensExist) {
        const tfiles = await fs.readdir(tokensDir).catch(() => []);
        tokensNonEmpty = tfiles && tfiles.length > 0;
      }

      if (!sessionExists || !tokensNonEmpty) {
        logs.verbose &&
          logs.verbose(
            `[${instance.name}] sessionDir missing or tokens empty — recreating session dir ${sessionDir}`,
          );
        try {
          if (await fs.pathExists(sessionDir)) {
            await fs.remove(sessionDir).catch(() => { });
          }
        } catch (e) {
          /* ignore */
        }
        await fs.ensureDir(puppeteerDir);
        await fs.ensureDir(tokensDir);
        await fs.ensureDir(uploadsDir);
      }
    } catch (e) {
      // non-fatal
      logs.warn &&
        logs.warn(
          `[${instance.name}] Failed checking/creating session dirs: ${String(e)}`,
        );
    }
    // Cria logger customizado para esta sessão (already declared above)
    // placeholder for status updater; will be assigned below
    let setInstanceStatus: (
      status:
        | 'connected'
        | 'initialized'
        | 'authenticated'
        | 'disconnected'
        | 'waiting'
        | 'initializing',
    ) => Promise<void> = async () => { };
    // Logger genérico: exibe message se existir, senão exibe valor como string, ignora se não houver mensagem
    // Also watch for library log messages like 'Authenticated'/'Connected'/'Disconnected'/'QR' to update DB
    const genericLogger: any = new Proxy(
      {},
      {
        get: (_, prop) => async (value: any) => {
          let msg = '';
          if (value && typeof value === 'object' && 'message' in value) {
            msg = value.message;
          } else if (typeof value === 'string') {
            msg = value;
          }
          if (msg) {
            logs.verbose(
              `[${instance.name}] [${String(prop).toUpperCase()}] ${msg}`,
            );
            try {
              const s = String(msg).toLowerCase();
              if (s.includes('authenticated') || s.includes('auth')) {
                setInstanceStatus('authenticated').catch(() => { });
                await this.dbUpdater(instance.name, 'authenticated');
              } else if (
                s.includes('disconnected') ||
                s.includes('logout') ||
                s.includes('session_unpaired')
              ) {
                setInstanceStatus('disconnected').catch(() => { });
                await this.dbUpdater(instance.name, 'disconnected');
              } else if (s.includes('qr')) {
                setInstanceStatus('waiting').catch(() => { });
                await this.dbUpdater(instance.name, 'waiting');
              } else if (s.includes('ready')) {
                setInstanceStatus('initialized').catch(() => { });
                await this.dbUpdater(instance.name, 'initialized');
              } else if (s.includes('timeout')) {
                setInstanceStatus('disconnected').catch(() => { });
                await this.dbUpdater(instance.name, 'disconnected');
              } else if (s.includes('initializing')) {
                setInstanceStatus('initializing').catch(() => { });
                await this.dbUpdater(instance.name, 'initializing');
              } else if (s.includes('MAIN (NORMAL)'.toLocaleLowerCase())) {
                setInstanceStatus('connected').catch(() => { });
                await this.dbUpdater(instance.name, 'connected');
              }
            } catch (e) { }
          }
        },
      },
    );

    const options: wppconnect.CreateOptions = {
      session: instance.name,
      deviceName: `WPP-${instance.name.toUpperCase()}`,
      puppeteerOptions: {
        headless: true,
        userDataDir: path.resolve(
          process.cwd(),
          `data/wpp_data/${instance.id}/puppeteer`,
        ),
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-zygote',
          '--single-process',
          '--disable-infobars',
          '--window-size=1280,800',
          '--mute-audio',
        ],
      },
      disableWelcome: true,
      autoClose: 0,
      waitForLogin: true,
      headless: true,
      useChrome: false,
      logger: genericLogger as any,
      logQR: true,
      folderNameToken: path.resolve(
        process.env.DATA_DIR || 'data',
        `data/wpp_data/${instance.id}/tokens`,
      ),
    };

    try {
      const lockFiles = [
        'SingletonLock',
        'SingletonSocket',
        'DevToolsActivePort',
        'SingletonCookie',
      ];
      for (const f of lockFiles) {
        const p = path.join(puppeteerDir, f);
        try {
          if (await fs.pathExists(p)) {
            await fs.remove(p);
            logs.verbose(`[${instance.name}] Removed lock file ${p}`);
          }
        } catch (e) {
          logs.warn(`[${instance.name}] Failed removing ${p}: ${String(e)}`);
        }
      }
    } catch (e) {
      logs.warn(`Failed cleaning puppeteer dir ${puppeteerDir}: ${String(e)}`);
    }

    // Ensure puppeteerDir permissions are user-writable so chrome can create files
    try {
      await fs.chmod(puppeteerDir, 0o700);
      await fs.chmod(tokensDir, 0o700);
      await fs.chmod(uploadsDir, 0o700);
    } catch (e) {
      // ignore permission errors
    }

    // diagnostic: log token/puppeteer dirs content before client creation
    try {
      const tlist = await fs.readdir(tokensDir).catch(() => []);
      logs.verbose(
        `[${instance.name}] tokensDir contents before create: ${JSON.stringify(tlist)}`,
      );
      const plist = await fs.readdir(puppeteerDir).catch(() => []);
      logs.verbose(
        `[${instance.name}] puppeteerDir contents before create: ${JSON.stringify(plist)}`,
      );
    } catch (e) {
      /* ignore */
    }

    fs.mkdirSync(`${process.env.DATA_DIR}/${instance.id}/logs`, {
      recursive: true,
    });
    logs.verbose(
      `[${instance.name}] Starting WhatsApp client with options: ${JSON.stringify(options)}`,
    );
    const client: wppconnect.Whatsapp = await wppconnect.create(options);
    // diagnostic: log token/puppeteer dirs content after client creation
    try {
      const tlist2 = await fs.readdir(tokensDir).catch(() => []);
      logs.verbose(
        `[${instance.name}] tokensDir contents after create: ${JSON.stringify(tlist2)}`,
      );
      const plist2 = await fs.readdir(puppeteerDir).catch(() => []);
      logs.verbose(
        `[${instance.name}] puppeteerDir contents after create: ${JSON.stringify(plist2)}`,
      );
    } catch (e) {
      /* ignore */
    }

    // helper to update instance status in DB and emit updates
    setInstanceStatus = async (
      status: 'connected' | 'disconnected' | 'waiting',
    ) => {
      try {
        logs.verbose(`[${instance.name}] setting status -> ${status}`);
        const inst = await this.instanceRepo.findOneBy({
          id: instance.id,
        } as any);
        if (inst) {
          (inst as any).status = status;
          const saved = await this.instanceRepo.save(inst as any);
          logs.verbose(`[${instance.name}] status saved -> ${status}`);
          try {
            const payload = JSON.stringify(saved);
            logs.verbose(
              `[${instance.name}] notifying Postgres with payload -> ${payload}`,
            );
            // notify Postgres listeners about the updated instance
            await (this.instanceRepo.manager as any).query(
              `SELECT pg_notify('instance_updated', $1)`,
              [payload],
            );
            logs.verbose(`[${instance.name}] pg_notify succeeded`);
          } catch (e) {
            logs.warn(
              `[${instance.name}] Failed to notify Postgres: ${String(e)} ${e?.stack || ''}`,
            );
          }
          try {
            this.events.emit('instance:updated', saved);
            this.events.emitTo(session, 'instance:updated', saved);
          } catch (e) {
            logs.warn(
              `[${instance.name}] Failed emitting socket events: ${String(e)} ${e?.stack || ''}`,
            );
          }
        }
      } catch (e) {
        logs.warn(
          `[${instance.name}] Failed updating status ${status}: ${String(e)} ${e?.stack || ''}`,
        );
      }
    };

    this.instances.set(session, client);

    // Helper to safely log
    const logEvent = (
      event: string,
      data:
        | string
        | wppconnect.Message
        | wppconnect.Ack
        | wppconnect.Wid
        | wppconnect.Chat
        | wppconnect.ParticipantEvent
        | wppconnect.IncomingCall
        | wppconnect.PresenceEvent
        | wppconnect.LiveLocation
        | any,
    ) => {
      console.log(`\n=== ${event} ===`);
      try {
        console.log(JSON.stringify(data, null, 2));
      } catch (e) {
        console.log(data);
      }
    };

    // 📩 Messages
    client.onMessage((msg) =>
      OnMessageUpsert(
        client,
        { id: instance.id, name: instance.name },
        this.contactRepo,
        this.convRepo,
        this.msgRepo,
        msg,
      ),
    );
    //client.onAnyMessage((msg) => OnMessageUpsert(client, msg));

    client.onAck((ack) => logEvent('onAck', ack));
    client.onMessageEdit((msg) => logEvent('onMessageEdit', msg));

    // 👥 Groups / Contacts
    client.onAddedToGroup((chat) => logEvent('onAddedToGroup', chat));
    client.onParticipantsChanged((event) =>
      logEvent('onParticipantsChanged', event),
    );

    // 📞 Calls
    client.onIncomingCall((call) => logEvent('onIncomingCall', call));

    // 🔄 Connection / State
    client.onStateChange((state) => { });

    // 📱 Presence / Location
    client.onPresenceChanged((presence) =>
      OnPresenceChanged(client, presence, this.contactRepo),
    );
    client.onLiveLocation((location) => logEvent('onLiveLocation', location));

    // 🧪 EXTRA (may not exist in all versions)
    if (client.onPollResponse) {
      client.onPollResponse((data) => logEvent('onPollResponse', data));
    }

    // persist session_dir
    instance.session_dir = sessionDir;
    await this.instanceRepo.save(instance);

    try {
      await uploadDirToS3(uploadsDir, `${session}/uploads/`);
    } catch (e) {
      logger.warn('S3 upload failed: ' + (e as any).toString());
    }

    this.events.emit('instance:started', {
      id: instance.id,
      session,
      sessionDir,
    });
    this.events.emitTo(session, 'instance:started', {
      id: instance.id,
      session,
      sessionDir,
    });

    // initial status emit: rely on lifecycle events to set real status
    // (avoid forcing 'disconnected' here which may overwrite a true connected state)
    return client;
  }

  async stopInstance(sessionOrId: string) {
    const client = this.instances.get(sessionOrId);
    if (client && client.close) {
      try {
        await client.close();
      } catch (e) { }
    }
    this.instances.delete(sessionOrId);
    try {
      const inst =
        (await this.instanceRepo.findOneBy({
          wppconnect_session: sessionOrId,
        } as any)) ||
        (await this.instanceRepo.findOneBy({ id: sessionOrId } as any));
      if (inst) {
        (inst as any).status = 'disconnected';
        const saved = await this.instanceRepo.save(inst as any);
        this.events.emit('instance:updated', saved);
        this.events.emitTo(sessionOrId, 'instance:updated', saved);
      }
    } catch (e) { }
    this.events.emit('instance:stopped', { session: sessionOrId });
    this.events.emitTo(sessionOrId, 'instance:stopped', {
      session: sessionOrId,
    });
  }

  async restartInstance(instance: Instance) {
    await this.stopInstance(instance.wppconnect_session || instance.id);
    return this.startInstance(instance);
  }

  getClient(sessionOrId: string) {
    return this.instances.get(sessionOrId);
  }

  // Ensure session directories exist for an instance (safe to call before start)
  async ensureSessionDirs(instance: Instance) {
    const session = instance.wppconnect_session || instance.id;
    const baseDataDir = process.env.DATA_DIR || 'data';
    const sessionDir = path.resolve(process.cwd(), baseDataDir, session);
    const puppeteerDir = path.join(sessionDir, 'puppeteer');
    const tokensDir = path.join(sessionDir, 'tokens');
    const uploadsDir = path.join(sessionDir, 'uploads');
    try {
      await fs.ensureDir(puppeteerDir);
      await fs.ensureDir(tokensDir);
      await fs.ensureDir(uploadsDir);
      return { sessionDir, puppeteerDir, tokensDir, uploadsDir };
    } catch (e) {
      // non-fatal
      logger.warn(`ensureSessionDirs failed for ${session}: ${String(e)}`);
      return { sessionDir, puppeteerDir, tokensDir, uploadsDir };
    }
  }

  async sendMessage(sessionOrId: string, to: string, body: string) {
    const client = this.getClient(sessionOrId);
    if (!client) throw new Error('Client not running for ' + sessionOrId);
    // try common wppconnect send methods
    if (client.sendText) return client.sendText(to, body);
    if (client.sendMessage) return client.sendMessage(to, { text: body });
    if (client.sendSimpleText) return client.sendSimpleText(to, body as any);
    throw new Error('No send method available on client');
  }

  // generic media/file sender: tcry multiple client methods for best-effort
  async sendMedia(
    sessionOrId: string,
    to: string,
    bufferOrUrl: string,
    filename?: string,
    caption?: string,
  ) {
    const client = this.getClient(sessionOrId);
    if (!client) throw new Error('Client not running for ' + sessionOrId);
    // attempt common APIs
    const tryCalls = [
      async () =>
        client.sendImage &&
        client.sendImage(to, bufferOrUrl, filename || 'image', caption),
      async () =>
        client.sendFile &&
        client.sendFile(to, bufferOrUrl, filename || 'file', caption),
      async () =>
        client.sendFileFromBase64 &&
        client.sendFileFromBase64(to, bufferOrUrl, filename || 'file', caption),
      async () =>
        client.sendImageFromUrl &&
        client.sendImageFromUrl(to, bufferOrUrl, caption),
      async () =>
        client.sendFileFromUrl &&
        client.sendFileFromUrl(to, bufferOrUrl, filename || 'file', caption),
    ];
    for (const fn of tryCalls) {
      try {
        const res = await fn();
        if (res) return res;
      } catch (e) {
        // try next
      }
    }
    throw new Error('No media send method succeeded');
  }

  async sendSticker(sessionOrId: string, to: string, bufferOrUrl: string) {
    const client = this.getClient(sessionOrId);
    if (!client) throw new Error('Client not running for ' + sessionOrId);
    try {
      if (client.sendSticker) return await client.sendSticker(to, bufferOrUrl);
      if (client.sendImageAsSticker)
        return await client.sendImageAsSticker(to, bufferOrUrl);
    } catch (e) { }
    throw new Error('No sticker send method available');
  }

  // send generic JSON payload if client supports "sendMessage" with rich content
  async sendRich(sessionOrId: string, to: string, payload: any) {
    const client = this.getClient(sessionOrId);
    if (!client) throw new Error('Client not running for ' + sessionOrId);
    if (client.sendMessage) return client.sendMessage(to, payload);
    throw new Error('No rich send method available');
  }

  async dbUpdater(instance: string, state: string) {
    // update status on instances by name
    try {
      const inst = await this.instanceRepo.findOneBy({ name: instance } as any);
      if (inst) {
        (inst as any).status = state;
        const saved = await this.instanceRepo.save(inst as any);
        try {
          await (this.instanceRepo.manager as any).query(
            `UPDATE instances SET status = $1 WHERE name = $2`,
            [state, instance],
          );
        } catch (e) {
          // swallow notify errors
        }
        return saved;
      }
    } catch (e) {
      logger.warn(
        `Failed updating instance status in dbUpdater: ${String(e)} ${e?.stack || ''}`,
      );
    }
    return null;
  }
}
// trigger

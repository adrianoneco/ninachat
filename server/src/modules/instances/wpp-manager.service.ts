import { Injectable, Logger, NotFoundException, OnApplicationShutdown } from '@nestjs/common';
import { Wpp } from '../../lib/wpp';
import { Instance } from '../../entities/instance.entity';
import { EventsGateway } from '../../ws/events.gateway';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Contact } from '../../entities/contact.entity';
import { Message } from '../../entities/message.entity';
import { Conversation } from '../../entities/conversation.entity';
import fs from 'fs-extra';
import path from 'path';
import { uploadDirToS3 } from '../../lib/s3.client';
import * as wppconnect from '@wppconnect-team/wppconnect';
import { StorageService } from '../storage/storage.service';

import _fs from 'fs';
import shouldIgnore from '../../utils/shouldIgnore';
import { syncContacts } from '../sync/contactsSync';
import e from 'express';
import { syncConversations } from '../sync/conversationsSync';
import { getContactByPushName } from '../../utils/getContact';

const logger = new Logger('WppManager');

@Injectable()
export class WppManagerService implements OnApplicationShutdown {
  private shuttingDown = false;
  private instances: Map<string, any> = new Map();
  private restartAttempts: Map<string, number> = new Map();

  constructor(
    private readonly events: EventsGateway,
    @InjectRepository(Instance) private instanceRepo: Repository<Instance>,
    @InjectRepository(Contact) private contactRepo: Repository<Contact>,
    @InjectRepository(Message) private msgRepo: Repository<Message>,
    @InjectRepository(Conversation) private convRepo: Repository<Conversation>,
    private readonly storageService: StorageService,
  ) {
    // register this instance manager globally for convenience
    // so other modules can call Wpp.getInstances()
    // Use setImmediate so registration happens after construction
    setImmediate(() => Wpp.registerManager(this));

    // register process signal handlers as redundancy to ensure puppeteer sessions close
    const handle = (sig: string) => {
      // allow async cleanup without multiple concurrent runs
      this.handleProcessSignal(sig).catch((e) => logger.warn(`Error during shutdown handler: ${String(e)}`));
    };
    if (typeof process !== 'undefined' && process && process.on) {
      process.on('SIGINT', () => handle('SIGINT'));
      process.on('SIGTERM', () => handle('SIGTERM'));
      process.on('SIGQUIT', () => handle('SIGQUIT'));
    }
  }

  private async handleProcessSignal(signal?: string) {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    try {
      await this.onApplicationShutdown(signal);
    } catch (e) {
      logger.warn(`handleProcessSignal failed: ${String(e)}`);
    }
  }

  async startInstance(instance: Instance) {
    const session = instance.wppconnect_session || instance.id;
    const baseDataDir = process.env.DATA_DIR || 'data/wpp_data';
    const sessionDir = path.resolve(baseDataDir, session);
    const logs = new Logger('WhatsAppSession');
    logs.verbose &&
      logs.verbose(`[${instance.name}] using data basepath -> ${baseDataDir}`);
    const puppeteerDir = path.join(sessionDir, 'puppeteer');
    const tokensDir = path.join(sessionDir, 'tokens');
    const uploadsDir = path.join(sessionDir, 'uploads');
    await fs.ensureDir(puppeteerDir);
    await fs.ensureDir(tokensDir);
    await fs.ensureDir(uploadsDir);

    // Apenas cria os diretórios se não existirem, nunca apaga sessão existente
    try {
      await fs.ensureDir(puppeteerDir);
      await fs.ensureDir(tokensDir);
      await fs.ensureDir(uploadsDir);
    } catch (e) {
      logs.warn && logs.warn(`[${instance.name}] Failed ensuring session dirs: ${String(e)}`);
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

          // Try to detect QR payloads when logger receives an object containing QR/base64
          const qrCandidate = (value && typeof value === 'object') ? (value.qr || value.qrcode || value.code || value.base64 || value.data || null) : null;

          if (msg) {
            logs.verbose(
              `[${instance.name}] [${String(prop).toUpperCase()}] ${msg}`,
            );
          }

          // If a QR-like payload was provided, emit a socket event so frontend can render it
          try {
            if (qrCandidate) {
              const payload = { session, qr: qrCandidate, raw: value };
              try {
                this.events.emitTo(session, 'wpp:qr', payload);
              } catch (e) {
                logs.warn && logs.warn(`[${instance.name}] failed emitting wpp:qr: ${String(e)}`);
              }
              // also mark waiting state in DB
              setInstanceStatus('waiting').catch(() => { });
              await this.dbUpdater(instance.name, 'waiting');
            } else if (typeof msg === 'string' && String(msg).toLowerCase().includes('qr')) {
              // generic textual 'QR' message: emit lightweight notification with the message
              try {
                this.events.emitTo(session, 'wpp:qr', { session, qr: msg });
              } catch (e) { }
              setInstanceStatus('waiting').catch(() => { });
              await this.dbUpdater(instance.name, 'waiting');
            }
            // detect script injection / execution context errors and try a restart
            else if (typeof msg === 'string' && (String(msg).toLowerCase().includes('wapi.js failed') || String(msg).toLowerCase().includes('execution context was destroyed'))) {
              try {
                const attempts = this.restartAttempts.get(session) || 0;
                if (attempts < 3) {
                  this.restartAttempts.set(session, attempts + 1);
                  logs.warn && logs.warn(`[${instance.name}] detected wapi/execcontext error, scheduling restart attempt ${attempts + 1}`);
                  // schedule restart after short delay
                  setTimeout(async () => {
                    try {
                      await this.restartInstance(instance).catch(() => { });
                    } catch (e) {
                      logs.warn && logs.warn(`[${instance.name}] restart attempt failed: ${String(e)}`);
                    }
                  }, 1500);
                } else {
                  logs.warn && logs.warn(`[${instance.name}] reached max restart attempts (${attempts}), not restarting`);
                }
              } catch (e) { }
            }
          } catch (e) {
            // swallow emit/db errors
          }

          if (msg) {
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

    const options: any = {
      session: instance.name,
      deviceName: `WPP-${instance.name.toUpperCase()}`,
      puppeteerOptions: {
        headless: true,
        userDataDir: path.resolve(path.join(sessionDir, 'puppeteer')),
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
      waitForLogin: false,
      headless: true,
      useChrome: false,
      logger: genericLogger as any,
      logQR: true,
      folderNameToken: tokensDir,
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

    fs.mkdirSync(path.join(baseDataDir, instance.id, 'logs'), {
      recursive: true,
    });
    logs.verbose(
      `[${instance.name}] Starting WhatsApp client with options: ${JSON.stringify(options)}`,
    );
    const client: wppconnect.Whatsapp = await wppconnect.create(options);

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
    // Also register client under common identifiers so API callers can use
    try {
      if (instance.name) this.instances.set(instance.name, client);
      if (instance.id) this.instances.set(instance.id, client);
      if (instance.wppconnect_session) this.instances.set(instance.wppconnect_session, client);
    } catch (e) {
      // non-fatal
    }

    // Wait for the page frame to fully stabilize before considering the client
    // ready for sending. WhatsApp Web may do a post-login navigation that detaches
    // the original frame. We poll page.evaluate() until it succeeds.
    (async () => {
      const stabilizeMaxAttempts = 20;
      const stabilizeDelay = 3000;
      for (let attempt = 1; attempt <= stabilizeMaxAttempts; attempt++) {
        try {
          if (client.page) {
            const ready = await client.page.evaluate(() => {
              return typeof (globalThis as any).WPP !== 'undefined' &&
                typeof (globalThis as any).WPP.chat !== 'undefined';
            });
            if (ready) {
              logger.log(`[${instance.name}] page frame stabilized on attempt ${attempt}`);
              break;
            }
          }
        } catch (e: any) {
          const msg = String(e?.message || e);
          if (msg.includes('detached Frame') || msg.includes('detached')) {
            logger.warn(`[${instance.name}] frame detached on readiness check attempt ${attempt} — WA may be updating`);
          }
        }
        await new Promise(r => setTimeout(r, stabilizeDelay));
      }
    })().catch(() => { });

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

    // Try to set auto-download settings with retries — WPP global may not be injected immediately.
    // The call returns a Promise (Puppeteer evaluate); we must await it and catch rejections.
    (async () => {
      const maxAttempts = 10;
      const delayMs = 2000;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          if (client && typeof (client as any).setAutoDownloadSettings === 'function') {
            await Promise.resolve(
              (client as any).setAutoDownloadSettings({ audio: true, document: true, image: true, video: true })
            );
            logs.verbose(`[${instance.name}] setAutoDownloadSettings succeeded on attempt ${attempt}`);
            break;
          }
        } catch (e: any) {
          const msg = String(e?.message || e || '');
          // WPP not yet injected — keep retrying silently
          if (attempt === maxAttempts) {
            logs.verbose(`[${instance.name}] setAutoDownloadSettings not available after ${maxAttempts} attempts (ignored): ${msg}`);
          }
        }
        await new Promise((res) => setTimeout(res, delayMs));
      }
    })().catch(() => { /* swallow — non-critical */ });





    client.onMessage(async (message: any) => {
      try {
        const _contact = await getContactByPushName(message.sender.pushname, client).catch(() => null);

        fs.writeFileSync(`/home/neco/Documentos/nina_chat/test/message.json`, JSON.stringify(message, null, 4));

        // Find contact by whatsapp_id or phone_number
        const contact = await this.contactRepo.findOne({
          where: [
            { whatsapp_id: _contact?.id },
            { phone_number: _contact?.phone_number }
          ]
        }).catch(() => null);

        logger.debug(`[${instance.name}] onMessage: contact found = ${!!contact}, id=${contact?.id}`);

        // Build conversation values
        const convValues: any = {
          chat_id: `${instance.id}-${message.chatId}`,
          instance_id: instance.id,
          is_group: message.isGroupMsg,
        };

        // Only add contact_id if found a contact with valid UUID
        if (contact?.id) {
          convValues.contact_id = contact.id;
        }

        const convInsertResult = await this.convRepo.createQueryBuilder()
          .insert()
          .into('conversations')
          .values(convValues)
          .orIgnore()
          .execute();
        
        logger.debug(`[${instance.name}] conversation insert result:`, JSON.stringify(convInsertResult));

        const conv = await this.convRepo.findOneBy({ chat_id: `${instance.id}-${message.chatId}` }).catch(() => null);
        const convId = conv?.id || null;
        
        logger.debug(`[${instance.name}] conversation found after insert: ${!!conv}, id=${convId}`);

        const msgInsertResult = this.msgRepo.createQueryBuilder()
          .insert()
          .into('messages')
          .values({
            instance_id: instance.id,
            conversation_id: convId,
            message_id: message.id,
            from_me: message.fromMe,
            body: message.body,
            content: message.content || message.body,
            type: message.type,
            media_type: message.mimetype || null
          })
          .orIgnore()
          .execute()
          .catch((e) => {
            logger.warn(`[${instance.name}] message insert failed: ${String(e)}`);
          });

        logger.debug(`[${instance.name}] message insert result:`, JSON.stringify(msgInsertResult));

        const contactName = contact?.name || contact?.call_name || message.sender?.pushname || 'Novo contato';
        const contactPhone = contact?.phone_formated || contact?.phone_number || message.from.split('@')[0];
        const contactAvatar = contact?.profile_picture_url || null;

        logger.debug(`[${instance.name}] emitting message:new`, { convId, contactName, contactPhone, msg: message.body?.substring(0, 30) });

        this.events.emitTo(session, 'message:new', {
          instance_id: instance.id,
          conversation_id: convId,
          contact_name: contactName,
          contact_phone: contactPhone,
          contact_avatar: contactAvatar,
          message_preview: message.body?.substring(0, 50) || '[mídia]',
          message_type: message.type,
          timestamp: new Date().toISOString(),
        });

      } catch (e) {
        logger.warn(`[${instance.name}] onMessage error: ${String(e)}`);
      }
    });

    // ── Presence tracking ──────────────────────────────────────────────────────
    client.onPresenceChanged(async (presence: any) => {
      try {
        const presenceId = presence?.id || '';
        const phone = presenceId.split('@')[0]; // Extract phone from JID
        const state = presence?.state || 'unavailable';
        const isOnline = presence?.isOnline || false;
        const isContact = presence?.isContact || false;

        if (!presenceId || !phone) {
          logger.debug(`[${instance.name}] onPresenceChanged: invalid presence id`);
          return;
        }

        // Convert state to user-friendly label
        const presenceMap: Record<string, string> = {
          'available': 'online',
          'unavailable': 'offline',
          'composing': 'typing',
          'recording': 'recording',
          'paused': 'paused',
        };
        const presenceLabel = presenceMap[state] || state;

        // Find contact by whatsapp_id or phone_number
        const contact = await this.contactRepo.findOne({
          where: [
            { whatsapp_id: presenceId },
            { phone_number: phone }
          ]
        }).catch(() => null);

        // Build presence event payload matching frontend expectation
        const presencePayload = {
          phone,
          presence: presenceLabel,
          contact_name: contact?.name || contact?.call_name || phone,
          contact_avatar: contact?.profile_picture_url || null,
        };

        // Emit presence event to frontend
        this.events.emitTo(session, 'contact:presence', presencePayload);
        this.events.emit('contact:presence', presencePayload);

        logger.debug(
          `[${instance.name}] presence: ${presenceLabel} from ${phone}`
        );

        // Update contact presence in DB
        await this.contactRepo.createQueryBuilder()
          .update()
          .set({ presense: presenceLabel })
          .where('whatsapp_id = :id OR phone_number = :phone', { id: presenceId, phone })
          .execute()
          .catch(() => { /* ignore */ });

      } catch (e) {
        logger.warn(`[${instance.name}] onPresenceChanged error: ${String(e)}`);
      }
    });

    client.onStateChange(async (state: string) => {
      if (state === 'CONNECTED') {
        /*
        await syncContacts(instance, client, this.contactRepo).catch((e) => {
          logger.warn(`[${instance.name}] syncContacts failed: ${String(e)}`);
        });

        await syncConversations(instance, client, this.convRepo, this.contactRepo).catch((e) => {
          logger.warn(`[${instance.name}] syncConversations failed: ${String(e)}`);
        });
        */

        logger.debug(`[${instance.name}] state changed -> ${state}`);
      }
      else if (state === 'DISCONNECTED') { }
      else if (state === 'OPENING') { }
      else if (state === 'PAIRING') { }
      else if (state === 'TIMEOUT') { }
      else if (state === 'UNPAIRED') { }
      else if (state === 'UNPAIRED_IDLE') { }
    });



    // persist session_dir
    instance.session_dir = sessionDir;
    await this.instanceRepo.save(instance);

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
    // Remove all map entries that reference this client (clean up multiple keys)
    try {
      for (const [k, v] of Array.from(this.instances.entries())) {
        if (v === client) this.instances.delete(k as string);
      }
    } catch (e) {
      // fallback: remove by provided key
      this.instances.delete(sessionOrId);
    }
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

  listClientKeys() {
    try {
      return Array.from(this.instances.keys());
    } catch (e) {
      return [] as string[];
    }
  }

  // Close all running Puppeteer/WhatsApp clients when application is shutting down
  async onApplicationShutdown(signal?: string) {
    logger.log(`Application shutdown (${signal || 'unknown signal'}) - closing ${this.instances.size} instance(s)`);
    const keys = Array.from(this.instances.keys());
    for (const k of keys) {
      try {
        await this.stopInstance(k);
        logger.log(`Closed instance ${k}`);
      } catch (e) {
        logger.warn(`Failed closing instance ${k}: ${String(e)}`);
      }
    }
  }

  // Ensure session directories exist for an instance (safe to call before start)
  async ensureSessionDirs(instance: Instance) {
    const session = instance.wppconnect_session || instance.id;
    const baseDataDir = process.env.DATA_DIR || 'data/wpp_data';
    const sessionDir = path.resolve(baseDataDir, session);
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

  /** Retry helper for transient Puppeteer/WPP errors (e.g. detached Frame).
   *  On detached-frame errors on the last retry, triggers a full instance restart
   *  so the next user attempt gets a fresh client. */
  private async withRetry<T>(fn: () => Promise<T>, retries = 1, delayMs = 2000): Promise<T> {
    let lastErr: any;
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (e: any) {
        lastErr = e;
        const msg = String(e?.message || e);
        const isTransient = msg.includes('detached Frame') || msg.includes('detached') ||
          msg.includes('Target closed') || msg.includes('Session closed') ||
          msg.includes('not attached') || msg.includes('Execution context');
        if (!isTransient || i >= retries) {
          // On final detached-frame failure, schedule a background instance restart
          if (isTransient) {
            logger.warn('[WPP] persistent detached frame — scheduling instance restart');
            setImmediate(() => this.restartAllDetached().catch(() => { }));
          }
          throw e;
        }
        logger.warn(`[WPP] transient error (attempt ${i + 1}/${retries + 1}): ${msg.slice(0, 120)}`);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
    throw lastErr;
  }

  /** Restart any instances whose Puppeteer page has a detached frame */
  private async restartAllDetached() {
    for (const [key, instance] of this.instances) {
      try {
        // Skip alias keys (name, wppconnect_session) — only restart by UUID-shaped keys
        if (key.length < 30) continue;
        const inst = await this.instanceRepo.findOneBy({ id: key } as any);
        if (!inst) continue;
        logger.log(`[WPP] Restarting instance ${inst.name || key} to recover from detached frame`);
        await this.restartInstance(inst);
        break; // restart one at a time
      } catch (e) {
        logger.warn(`[WPP] Failed restarting instance ${key}: ${String(e)}`);
      }
    }
  }

  async sendMessage(sessionOrId: string, to: string, body: string) {
    const client = this.getClient(sessionOrId);
    if (!client) throw new Error('Client not running for ' + sessionOrId);
    return this.withRetry(async () => {
      if (client.sendText) return client.sendText(to, body);
      if (client.sendMessage) return client.sendMessage(to, { text: body });
      if (client.sendSimpleText) return client.sendSimpleText(to, body as any);
      throw new Error('No send method available on client');
    });
  }

  // generic media/file sender: try multiple client methods for best-effort
  async sendMedia(
    sessionOrId: string,
    to: string,
    bufferOrUrl: string | Buffer,
    filename?: string,
    caption?: string,
  ) {
    const client = this.getClient(sessionOrId);
    if (!client) throw new Error('Client not running for ' + sessionOrId);
    
    return this.withRetry(async () => {
      let tempFilePath: string | undefined;
      let payloadBase64: string | undefined;
      
      // If it's a Buffer, prepare file path and base64 as fallbacks
      if (Buffer.isBuffer(bufferOrUrl)) {
        const mimeType = this.getMimeTypeFromFilename(filename || 'file');
        logger.debug(`[WPP] sendMedia buffer: filename=${filename}, mimeType=${mimeType}, size=${bufferOrUrl.length} bytes`);
        
        // Save buffer to temp file
        const uploadsDir = path.join(process.env.DATA_DIR || 'data/wpp_data', sessionOrId, 'uploads');
        await fs.ensureDir(uploadsDir);
        tempFilePath = path.join(uploadsDir, `temp-${Date.now()}-${filename || 'file'}`);
        await fs.writeFile(tempFilePath, bufferOrUrl);
        logger.debug(`[WPP] Saved buffer to temp file: ${tempFilePath}`);
        
        // Prepare base64 as fallback only
        const base64 = bufferOrUrl.toString('base64');
        payloadBase64 = `data:${mimeType};base64,${base64}`;
      }

      const tryCalls = [
        // For buffers, try file path methods first (most reliable)
        ...(tempFilePath && Buffer.isBuffer(bufferOrUrl)
          ? [
              async () => {
                if (!client.sendFileFromPath) return null;
                logger.debug(`[WPP] Trying sendFileFromPath for ${tempFilePath}`);
                return await client.sendFileFromPath(to, tempFilePath, filename || 'file', caption);
              },
              async () => {
                if (!client.sendMediaFile) return null;
                logger.debug(`[WPP] Trying sendMediaFile for ${tempFilePath}`);
                return await client.sendMediaFile(to, tempFilePath, caption);
              },
            ]
          : []),
        // Then try Buffer methods directly
        ...(Buffer.isBuffer(bufferOrUrl)
          ? [
              async () => {
                if (!client.sendMedia) return null;
                logger.debug(`[WPP] Trying sendMedia with Buffer for ${filename}`);
                return await client.sendMedia(to, bufferOrUrl, { filename, caption });
              },
              async () => {
                if (!client.sendImage) return null;
                logger.debug(`[WPP] Trying sendImage with Buffer for ${filename}`);
                return await client.sendImage(to, bufferOrUrl as Buffer, filename || 'image', caption);
              },
              async () => {
                if (!client.sendFile) return null;
                logger.debug(`[WPP] Trying sendFile with Buffer for ${filename}`);
                return await client.sendFile(to, bufferOrUrl as Buffer, filename || 'file', caption);
              },
              // Fallback to base64 if Buffer methods fail
              async () => {
                if (!client.sendFileFromBase64 || !payloadBase64) return null;
                logger.debug(`[WPP] Trying sendFileFromBase64 for ${filename}`);
                return await client.sendFileFromBase64(to, payloadBase64, filename || 'file', caption);
              },
            ]
          : []),
        // For URLs, try image/file from URL methods
        ...(typeof bufferOrUrl === 'string' && bufferOrUrl.startsWith('http')
          ? [
              async () => {
                if (!client.sendImageFromUrl) return null;
                logger.debug(`[WPP] Trying sendImageFromUrl for ${bufferOrUrl}`);
                return await client.sendImageFromUrl(to, bufferOrUrl, caption);
              },
              async () => {
                if (!client.sendFileFromUrl) return null;
                logger.debug(`[WPP] Trying sendFileFromUrl for ${bufferOrUrl}`);
                return await client.sendFileFromUrl(to, bufferOrUrl, filename || 'file', caption);
              },
            ]
          : []),
      ];

      let lastError: Error | undefined;
      for (const fn of tryCalls) {
        try {
          const res = await fn();
          if (res) {
            logger.debug(`[WPP] sendMedia succeeded`);
            // Clean up temp file if created
            if (tempFilePath) {
              fs.unlink(tempFilePath).catch(e => logger.warn(`Failed to clean temp file: ${String(e)}`));
            }
            return res;
          }
        } catch (e) {
          const errMsg = String(e).slice(0, 150);
          logger.warn(`[WPP] sendMedia attempt failed: ${errMsg}`);
          lastError = e as Error;
        }
      }
      
      // Clean up temp file on failure
      if (tempFilePath) {
        fs.unlink(tempFilePath).catch(e => logger.warn(`Failed to clean temp file: ${String(e)}`));
      }
      
      throw lastError || new Error('No media send method succeeded');
    });
  }

  private getMimeTypeFromFilename(filename: string): string {
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.3gp': 'video/3gpp',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mp3': 'audio/mpeg',
      '.ogg': 'audio/ogg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.zip': 'application/zip',
      '.txt': 'text/plain',
    };

    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return mimeMap[ext] || 'application/octet-stream';
  }

  async sendSticker(sessionOrId: string, to: string, bufferOrUrl: string | Buffer) {
    const client = this.getClient(sessionOrId);
    if (!client) throw new Error('Client not running for ' + sessionOrId);
    
    let tempFilePath: string | undefined;
    let payloadBase64: string | undefined;
    
    // Convert buffer to file path or base64 if needed
    if (Buffer.isBuffer(bufferOrUrl)) {
      const mimeType = 'image/webp'; // Stickers are usually WebP
      logger.debug(`[WPP] sendSticker converting buffer (size=${bufferOrUrl.length} bytes)`);
      
      // Save buffer to temp file
      const uploadsDir = path.join(process.env.DATA_DIR || 'data/wpp_data', sessionOrId, 'uploads');
      await fs.ensureDir(uploadsDir);
      tempFilePath = path.join(uploadsDir, `temp-sticker-${Date.now()}.webp`);
      await fs.writeFile(tempFilePath, bufferOrUrl);
      logger.debug(`[WPP] Saved sticker to temp file: ${tempFilePath}`);
      
      const base64 = bufferOrUrl.toString('base64');
      payloadBase64 = `data:${mimeType};base64,${base64}`;
    }
    
    const tryCalls = [
      // For buffers, try file path first
      ...(tempFilePath && Buffer.isBuffer(bufferOrUrl)
        ? [
            async () => {
              if (!client.sendStickerFromPath) return null;
              logger.debug(`[WPP] Trying sendStickerFromPath for ${tempFilePath}`);
              return await client.sendStickerFromPath(to, tempFilePath);
            },
            async () => {
              if (!client.sendFileFromPath) return null;
              logger.debug(`[WPP] Trying sendFileFromPath for sticker`);
              return await client.sendFileFromPath(to, tempFilePath, 'sticker.webp', '');
            },
          ]
        : []),
      // Then try Buffer or base64 methods
      async () => {
        if (!client.sendSticker) return null;
        logger.debug(`[WPP] Trying sendSticker`);
        return await client.sendSticker(to, Buffer.isBuffer(bufferOrUrl) ? payloadBase64 : bufferOrUrl);
      },
      async () => {
        if (!client.sendImageAsSticker) return null;
        logger.debug(`[WPP] Trying sendImageAsSticker`);
        return await client.sendImageAsSticker(to, Buffer.isBuffer(bufferOrUrl) ? payloadBase64 : bufferOrUrl);
      },
    ];
    
    let lastError: Error | undefined;
    for (const fn of tryCalls) {
      try {
        const res = await fn();
        if (res) {
          logger.debug(`[WPP] sendSticker succeeded`);
          // Clean up temp file
          if (tempFilePath) {
            fs.unlink(tempFilePath).catch(e => logger.warn(`Failed to clean sticker temp file: ${String(e)}`));
          }
          return res;
        }
      } catch (e) {
        logger.warn(`[WPP] sendSticker attempt failed: ${String(e).slice(0, 150)}`);
        lastError = e as Error;
      }
    }
    
    // Clean up temp file on failure
    if (tempFilePath) {
      fs.unlink(tempFilePath).catch(e => logger.warn(`Failed to clean sticker temp file: ${String(e)}`));
    }
    
    throw lastError || new Error('No sticker send method available');
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

  private extFromMime(mime: string): string {
    const map: Record<string, string> = {
      'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp',
      'video/mp4': '.mp4', 'video/webm': '.webm', 'video/3gpp': '.3gp',
      'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/ogg; codecs=opus': '.ogg',
      'audio/wav': '.wav', 'audio/mp4': '.m4a', 'audio/aac': '.aac',
      'application/pdf': '.pdf', 'application/msword': '.doc',
    };
    return map[mime] || map[mime.split(';')[0]] || '.bin';
  }
}
// trigger

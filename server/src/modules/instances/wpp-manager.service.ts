import {
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Wpp } from '../../lib/wpp';
import { Instance } from '../../entities/instance.entity';
import { EventsGateway } from '../../ws/events.gateway';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Contact } from '../../entities/contact.entity';
import { Message } from '../../entities/message.entity';
import { Conversation } from '../../entities/conversation.entity';
import { LiveChatSettings } from '../../entities/livechat-settings.entity';
import { GenericRecord } from '../../entities/generic-record.entity';
import fs from 'fs-extra';
import path from 'path';
import { randomUUID } from 'crypto';

import * as wppconnect from '@wppconnect-team/wppconnect';
import { StorageService } from '../storage/storage.service';

import _fs from 'fs';
import { getContactByPushName } from '../../utils/getContact';
import { OnMessageChanged } from '../../core/messages';
import { OnAckChanged } from '../../core/ack';
import { syncContacts } from '../sync/contactsSync';

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
    @InjectRepository(LiveChatSettings) private settingsRepo: Repository<LiveChatSettings>,
    @InjectRepository(GenericRecord) private genericRecordRepo: Repository<GenericRecord>,
    private readonly storageService: StorageService,
  ) {
    // register this instance manager globally for convenience
    // so other modules can call Wpp.getInstances()
    // Use setImmediate so registration happens after construction
    setImmediate(() => Wpp.registerManager(this));

    // register process signal handlers as redundancy to ensure puppeteer sessions close
    const handle = (sig: string) => {
      // allow async cleanup without multiple concurrent runs
      this.handleProcessSignal(sig).catch((e) =>
        logger.warn(`Error during shutdown handler: ${String(e)}`),
      );
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
      logs.warn &&
        logs.warn(
          `[${instance.name}] Failed ensuring session dirs: ${String(e)}`,
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

          // Try to detect QR payloads when logger receives an object containing QR/base64
          const qrCandidate =
            value && typeof value === 'object'
              ? value.qr ||
              value.qrcode ||
              value.code ||
              value.base64 ||
              value.data ||
              null
              : null;

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
                logs.warn &&
                  logs.warn(
                    `[${instance.name}] failed emitting wpp:qr: ${String(e)}`,
                  );
              }
              // also mark waiting state in DB
              setInstanceStatus('waiting').catch(() => { });
            } else if (
              typeof msg === 'string' &&
              String(msg).toLowerCase().includes('qr')
            ) {
              // generic textual 'QR' message: emit lightweight notification with the message
              try {
                this.events.emitTo(session, 'wpp:qr', { session, qr: msg });
              } catch (e) { }
              setInstanceStatus('waiting').catch(() => { });
            }
            // detect script injection / execution context errors and try a restart
            else if (
              typeof msg === 'string' &&
              (String(msg).toLowerCase().includes('wapi.js failed') ||
                String(msg)
                  .toLowerCase()
                  .includes('execution context was destroyed'))
            ) {
              try {
                const attempts = this.restartAttempts.get(session) || 0;
                if (attempts < 3) {
                  this.restartAttempts.set(session, attempts + 1);
                  logs.warn &&
                    logs.warn(
                      `[${instance.name}] detected wapi/execcontext error, scheduling restart attempt ${attempts + 1}`,
                    );
                  // schedule restart after short delay
                  setTimeout(async () => {
                    try {
                      await this.restartInstance(instance).catch(() => { });
                    } catch (e) {
                      logs.warn &&
                        logs.warn(
                          `[${instance.name}] restart attempt failed: ${String(e)}`,
                        );
                    }
                  }, 1500);
                } else {
                  logs.warn &&
                    logs.warn(
                      `[${instance.name}] reached max restart attempts (${attempts}), not restarting`,
                    );
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
              } else if (
                s.includes('disconnected') ||
                s.includes('logout') ||
                s.includes('session_unpaired')
              ) {
                setInstanceStatus('disconnected').catch(() => { });
              } else if (s.includes('ready')) {
                setInstanceStatus('initialized').catch(() => { });
              } else if (s.includes('timeout')) {
                setInstanceStatus('disconnected').catch(() => { });
              } else if (s.includes('initializing')) {
                setInstanceStatus('initializing').catch(() => { });
              } else if (s.includes('MAIN (NORMAL)'.toLocaleLowerCase())) {
                setInstanceStatus('connected').catch(() => { });
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
      logger: genericLogger,
      logQR: true,
      folderNameToken: tokensDir,
      debug: true
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
      if (instance.wppconnect_session)
        this.instances.set(instance.wppconnect_session, client);
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
              return (
                typeof (globalThis as any).WPP !== 'undefined' &&
                typeof (globalThis as any).WPP.chat !== 'undefined'
              );
            });
            if (ready) {
              logger.log(
                `[${instance.name}] page frame stabilized on attempt ${attempt}`,
              );
              break;
            }
          }
        } catch (e: any) {
          const msg = String(e?.message || e);
          if (msg.includes('detached Frame') || msg.includes('detached')) {
            logger.warn(
              `[${instance.name}] frame detached on readiness check attempt ${attempt} — WA may be updating`,
            );
          }
        }
        await new Promise((r) => setTimeout(r, stabilizeDelay));
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
          if (
            client &&
            typeof (client as any).setAutoDownloadSettings === 'function'
          ) {
            await Promise.resolve(
              (client as any).setAutoDownloadSettings({
                audio: true,
                document: true,
                image: true,
                video: true,
              }),
            );
            logs.verbose(
              `[${instance.name}] setAutoDownloadSettings succeeded on attempt ${attempt}`,
            );
            break;
          }
        } catch (e: any) {
          const msg = String(e?.message || e || '');
          // WPP not yet injected — keep retrying silently
          if (attempt === maxAttempts) {
            logs.verbose(
              `[${instance.name}] setAutoDownloadSettings not available after ${maxAttempts} attempts (ignored): ${msg}`,
            );
          }
        }
        await new Promise((res) => setTimeout(res, delayMs));
      }
    })().catch(() => {
      /* swallow — non-critical */
    });

    syncContacts(instance, client, this.contactRepo).catch((e) => {
      logger.warn(`[${instance.name}] syncContacts failed: ${String(e)}`);
    });

    client.onMessage(async (message: any) => {
      OnMessageChanged(
        message,
        client,
        this.convRepo,
        this.contactRepo,
        this.msgRepo,
        instance,
        this.events,
        this.storageService,
        this.settingsRepo,
        this.genericRecordRepo,
      );
    });

    // ── Presence tracking ──────────────────────────────────────────────────────
    client.onPresenceChanged(async (presenceData: any) => {
      try {
        logger.debug(`[${instance.name}] Presence changed: ${JSON.stringify(presenceData)}`);

        const { id, isOnline, isGroup, presence } = presenceData;

        // Extract phone from WID (e.g. "5541999999999@c.us" → "5541999999999")
        const phone = (id || '').replace(/@.+$/, '');

        const presenceType = presence || (isOnline ? 'available' : 'unavailable');
        const presenceMap: Record<string, string> = {
          available: 'online',
          unavailable: 'offline',
          composing: 'typing',
          recording: 'recording',
          paused: 'paused',
        };
        const status = presenceMap[presenceType] || presenceType;

        // Update DB contact presense field
        let contact: any = null;
        if (phone) {
          try {
            await this.contactRepo.createQueryBuilder()
              .update('contacts')
              .set({ 'presense': status })
              .where('phone_number = :phone OR whatsapp_id = :id', { phone, id })
              .execute();
            logger.log(`[${instance.name}] Presence DB update succeeded for phone: ${phone}, id: ${id}`);
          } catch (e: any) {
            logger.warn(`[${instance.name}] Presence DB update failed: ${e}`);
          }
        }

        // Emit contact:presence — matches what useConversations listens to
        const payload = {
          phone,
          presence: status,
          contact_name: contact?.name || contact?.call_name || null,
          contact_avatar: contact?.profile_picture_url || null,
        };
        this.events.emit('contact:presence', payload);
        this.events.emitTo(instance.name, 'contact:presence', payload);
      } catch (e) {
        logger.warn(`[${instance.name}] Presence handler error: ${String(e)}`);
      }
    });

    client.onAck((ack: wppconnect.Ack) => {
      OnAckChanged(ack, this.msgRepo, instance, this.events);
    });

    client.onIncomingCall(async (call: wppconnect.IncomingCall) => {
      try {
        // Extract phone from peerJid (e.g. "5541999999999@c.us" → "5541999999999")
        const phone = call.peerJid?.replace(/@.+$/, '') || '';
        // Look up contact for name/avatar
        const contact = phone
          ? await this.contactRepo.findOne({ where: [
              { phone_number: phone } as any,
              { phone_formated: phone } as any,
            ] }).catch(() => null)
          : null;
        const payload = {
          instance_id: instance.id,
          instance_name: instance.name,
          call_id: call.id,
          peerJid: call.peerJid,
          phone,
          isVideo: call.isVideo,
          isGroup: call.isGroup,
          offerTime: call.offerTime,
          contact_name: contact?.name || contact?.call_name || null,
          contact_avatar: contact?.profile_picture_url || null,
          phone_formated: contact?.phone_formated || phone,
          timestamp: new Date().toISOString(),
        };
        this.events.emit('instance:call', payload);
        this.events.emitTo(instance.name, 'instance:call', payload);
      } catch (e) {
        logger.warn(`[${instance.name}] onIncomingCall emit error: ${String(e)}`);
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
      } else if (state === 'DISCONNECTED') {
      } else if (state === 'OPENING') {
      } else if (state === 'PAIRING') {
      } else if (state === 'TIMEOUT') {
      } else if (state === 'UNPAIRED') {
      } else if (state === 'UNPAIRED_IDLE') {
      }
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
        if (v === client) this.instances.delete(k);
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
    logger.log(
      `Application shutdown (${signal || 'unknown signal'}) - closing ${this.instances.size} instance(s)`,
    );
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

  /** Wrap a promise with a timeout (default 60s) */
  private withTimeout<T>(promise: Promise<T>, ms = 60_000, label = 'WPP operation'): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      promise.then(
        (val) => { clearTimeout(timer); resolve(val); },
        (err) => { clearTimeout(timer); reject(err); },
      );
    });
  }

  /** Retry helper for transient Puppeteer/WPP errors (e.g. detached Frame).
   *  On detached-frame errors on the last retry, triggers a full instance restart
   *  so the next user attempt gets a fresh client. */
  private async withRetry<T>(
    fn: () => Promise<T>,
    retries = 1,
    delayMs = 2000,
  ): Promise<T> {
    let lastErr: any;
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (e: any) {
        lastErr = e;
        const msg = String(e?.message || e);
        const isTransient =
          msg.includes('detached Frame') ||
          msg.includes('detached') ||
          msg.includes('Target closed') ||
          msg.includes('Session closed') ||
          msg.includes('not attached') ||
          msg.includes('Execution context');
        if (!isTransient || i >= retries) {
          // On final detached-frame failure, schedule a background instance restart
          if (isTransient) {
            logger.warn(
              '[WPP] persistent detached frame — scheduling instance restart',
            );
            setImmediate(() => this.restartAllDetached().catch(() => { }));
          }
          throw e;
        }
        logger.warn(
          `[WPP] transient error (attempt ${i + 1}/${retries + 1}): ${msg.slice(0, 120)}`,
        );
        await new Promise((r) => setTimeout(r, delayMs));
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
        logger.log(
          `[WPP] Restarting instance ${inst.name || key} to recover from detached frame`,
        );
        await this.restartInstance(inst);
        break; // restart one at a time
      } catch (e) {
        logger.warn(`[WPP] Failed restarting instance ${key}: ${String(e)}`);
      }
    }
  }















  /** sendText — Swagger + internal */
  async sendTextMessage(sessionOrId: string, to: string, body: string) {
    if (to && !to.includes('@')) to = `${to}@c.us`;
    const client = this.getClient(sessionOrId);
    if (!client) throw new Error('Client not running for ' + sessionOrId);
    return this.withTimeout(client.sendText(to, body), 60_000, 'sendText');
  }

  /** sendImage — accepts Buffer (binary), http(s) URL, or data URI */
  async sendImageMessage(
    sessionOrId: string, to: string, bufferOrUrl: Buffer | string,
    filename?: string, caption?: string, mimeType?: string,
  ) {
    if (to && !to.includes('@')) to = `${to}@c.us`;
    const client = this.getClient(sessionOrId);
    if (!client) throw new Error('Client not running for ' + sessionOrId);
    const fname = filename || 'image.jpg';
    const filePath = await this.resolveToFile(bufferOrUrl, 'image', fname, mimeType);
    return this.withTimeout(
      client.sendImage(to, filePath, fname, caption || ''),
      90_000, 'sendImage',
    );
  }

  /** sendVideo — accepts Buffer (binary), http(s) URL, or data URI */
  async sendVideoMessage(
    sessionOrId: string, to: string, bufferOrUrl: Buffer | string,
    filename?: string, caption?: string, mimeType?: string,
  ) {
    if (to && !to.includes('@')) to = `${to}@c.us`;
    const client = this.getClient(sessionOrId);
    if (!client) throw new Error('Client not running for ' + sessionOrId);
    const fname = filename || 'video.mp4';
    const filePath = await this.resolveToFile(bufferOrUrl, 'video', fname, mimeType);
    return this.withTimeout(
      client.sendFile(to, filePath, fname, caption || ''),
      180_000, 'sendVideo',
    );
  }

  /** sendAudio — accepts Buffer (binary), http(s) URL, or data URI */
  async sendAudioMessage(
    sessionOrId: string, to: string, bufferOrUrl: Buffer | string,
    filename?: string, mimeType?: string,
  ) {
    if (to && !to.includes('@')) to = `${to}@c.us`;
    const client = this.getClient(sessionOrId);
    if (!client) throw new Error('Client not running for ' + sessionOrId);
    const fname = filename || 'audio.mp3';
    const filePath = await this.resolveToFile(bufferOrUrl, 'audio', fname, mimeType);
    // isPtt=false → regular audio attachment (not voice note)
    return this.withTimeout(
      client.sendPtt(to, filePath, fname, '', undefined, undefined, false),
      120_000, 'sendAudio',
    );
  }

  /** sendPtt (voice note) — accepts Buffer (binary), http(s) URL, or data URI */
  async sendPttMessage(
    sessionOrId: string, to: string, bufferOrUrl: Buffer | string,
    filename?: string, mimeType?: string,
  ) {
    if (to && !to.includes('@')) to = `${to}@c.us`;
    const client = this.getClient(sessionOrId);
    if (!client) throw new Error('Client not running for ' + sessionOrId);
    const fname = filename || 'audio.mp3';
    const filePath = await this.resolveToFile(bufferOrUrl, 'ptt', fname, mimeType);
    // isPtt=true → voice note waveform UI in WhatsApp
    return this.withTimeout(
      client.sendPtt(to, filePath, fname, '', undefined, undefined, true),
      120_000, 'sendPtt',
    );
  }

  /** sendSticker — accepts Buffer (binary), http(s) URL, or data URI */
  async sendStickerMessage(
    sessionOrId: string, to: string, bufferOrUrl: Buffer | string,
    filename?: string, mimeType?: string,
  ) {
    if (to && !to.includes('@')) to = `${to}@c.us`;
    const client = this.getClient(sessionOrId);
    if (!client) throw new Error('Client not running for ' + sessionOrId);
    const fname = filename || 'sticker.webp';
    const filePath = await this.resolveToFile(bufferOrUrl, 'sticker', fname, mimeType);
    return this.withTimeout(
      client.sendImageAsSticker(to, filePath),
      90_000, 'sendSticker',
    );
  }

  /** General-purpose text send — used by MessagesService */
  async sendMessage(sessionOrId: string, to: string, body: string) {
    if (to && !to.includes('@')) to = `${to}@c.us`;
    const client = this.getClient(sessionOrId);
    if (!client) throw new Error('Client not running for ' + sessionOrId);
    const fn = client.sendText ? client.sendText(to, body)
      : client.sendMessage ? client.sendMessage(to, { text: body })
        : null;
    if (!fn) throw new Error('No send method available on client');
    return this.withTimeout(fn, 60_000, 'sendMessage');
  }

  /** General-purpose media send (Buffer or URL) — used by MessagesService */
  async sendMedia(
    sessionOrId: string,
    to: string,
    bufferOrUrl: string | Buffer,
    filename?: string,
    caption?: string,
  ) {
    if (to && !to.includes('@')) to = `${to}@c.us`;
    const client = this.getClient(sessionOrId);
    if (!client) throw new Error('Client not running for ' + sessionOrId);

    const fname = filename || 'file';
    const filePath = await this.resolveToFile(bufferOrUrl, 'media', fname);
    return this.withTimeout(
      client.sendFile(to, filePath, fname, caption || ''),
      120_000, 'sendMedia',
    );
  }

  /** sendDocument — accepts Buffer (binary), http(s) URL, or data URI */
  async sendDocumentMessage(
    sessionOrId: string, to: string, bufferOrUrl: Buffer | string,
    filename?: string, caption?: string, mimeType?: string,
  ) {
    if (to && !to.includes('@')) to = `${to}@c.us`;
    const client = this.getClient(sessionOrId);
    if (!client) throw new Error('Client not running for ' + sessionOrId);
    const fname = filename || 'document';
    const filePath = await this.resolveToFile(bufferOrUrl, 'media', fname, mimeType);
    return this.withTimeout(
      client.sendFile(to, filePath, fname, caption || ''),
      120_000, 'sendDocument',
    );
  }

  /** Sticker send — used by MessagesService */
  async sendSticker(sessionOrId: string, to: string, bufferOrUrl: string | Buffer) {
    if (to && !to.includes('@')) to = `${to}@c.us`;
    const client = this.getClient(sessionOrId);
    if (!client) throw new Error('Client not running for ' + sessionOrId);
    const filePath = await this.resolveToFile(bufferOrUrl, 'sticker', 'sticker.webp', 'image/webp');
    return this.withTimeout(
      client.sendImageAsSticker(to, filePath),
      90_000, 'sendSticker',
    );
  }

  /** sendRich — forwards arbitrary complex payload (list, poll, buttons, etc.)
   *  WppConnect doesn't have a single generic method; we try sendListMessage,
   *  sendPollMessage, and finally fall back to sending the payload as JSON text. */
  async sendRich(sessionOrId: string, to: string, payload: any) {
    if (to && !to.includes('@')) to = `${to}@c.us`;
    const client = this.getClient(sessionOrId);
    if (!client) throw new Error('Client not running for ' + sessionOrId);
    // Try structured message types if the client exposes them
    if (payload?.type === 'list' && client.sendListMessage) {
      return this.withTimeout(client.sendListMessage(to, payload), 60_000, 'sendRich:list');
    }
    if (payload?.type === 'poll' && client.sendPollMessage) {
      return this.withTimeout(client.sendPollMessage(to, payload.name, payload.choices, payload.options), 60_000, 'sendRich:poll');
    }
    if (payload?.type === 'buttons' && client.sendButtons) {
      return this.withTimeout(client.sendButtons(to, payload.title, payload.buttons, payload.description), 60_000, 'sendRich:buttons');
    }
    // Generic fallback: send JSON as plain text
    const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    return this.withTimeout(client.sendText(to, text), 60_000, 'sendRich:fallback');
  }

  private isDataUrl(value: Buffer | string): boolean {
    return typeof value === 'string' && value.startsWith('data:');
  }

  /** Resolve any input (Buffer, data URI, HTTP URL) to a file on disk.
   *  Saves at storage/{type}/{uuid}.{ext} and returns the absolute path. */
  private async resolveToFile(
    input: Buffer | string,
    type: string,
    fallbackFilename = 'file',
    fallbackMime?: string,
  ): Promise<string> {
    const ext = fallbackFilename.includes('.') ? fallbackFilename.split('.').pop()! : 'bin';
    const dir = path.resolve('storage', type);
    await fs.ensureDir(dir);
    const filePath = path.join(dir, `${randomUUID()}.${ext}`);

    if (Buffer.isBuffer(input)) {
      await fs.writeFile(filePath, input);
      return filePath;
    }
    if (this.isDataUrl(input)) {
      // Extract raw base64 from data URI
      const base64 = input.replace(/^data:[^;]+;base64,/, '');
      await fs.writeFile(filePath, Buffer.from(base64, 'base64'));
      return filePath;
    }
    // HTTP(s) URL — download server-side
    try {
      const res = await fetch(input);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(filePath, buf);
      return filePath;
    } catch (e) {
      throw new Error(`Failed to download ${input}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private guessMimeFromFilename(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      gif: 'image/gif', webp: 'image/webp',
      mp4: 'video/mp4', mov: 'video/quicktime',
      mp3: 'audio/mpeg', ogg: 'audio/ogg', opus: 'audio/ogg',
      pdf: 'application/pdf',
    };
    return (ext && map[ext]) || 'application/octet-stream';
  }
}
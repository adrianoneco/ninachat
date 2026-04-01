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

import _fs from 'fs';
import shouldIgnore from 'src/utils/shouldIgnore';

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
    })().catch(() => {});

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
        // Attempt to extract common fields from various wppconnect message shapes
        const raw = message || {};
        const rawFrom = raw.from || raw.author || raw.key?.remoteJid || raw.chatId || raw.sender || null;
        const msgBody = raw.body || raw.text || raw.message?.conversation || raw.message?.extendedTextMessage?.text || raw.message?.imageMessage?.caption || null;
        const msgId = (raw.key && raw.key.id) || raw.id || raw.message?.key?.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const timestamp = raw.t || raw.timestamp || raw.message?.timestamp || new Date().toISOString();
        // Normalize to digits only — used for phone_number and as fallback
        const digits = rawFrom ? String(rawFrom).replace(/\D/g, '') : null;
        // Keep the full JID for WPP API calls (e.g. 5511999@c.us or 5511999@lid)
        const wppJid = rawFrom || (digits ? `${digits}@c.us` : null);

        // Emit a lightweight preview immediately so frontend can show instant feedback
        try {
          const preview = {
            id: msgId,
            from: rawFrom,
            to: session,
            content: msgBody,
            timestamp: new Date(timestamp).toISOString(),
            provider: 'wppconnect',
            raw,
          };
          this.events.emitTo(session, 'wpp:message', preview);
        } catch (e) {
          console.warn('[WppManager] failed emitting wpp:message preview', e);
        }

        // ── Ensure contact exists ──
        let contact = null as any;
        try {
          if (digits || rawFrom) {
            // Try multiple lookup strategies — JID formats vary (@c.us, @lid, @s.whatsapp.net)
            const lookups: any[] = [];
            if (rawFrom) lookups.push({ whatsapp_id: rawFrom });
            if (digits) {
              lookups.push({ whatsapp_id: `${digits}@c.us` });
              lookups.push({ whatsapp_id: `${digits}@lid` });
              lookups.push({ whatsapp_id: digits });
              lookups.push({ phone_number: digits });
              lookups.push({ phone_number: `+${digits}` });
            }
            for (const q of lookups) {
              try {
                contact = await this.contactRepo.findOneBy(q as any);
                if (contact) break;
              } catch { /* ignore per-attempt */ }
            }
          }
          if (!contact && (digits || rawFrom)) {
            try {
              const displayName = message.sender?.pushname || message.sender?.verifiedName || message.sender?.formattedName || digits || rawFrom;
              contact = this.contactRepo.create({
                name: displayName,
                phone_number: digits || rawFrom,
                whatsapp_id: wppJid || rawFrom,
                created_at: new Date(),
              } as any);
              contact = await this.contactRepo.save(contact as any);
              logger.log(`[onMessage] created contact ${displayName} (${digits})`);
            } catch (e) {
              console.warn('[WppManager] failed creating contact', e);
            }
          }
        } catch (e) {
          console.warn('[WppManager] contact lookup/create failed', e);
        }

        // ── Ensure conversation exists ──
        let conv = null as any;
        try {
          // Lookup by multiple possible contact_id formats stored in conversations
          const contactVariants: string[] = [];
          if (contact?.whatsapp_id) contactVariants.push(contact.whatsapp_id);
          if (contact?.phone_number) contactVariants.push(contact.phone_number);
          if (wppJid) contactVariants.push(wppJid);
          if (digits) {
            contactVariants.push(digits);
            contactVariants.push(`${digits}@c.us`);
            contactVariants.push(`${digits}@lid`);
            contactVariants.push(`+${digits}`);
          }
          // Deduplicate
          const uniqueVariants = [...new Set(contactVariants.filter(Boolean))];

          for (const cid of uniqueVariants) {
            conv = await this.convRepo.findOne({ where: { contact_id: cid, instance_id: instance.id } as any });
            if (conv) break;
          }

          if (!conv) {
            // Create new conversation — use the WPP JID as contact_id for send compatibility
            const contactId = wppJid || digits || rawFrom;
            const convEnt = this.convRepo.create({
              contact_id: contactId,
              instance_id: instance.id,
              is_active: true,
              last_message_at: new Date(),
              nina_context: {},
              metadata: {},
            } as any);
            conv = await this.convRepo.save(convEnt as any);
            logger.log(`[onMessage] created conversation ${conv.id} for contact_id=${contactId}`);
            this.events.emit('conversation:created', conv);
          }
        } catch (e) {
          console.warn('[WppManager] conversation upsert failed', e);
        }

        // ── Persist message ──
        try {
          const conversationId = conv?.id;
          if (!conversationId) {
            console.warn('[WppManager] no conversation_id — skipping message persist');
            return;
          }
          const msgEnt: any = {
            conversation_id: conversationId,
            message_id: String(msgId),
            whatsapp_message_id: String(msgId),
            type: msgBody ? 'text' : 'media',
            from_type: 'whatsapp',
            content: msgBody || null,
            media_url: null,
            status: 'received',
            sent_at: new Date(timestamp),
            metadata: raw,
          };
          const ent = this.msgRepo.create(msgEnt as any);
          const saved = await this.msgRepo.save(ent as any);

          // Emit canonical created message event for frontend consumers
          try {
            this.events.emit('message:created', saved);
            this.events.emitTo(session, 'message:created', saved);
          } catch (e) {
            console.warn('[WppManager] failed emitting message:created', e);
          }

          // Update conversation timestamp/active state
          try {
            conv.last_message_at = new Date();
            conv.is_active = true;
            await this.convRepo.save(conv as any);
          } catch (e) {
            console.warn('[WppManager] failed updating conversation after save', e);
          }
        } catch (e) {
          console.warn('[WppManager] failed saving incoming message', e);
        }
      } catch (e) {
        console.warn('[WppManager] onMessage handler error', e);
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
            setImmediate(() => this.restartAllDetached().catch(() => {}));
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
    bufferOrUrl: string,
    filename?: string,
    caption?: string,
  ) {
    const client = this.getClient(sessionOrId);
    if (!client) throw new Error('Client not running for ' + sessionOrId);
    return this.withRetry(async () => {
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
    });
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

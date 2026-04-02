import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Instance } from '../../entities/instance.entity';
import { EventsGateway } from '../../ws/events.gateway';
import { WppManagerService } from './wpp-manager.service';

@Injectable()
export class InstancesService implements OnModuleInit {
  constructor(
    @InjectRepository(Instance) private repo: Repository<Instance>,
    private readonly events: EventsGateway,
    private readonly wpp: WppManagerService,
  ) {}

  // register repo so db-updater helper can use it
  // (keeps db-updater decoupled from Nest DI) and start instances
  async onModuleInit() {
    // On application bootstrap, start all configured wppconnect instances.
    try {
      const all = await this.repo.find();
      const wppInstances = (all || []).filter(
        (i) => i.channel === 'wppconnect',
      );
      for (const inst of wppInstances) {
        try {
          // ensure session dirs exist (force create) before starting instance
          try {
            await this.wpp.ensureSessionDirs(inst);
          } catch (e) {
            /* ignore */
          }
          await this.wpp.startInstance(inst);
        } catch (e) {
          // swallow to avoid breaking bootstrap
        }
      }
    } catch (e) {
      // ignore
    }

    // Periodic reconciliation: ensure instances defined in DB are running.
    // If a session/client is not present in WppManagerService, start it as a fallback.
    setInterval(async () => {
      try {
        const all2 = await this.repo.find();
        const wppInstances2 = (all2 || []).filter(
          (i) => i.channel === 'wppconnect',
        );
        for (const inst of wppInstances2) {
          try {
            const session = inst.wppconnect_session || inst.id;
            const client = this.wpp.getClient(session);
            if (!client) {
              // attempt to start missing instance
              console.log(
                `[InstancesService] Reconciliation starting missing instance ${inst.name || session}`,
              );
              await this.wpp.startInstance(inst).catch((err) => {
                console.warn(
                  `[InstancesService] Failed starting instance ${session}:`,
                  err?.message || err,
                );
              });
            }
          } catch (e) {
            // ignore per-instance errors
          }
        }
      } catch (e) {
        // ignore recon errors
      }
    }, 30000);
  }

  async findAll() {
    return this.repo.find();
  }

  async create(data: Partial<Instance>) {
    // Special handling for wppconnect: if an instance with the same session or name exists,
    // update webhook_url, start it and return the saved instance. Otherwise create a new one
    // and auto-start it.
    if (data.channel === 'wppconnect') {
      // try to find existing by session or name
      let existing: Instance | null = null;
      if (data.wppconnect_session) {
        existing = await this.repo.findOneBy({
          wppconnect_session: data.wppconnect_session,
        } as any);
      }
      if (!existing && data.name) {
        existing = await this.repo.findOneBy({ name: data.name } as any);
      }

      if (existing) {
        // update webhook_url if provided
        if ((data as any).webhook_url)
          (existing as any).webhook_url = (data as any).webhook_url;
        Object.assign(existing, data as any);
        const savedExisting = await this.repo.save(existing);
        this.events.emit('instance:updated', savedExisting);
        try {
          await this.wpp.startInstance(savedExisting);
        } catch (e) {
          // ignore start errors
        }
        return savedExisting;
      }
      // fallthrough to create new instance
    }

    const ent = this.repo.create(data as any);
    const saved = (await this.repo.save(ent)) as unknown as Instance;
    this.events.emit('instance:created', saved);
    try {
      // auto-start instance when created
      await this.wpp.startInstance(saved);
    } catch (e) {
      // ignore start errors
    }
    return saved;
  }

  async update(id: string, data: Partial<Instance>) {
    await this.repo.update(id, data as any);
    const updated = await this.repo.findOneBy({ id } as any);
    this.events.emit('instance:updated', updated);
    return updated;
  }

  async remove(id: string) {
    await this.repo.delete(id);
    this.events.emit('instance:deleted', { id });
  }

  async start(id: string) {
    const inst = await this.repo.findOneBy({ id } as any);
    if (!inst) throw new Error('Not found');
    return this.wpp.startInstance(inst);
  }

  async stop(id: string) {
    const inst = await this.repo.findOneBy({ id } as any);
    if (!inst) throw new Error('Not found');
    return this.wpp.stopInstance(inst.wppconnect_session || inst.id);
  }

  async restart(id: string) {
    const inst = await this.repo.findOneBy({ id } as any);
    if (!inst) throw new Error('Not found');
    return this.wpp.restartInstance(inst);
  }

  async sendMessage(id: string, to: string, body: string) {
    const inst = await this.repo.findOneBy({ id } as any);
    if (!inst) throw new Error('Not found');
    return this.wpp.sendMessage(inst.wppconnect_session || inst.id, to, body);
  }

  // Debug helper: list active client keys
  listClientKeys() {
    try {
      return this.wpp.listClientKeys();
    } catch (e) {
      return [] as string[];
    }
  }

  // test helper: set status on an instance and notify Postgres + websocket
  async setStatusForTest(
    id: string,
    status: 'connected' | 'disconnected' | 'waiting',
  ) {
    const inst = await this.repo.findOneBy({ id } as any);
    if (!inst) throw new Error('Not found');
    (inst as any).status = status;
    const saved = await this.repo.save(inst as any);
    try {
      const payload = JSON.stringify(saved);
      await (this.repo.manager as any).query(
        `SELECT pg_notify('instance_updated', $1)`,
        [payload],
      );
    } catch (e) {
      // ignore notify errors but surface via event
    }
    this.events.emit('instance:updated', saved);
    try {
      await this.wpp.startInstance(saved).catch(() => {});
    } catch (e) {}
    return saved;
  }
}

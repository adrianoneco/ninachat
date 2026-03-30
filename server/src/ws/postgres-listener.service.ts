import { Injectable, OnModuleInit, Logger, OnModuleDestroy } from '@nestjs/common';
import { Client } from 'pg';
import { EventsGateway } from './events.gateway';

const log = new Logger('PgListener');

@Injectable()
export class PostgresListenerService implements OnModuleInit, OnModuleDestroy {
  private client: Client | null = null;
  constructor(private readonly events: EventsGateway) {}

  async onModuleInit() {
    const host = process.env.POSTGRES_HOST || 'localhost';
    const port = parseInt(process.env.POSTGRES_PORT || '5432', 10);
    const user = process.env.POSTGRES_USER || 'postgres';
    const password = process.env.POSTGRES_PASSWORD || 'postgres';
    const database = process.env.POSTGRES_DB || 'nina';

    this.client = new Client({ host, port, user, password, database });
    try {
      await this.client.connect();
      log.log(`Connected to Postgres for LISTEN/NOTIFY on ${host}:${port}/${database}`);
      await this.client.query('LISTEN instance_updated');
      this.client.on('notification', (msg) => {
        try {
          if (!msg.channel) return;
          if (msg.channel === 'instance_updated') {
            const payload = msg.payload ? JSON.parse(msg.payload) : null;
            if (payload) {
              const session = payload.wppconnect_session || payload.id;
              log.verbose(`NOTIFY received for instance ${payload.id} session=${session}`);
              try {
                this.events.emit('instance:updated', payload);
                if (session) this.events.emitTo(session, 'instance:updated', payload);
              } catch (e) {
                log.warn('Failed to re-emit instance:updated: ' + String(e));
              }
            }
          }
        } catch (e) {
          log.warn('Failed handling notification: ' + String(e));
        }
      });
    } catch (e) {
      log.warn('Postgres LISTEN setup failed: ' + String(e));
      if (this.client) {
        try { await this.client.end(); } catch (err) {}
        this.client = null;
      }
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      try { await this.client.end(); } catch (e) {}
      this.client = null;
    }
  }
}

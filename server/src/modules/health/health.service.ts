import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface ValidationResult {
  component: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly ds: DataSource) {}

  async check() {
    const results: ValidationResult[] = [];

    // 1. Database connectivity
    try {
      await this.ds.query('SELECT 1');
      results.push({ component: 'database', status: 'ok', message: 'Banco de dados conectado' });
    } catch {
      results.push({ component: 'database', status: 'error', message: 'Banco de dados inacessível' });
    }

    // 2. System identity (company settings)
    try {
      const rows = await this.ds.query(
        `SELECT data FROM generic_records WHERE collection='system_settings' LIMIT 1`,
      );
      const data = rows[0]?.data || {};
      if (data.site_name && String(data.site_name).trim()) {
        results.push({ component: 'identity', status: 'ok', message: 'Identidade configurada' });
      } else {
        results.push({ component: 'identity', status: 'warning', message: 'Nome da empresa não configurado' });
      }
    } catch {
      results.push({ component: 'identity', status: 'warning', message: 'Configurações do sistema não encontradas' });
    }

    // 3. Pipeline stages
    try {
      const rows = await this.ds.query(
        `SELECT COUNT(*) AS cnt FROM generic_records WHERE collection='pipeline_stages'`,
      );
      const cnt = Number(rows[0]?.cnt ?? 0);
      if (cnt > 0) {
        results.push({ component: 'pipeline', status: 'ok', message: `Pipeline configurado (${cnt} etapas)` });
      } else {
        results.push({ component: 'pipeline', status: 'warning', message: 'Nenhuma etapa de pipeline configurada' });
      }
    } catch {
      results.push({ component: 'pipeline', status: 'warning', message: 'Não foi possível verificar pipeline' });
    }

    // 4. WhatsApp instance
    try {
      const rows = await this.ds.query(
        `SELECT status FROM instances LIMIT 1`,
      );
      if (rows.length === 0) {
        results.push({ component: 'whatsapp', status: 'warning', message: 'Nenhuma instância WhatsApp configurada' });
      } else {
        const st = rows[0].status;
        if (st === 'connected' || st === 'authenticated' || st === 'initialized') {
          results.push({ component: 'whatsapp', status: 'ok', message: `WhatsApp conectado (${st})` });
        } else {
          results.push({ component: 'whatsapp', status: 'warning', message: `WhatsApp desconectado (${st ?? 'desconhecido'})` });
        }
      }
    } catch {
      results.push({ component: 'whatsapp', status: 'warning', message: 'Não foi possível verificar WhatsApp' });
    }

    // 5. Nina settings / AI agent
    try {
      const rows = await this.ds.query(
        `SELECT is_active, agent_name FROM nina_settings LIMIT 1`,
      );
      if (rows.length === 0) {
        results.push({ component: 'nina_settings', status: 'warning', message: 'Configurações do agente não encontradas' });
      } else if (rows[0].is_active) {
        results.push({ component: 'nina_settings', status: 'ok', message: `Agente "${rows[0].agent_name || 'Nina'}" ativo` });
      } else {
        results.push({ component: 'nina_settings', status: 'warning', message: 'Agente IA inativo' });
      }
    } catch {
      results.push({ component: 'nina_settings', status: 'warning', message: 'Não foi possível verificar agente IA' });
    }

    // 6. Team members
    try {
      const rows = await this.ds.query(
        `SELECT COUNT(*) AS cnt FROM generic_records WHERE collection='team_members'`,
      );
      const cnt = Number(rows[0]?.cnt ?? 0);
      if (cnt > 0) {
        results.push({ component: 'profile', status: 'ok', message: `Equipe configurada (${cnt} membros)` });
      } else {
        results.push({ component: 'profile', status: 'warning', message: 'Nenhum membro de equipe cadastrado' });
      }
    } catch {
      results.push({ component: 'profile', status: 'warning', message: 'Não foi possível verificar equipe' });
    }

    const ok = results.filter(r => r.status === 'ok').length;
    const errors = results.filter(r => r.status === 'error').length;
    const total = results.length;
    const percentage = Math.round((ok / total) * 100);

    const overallStatus: 'ok' | 'warning' | 'error' =
      errors > 0 ? 'error' : ok === total ? 'ok' : 'warning';

    const message =
      overallStatus === 'error' ? 'Sistema com erros críticos' :
      overallStatus === 'warning' ? 'Sistema parcialmente configurado' :
      'Sistema totalmente configurado';

    return {
      results,
      overallStatus,
      summary: { ok, total, percentage },
      message,
    };
  }
}

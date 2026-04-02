import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Message } from '../../entities/message.entity';
import { Conversation } from '../../entities/conversation.entity';
import { Contact } from '../../entities/contact.entity';

@Injectable()
export class ReportsService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(Message) private msgRepo: Repository<Message>,
    @InjectRepository(Conversation) private convRepo: Repository<Conversation>,
    @InjectRepository(Contact) private contactRepo: Repository<Contact>,
  ) {}

  private since(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }

  // ── Dashboard metrics ──────────────────────────────────────────────────────
  async getMetrics(days: number) {
    const from = this.since(days);
    const prevFrom = this.since(days * 2);

    // Conversations (chats)
    const [curConvs, prevConvs] = await Promise.all([
      this.convRepo
        .createQueryBuilder('c')
        .where('c.created_at >= :from', { from })
        .getCount(),
      this.convRepo
        .createQueryBuilder('c')
        .where('c.created_at >= :from AND c.created_at < :to', {
          from: prevFrom,
          to: from,
        })
        .getCount(),
    ]);

    // Converted (closed conversations)
    const [curClosed, prevClosed] = await Promise.all([
      this.convRepo
        .createQueryBuilder('c')
        .where("c.status = 'closed' AND c.created_at >= :from", { from })
        .getCount(),
      this.convRepo
        .createQueryBuilder('c')
        .where(
          "c.status = 'closed' AND c.created_at >= :from AND c.created_at < :to",
          { from: prevFrom, to: from },
        )
        .getCount(),
    ]);

    // New contacts
    const [curContacts, prevContacts] = await Promise.all([
      this.contactRepo
        .createQueryBuilder('c')
        .where('c.created_at >= :from', { from })
        .getCount(),
      this.contactRepo
        .createQueryBuilder('c')
        .where('c.created_at >= :from AND c.created_at < :to', {
          from: prevFrom,
          to: from,
        })
        .getCount(),
    ]);

    // Average response time: avg diff between first inbound and first outbound per conversation
    const avgMsRow: any = await this.ds
      .query(
        `
        SELECT AVG(EXTRACT(EPOCH FROM (first_out.sent_at - first_in.sent_at))) AS avg_seconds
        FROM (
          SELECT conversation_id, MIN(sent_at) AS sent_at
          FROM messages WHERE from_type = 'whatsapp' AND sent_at >= $1 GROUP BY conversation_id
        ) first_in
        JOIN (
          SELECT conversation_id, MIN(sent_at) AS sent_at
          FROM messages WHERE from_type != 'whatsapp' AND sent_at >= $1 GROUP BY conversation_id
        ) first_out ON first_in.conversation_id = first_out.conversation_id
        WHERE first_out.sent_at > first_in.sent_at
      `,
        [from],
      )
      .catch(() => [{ avg_seconds: null }]);

    const avgSec = parseFloat(avgMsRow[0]?.avg_seconds ?? '0') || 0;
    const avgMin = Math.floor(avgSec / 60);
    const avgSecRem = Math.round(avgSec % 60);
    const avgTimeStr = avgSec > 0 ? `${avgMin}m ${avgSecRem}s` : '—';

    const pct = (cur: number, prev: number) => {
      if (prev === 0) return cur > 0 ? '+100%' : '0%';
      const diff = Math.round(((cur - prev) / prev) * 100);
      return (diff >= 0 ? '+' : '') + diff + '%';
    };
    const up = (cur: number, prev: number) => cur >= prev;

    return [
      {
        label: 'Atendimentos',
        value: String(curConvs),
        trend: pct(curConvs, prevConvs),
        trendUp: up(curConvs, prevConvs),
      },
      {
        label: 'Conversões',
        value: String(curClosed),
        trend: pct(curClosed, prevClosed),
        trendUp: up(curClosed, prevClosed),
      },
      { label: 'Tempo Médio', value: avgTimeStr, trend: '', trendUp: true },
      {
        label: 'Novos Leads',
        value: String(curContacts),
        trend: pct(curContacts, prevContacts),
        trendUp: up(curContacts, prevContacts),
      },
    ];
  }

  // ── Chart data (chats + messages per day) ─────────────────────────────────
  async getChart(days: number) {
    const from = this.since(days);

    const convRows: any[] = await this.ds
      .query(
        `
        SELECT DATE(created_at) AS day, COUNT(*) AS cnt
        FROM conversations
        WHERE created_at >= $1
        GROUP BY day ORDER BY day
      `,
        [from],
      )
      .catch(() => []);

    const msgRows: any[] = await this.ds
      .query(
        `
        SELECT DATE(sent_at) AS day, COUNT(*) AS cnt
        FROM messages
        WHERE sent_at >= $1 AND from_type != 'whatsapp'
        GROUP BY day ORDER BY day
      `,
        [from],
      )
      .catch(() => []);

    const convMap = new Map(
      convRows.map((r) => [String(r.day).slice(0, 10), Number(r.cnt)]),
    );
    const msgMap = new Map(
      msgRows.map((r) => [String(r.day).slice(0, 10), Number(r.cnt)]),
    );

    const result: Array<{ name: string; chats: number; sales: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const name =
        days === 1
          ? 'Hoje'
          : days <= 7
            ? ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()]
            : `${d.getDate()}/${d.getMonth() + 1}`;
      result.push({
        name,
        chats: convMap.get(key) ?? 0,
        sales: msgMap.get(key) ?? 0,
      });
    }
    return result;
  }

  // ── Full report ────────────────────────────────────────────────────────────
  async getFull(days: number, instanceId?: string, agentId?: string) {
    const from = this.since(days);

    // Status distribution
    const statusRows: any[] = await this.ds
      .query(
        `
        SELECT status, COUNT(*) AS cnt
        FROM conversations
        WHERE created_at >= $1
        GROUP BY status
      `,
        [from],
      )
      .catch(() => []);

    const statusMap: Record<string, number> = {};
    for (const r of statusRows) statusMap[r.status] = Number(r.cnt);
    const statusDistribution = [
      {
        name: 'Abertas',
        value: statusMap['open'] ?? statusMap['livechat'] ?? 0,
      },
      { name: 'Fechadas', value: statusMap['closed'] ?? 0 },
      { name: 'Arquivadas', value: statusMap['archived'] ?? 0 },
    ];

    // Message type distribution
    const mediaRows: any[] = await this.ds
      .query(
        `
        SELECT type, COUNT(*) AS cnt
        FROM messages
        WHERE sent_at >= $1
        GROUP BY type
      `,
        [from],
      )
      .catch(() => []);

    const mediaMap: Record<string, number> = {};
    for (const r of mediaRows) mediaMap[r.type] = Number(r.cnt);
    const mediaDistribution = [
      { name: 'Texto', value: mediaMap['text'] ?? 0 },
      { name: 'Imagem', value: mediaMap['image'] ?? 0 },
      { name: 'Áudio', value: mediaMap['audio'] ?? 0 },
      { name: 'Documento', value: mediaMap['document'] ?? 0 },
    ];

    // Hourly activity
    const hourlyRows: any[] = await this.ds
      .query(
        `
        SELECT EXTRACT(HOUR FROM sent_at)::int AS hour, COUNT(*) AS cnt
        FROM messages
        WHERE sent_at >= $1
        GROUP BY hour ORDER BY hour
      `,
        [from],
      )
      .catch(() => []);
    const hourlyMap = new Map(
      hourlyRows.map((r) => [Number(r.hour), Number(r.cnt)]),
    );
    const hourlyActivity = Array.from({ length: 24 }, (_, h) => ({
      hour: `${h}h`,
      value: hourlyMap.get(h) ?? 0,
    }));

    // Weekday volume
    const weekdayRows: any[] = await this.ds
      .query(
        `
        SELECT EXTRACT(DOW FROM sent_at)::int AS dow, COUNT(*) AS cnt
        FROM messages
        WHERE sent_at >= $1
        GROUP BY dow ORDER BY dow
      `,
        [from],
      )
      .catch(() => []);
    const weekdayMap = new Map(
      weekdayRows.map((r) => [Number(r.dow), Number(r.cnt)]),
    );
    const weekdayVolume = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(
      (day, i) => ({
        day,
        value: weekdayMap.get(i) ?? 0,
      }),
    );

    // Agent performance from generic_records (team_members) joined with messages
    const teamRows: any[] = await this.ds
      .query(
        `SELECT data FROM generic_records WHERE collection = 'team_members'`,
      )
      .catch(() => []);

    const agentPerformance = await Promise.all(
      teamRows.map(async (row) => {
        const member = row.data;
        const userId = member.id || member.user_id;
        const [total, closed, avgRow] = await Promise.all([
          this.convRepo
            .createQueryBuilder('c')
            .where('c.assigned_user_id = :uid AND c.created_at >= :from', {
              uid: userId,
              from,
            })
            .getCount()
            .catch(() => 0),
          this.convRepo
            .createQueryBuilder('c')
            .where(
              "c.assigned_user_id = :uid AND c.status = 'closed' AND c.created_at >= :from",
              { uid: userId, from },
            )
            .getCount()
            .catch(() => 0),
          this.ds
            .query(
              `
              SELECT AVG(EXTRACT(EPOCH FROM (first_out.sent_at - first_in.sent_at)))/60 AS avg_min
              FROM (
                SELECT conversation_id, MIN(sent_at) AS sent_at FROM messages
                WHERE from_type='whatsapp' AND sent_at>=$1 GROUP BY conversation_id
              ) first_in
              JOIN (
                SELECT m.conversation_id, MIN(m.sent_at) AS sent_at FROM messages m
                JOIN conversations c2 ON c2.id=m.conversation_id
                WHERE m.from_type!='whatsapp' AND m.sent_at>=$1 AND c2.assigned_user_id=$2
                GROUP BY m.conversation_id
              ) first_out ON first_in.conversation_id=first_out.conversation_id
              WHERE first_out.sent_at>first_in.sent_at
            `,
              [from, userId],
            )
            .catch(() => [{ avg_min: null }]),
        ]);
        return {
          id: userId,
          name: member.name || member.email || userId,
          total,
          closed,
          avgResponseMinutes: Math.round(
            parseFloat(avgRow[0]?.avg_min ?? '0') || 0,
          ),
        };
      }),
    );

    return {
      statusDistribution,
      mediaDistribution,
      hourlyActivity,
      weekdayVolume,
      agentPerformance,
    };
  }
}

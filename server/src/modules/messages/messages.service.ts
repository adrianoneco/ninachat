import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../../entities/message.entity';
import { Conversation } from '../../entities/conversation.entity';
import { Contact } from '../../entities/contact.entity';
import { EventsGateway } from '../../ws/events.gateway';
import { WppManagerService } from '../instances/wpp-manager.service';

const logger = new Logger('MessagesService');

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private repo: Repository<Message>,
    @InjectRepository(Conversation) private convRepo: Repository<Conversation>,
    @InjectRepository(Contact) private contactRepo: Repository<Contact>,
    private readonly events: EventsGateway,
    private readonly wpp: WppManagerService,
  ) {}

  async findAll() {
    return this.repo.find();
  }

  async findByConversation(conversationId: string, limit = 50) {
    return this.repo.find({ where: { conversation_id: conversationId }, order: { created_at: 'ASC' }, take: limit });
  }

  async create(data: Partial<Message>) {
    const ent = this.repo.create({ ...data, created_at: new Date() } as any);
    const saved = await this.repo.save(ent);

    // If outbound message belongs to a conversation with an instance_id, send through WPP
    const direction = (data as any).direction || (data as any).from_type;
    const isOutbound = direction === 'outbound' || direction === 'user' || direction === 'nina';
    if (isOutbound && (data as any).conversation_id) {
      try {
        const conv = await this.convRepo.findOneBy({ id: (data as any).conversation_id } as any);
        if (conv && conv.instance_id && conv.contact_id) {
          const client = this.wpp.getClient(conv.instance_id);
          if (client) {
            // Resolve the WPP JID for sending.  conv.contact_id may already be
            // a JID (e.g. 5511999@c.us / 5511999@lid) or just digits.
            // Also try looking up the Contact record for the authoritative whatsapp_id.
            let to = conv.contact_id;
            try {
              const ct = await this.contactRepo.findOneBy({ whatsapp_id: conv.contact_id } as any)
                      || await this.contactRepo.findOneBy({ phone_number: conv.contact_id } as any);
              if (ct?.whatsapp_id) to = ct.whatsapp_id;
            } catch { /* use conv.contact_id as-is */ }
            // Ensure the JID has a suffix WPP expects
            if (to && !to.includes('@')) to = `${to}@c.us`;

            const content = (data as any).content || '';
            const type = ((data as any).type || 'text').toLowerCase();
            const mediaUrl = (data as any).media_url || (data as any).mediaUrl || null;
            const payload = (data as any).payload;

            if (type === 'text' && content) {
              await this.wpp.sendMessage(conv.instance_id, to, content);
              logger.log(`[WPP] sent text to ${to}`);
            } else if (['image', 'video', 'audio', 'media', 'file'].includes(type) && (mediaUrl || payload?.attachments?.[0]?.url)) {
              const url = mediaUrl || payload.attachments[0].url;
              const filename = payload?.attachments?.[0]?.name || 'file';
              const caption = content || '';
              await this.wpp.sendMedia(conv.instance_id, to, url, filename, caption);
              logger.log(`[WPP] sent media to ${to}`);
            } else if (content) {
              // fallback: send as text
              await this.wpp.sendMessage(conv.instance_id, to, content);
              logger.log(`[WPP] sent text (fallback) to ${to}`);
            }
          }
        }
      } catch (e) {
        logger.warn(`[WPP] failed sending outbound message: ${String(e)}`);
        // Update message status to 'failed' so frontend knows
        try {
          (saved as any).status = 'failed';
          await this.repo.save(saved as any);
        } catch (_) {}
      }
    }

    this.events.emit('message:created', saved);
    return saved;
  }

  async update(id: string, data: Partial<Message>) {
    const existing = await this.repo.findOneBy({ id } as any);
    if (!existing) {
      await this.repo.update(id, data as any);
      const updated = await this.repo.findOneBy({ id } as any);
      this.events.emit('message:updated', updated);
      return updated;
    }

    // Track edit history when content changes
    if ((data as any).content !== undefined && (data as any).content !== existing.content) {
      const prevEdits = Array.isArray((existing as any).edits) ? [...(existing as any).edits] : [];
      prevEdits.push({
        content: existing.content,
        edited_at: (existing as any).edited_at || (existing as any).created_at || new Date().toISOString(),
      });
      (data as any).edits = prevEdits;
      (data as any).edited_at = new Date().toISOString();
    }

    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id' && value !== undefined) {
        (existing as any)[key] = value;
      }
    }
    const saved = await this.repo.save(existing as any);
    this.events.emit('message:updated', saved);
    return saved;
  }

  async remove(id: string) {
    await this.repo.delete(id);
    this.events.emit('message:deleted', { id });
  }

  /** Mark all inbound messages in a conversation as read */
  async markAsRead(conversationId: string) {
    const result = await this.repo
      .createQueryBuilder()
      .update()
      .set({ status: 'read', read_at: () => 'NOW()' } as any)
      .where('conversation_id = :conversationId', { conversationId })
      .andWhere("direction = 'inbound' OR from_type = 'whatsapp'")
      .andWhere("status != 'read'")
      .execute();
    if (result.affected && result.affected > 0) {
      this.events.emit('messages:read', { conversationId, count: result.affected });
    }
    return { updated: result.affected || 0 };
  }

  /** Forward a message to another conversation */
  async forward(messageId: string, targetConversationId: string) {
    const original = await this.repo.findOneBy({ id: messageId } as any);
    if (!original) throw new Error('Message not found');
    const forwarded = this.repo.create({
      conversation_id: targetConversationId,
      content: original.content,
      media_url: (original as any).media_url,
      media_type: (original as any).media_type,
      type: original.type,
      direction: 'outbound',
      from_type: 'user',
      status: 'sent',
      metadata: { forwarded_from: messageId },
      created_at: new Date(),
    } as any);
    const saved = await this.repo.save(forwarded as any);

    // If target conversation has an active WPP instance, send through it
    try {
      const conv = await this.convRepo.findOneBy({ id: targetConversationId } as any);
      if (conv && conv.instance_id && conv.contact_id && original.content) {
        const client = this.wpp.getClient(conv.instance_id);
        if (client) {
          await this.wpp.sendMessage(conv.instance_id, conv.contact_id, original.content);
        }
      }
    } catch (e) {
      logger.warn(`[WPP] forward send failed: ${String(e)}`);
    }

    this.events.emit('message:created', saved);
    return saved;
  }
}

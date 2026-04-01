import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../../entities/message.entity';
import { Conversation } from '../../entities/conversation.entity';
import { Contact } from '../../entities/contact.entity';
import { EventsGateway } from '../../ws/events.gateway';
import { WppManagerService } from '../instances/wpp-manager.service';
import { StorageService } from '../storage/storage.service';

const logger = new Logger('MessagesService');

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private repo: Repository<Message>,
    @InjectRepository(Conversation) private convRepo: Repository<Conversation>,
    @InjectRepository(Contact) private contactRepo: Repository<Contact>,
    private readonly events: EventsGateway,
    private readonly wpp: WppManagerService,
    private readonly storageService: StorageService,
  ) {}

  async findAll() {
    return this.repo.find();
  }

  async findByConversation(conversationId: string, limit = 50) {
    return this.repo.find({ where: { conversation_id: conversationId }, order: { created_at: 'ASC' }, take: limit });
  }

  async create(data: Partial<Message>) {
    // If outbound media_url is a data URL, upload to MinIO first
    const rawMediaUrl = (data as any).media_url || (data as any).mediaUrl || null;
    if (rawMediaUrl && typeof rawMediaUrl === 'string' && rawMediaUrl.startsWith('data:')) {
      try {
        const fileName = `outbound_${Date.now()}`;
        const storageFile = await this.storageService.uploadFromDataUrl(
          rawMediaUrl,
          fileName,
          undefined,
          (data as any).conversation_id,
        );
        (data as any).media_url = `/api/storage/${storageFile.id}/url`;
        logger.log(`[create] uploaded outbound media to MinIO: ${storageFile.s3_key}`);
      } catch (e) {
        logger.warn(`[create] failed uploading outbound media to MinIO: ${String(e)}`);
      }
    }

    const ent = this.repo.create({ ...data, created_at: new Date() } as any);
    const saved = await this.repo.save(ent);

    // If outbound message belongs to a conversation with an instance_id, send through WPP
    const direction = (data as any).direction || (data as any).from_type;
    const isOutbound = direction === 'outbound' || direction === 'user' || direction === 'livechat';
    if (isOutbound && (data as any).conversation_id) {
      try {
        const conv = await this.convRepo.findOneBy({ id: (data as any).conversation_id } as any);
        if (conv && conv.instance_id && conv.contact_id) {
          const client = this.wpp.getClient(conv.instance_id);
          if (client) {
            // Resolve the WPP JID for sending.
            // conv.contact_id may be a UUID (preferred), a JID, or digits.
            let to = conv.contact_id;
            try {
              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
              let ct: any = null;
              if (uuidRegex.test(conv.contact_id!)) {
                // contact_id is the contacts.id UUID — resolve directly
                ct = await this.contactRepo.findOneBy({ id: conv.contact_id } as any);
              } else {
                // legacy JID / digits fallback
                ct = await this.contactRepo.findOneBy({ whatsapp_id: conv.contact_id } as any)
                  || await this.contactRepo.findOneBy({ phone_number: conv.contact_id } as any);
              }
              if (ct?.whatsapp_id) to = ct.whatsapp_id;
            } catch { /* use conv.contact_id as-is */ }
            // Ensure the JID has a suffix WPP expects — but ONLY if not already a JID
            if (to && !to.includes('@')) to = `${to}@c.us`;

            const content = (data as any).content || '';
            const type = ((data as any).type || 'text').toLowerCase();
            const mediaUrl = (data as any).media_url || (data as any).mediaUrl || null;
            const payload = (data as any).payload;

            if (type === 'sticker' && (mediaUrl || payload?.attachments?.[0]?.url)) {
              const url = mediaUrl || payload.attachments[0].url;
              await this.wpp.sendSticker(conv.instance_id, to, url);
              logger.log(`[WPP] sent sticker to ${to}`);
            } else if (['image', 'video', 'audio', 'media', 'file'].includes(type) && (mediaUrl || payload?.attachments?.[0]?.url)) {
              const url = mediaUrl || payload.attachments[0].url;
              const filename = payload?.attachments?.[0]?.name || 'file';
              const caption = content || '';
              await this.wpp.sendMedia(conv.instance_id, to, url, filename, caption);
              logger.log(`[WPP] sent ${type} to ${to}`);
            } else if (type === 'text' && content) {
              await this.wpp.sendMessage(conv.instance_id, to, content);
              logger.log(`[WPP] sent text to ${to}`);
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
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          let fwdTo = conv.contact_id;
          const fwdCt: any = uuidRegex.test(conv.contact_id!)
            ? await this.contactRepo.findOneBy({ id: conv.contact_id } as any)
            : (await this.contactRepo.findOneBy({ whatsapp_id: conv.contact_id } as any)
               || await this.contactRepo.findOneBy({ phone_number: conv.contact_id } as any));
          if (fwdCt?.whatsapp_id) fwdTo = fwdCt.whatsapp_id;
          if (fwdTo && !fwdTo.includes('@')) fwdTo = `${fwdTo}@c.us`;
          await this.wpp.sendMessage(conv.instance_id, fwdTo, original.content);
        }
      }
    } catch (e) {
      logger.warn(`[WPP] forward send failed: ${String(e)}`);
    }

    this.events.emit('message:created', saved);
    return saved;
  }
}

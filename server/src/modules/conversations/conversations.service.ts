import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../../entities/conversation.entity';
import { EventsGateway } from '../../ws/events.gateway';
import { Contact } from '../../entities/contact.entity';
import { Message } from '../../entities/message.entity';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation) private repo: Repository<Conversation>,
    @InjectRepository(Contact) private contactRepo: Repository<Contact>,
    @InjectRepository(Message) private msgRepo: Repository<Message>,
    private readonly events: EventsGateway,
  ) {}

  async findAll() {
    // Return conversations enriched with contact info and messages so the frontend can render
    const convs = await this.repo.find();
    const out: any[] = [];
    for (const conv of convs) {
      // Determine identifier priority: conversations.user first (as frontend expects), then metadata.user, then remoteJid
      const convUser = (conv as any).user || null;
      const metaUser = (conv as any).metadata?.user || null;
      const remoteJid = (conv as any).remoteJid || null;

      let contact: Contact | null = null;
      try {
        // Primary rule: match contacts where lid = conversations.user OR serialized = conversations.user
        if (convUser) {
          contact = await this.contactRepo.findOne({ where: [{ lid: convUser }, { serialized: convUser }] } as any);
        }

        // Secondary: try metadata.user if no match
        if (!contact && metaUser) {
          contact = await this.contactRepo.findOne({ where: [{ lid: metaUser }, { serialized: metaUser }] } as any);
        }

        // Tertiary: try remoteJid
        if (!contact && remoteJid) {
          contact = await this.contactRepo.findOne({ where: [{ lid: remoteJid }, { serialized: remoteJid }] } as any);
        }

        // fallback: try to match by phone stored in metadata
        if (!contact && conv.metadata && conv.metadata.phone) {
          contact = await this.contactRepo.findOneBy({ phone: conv.metadata.phone } as any);
        }
      } catch (e) {
        // ignore lookup errors
      }

      // load messages for this conversation (ascending)
      let messages: any[] = [];
      try {
        messages = await this.msgRepo.find({ where: { conversation_id: conv.id } as any, order: { created_at: 'ASC' } });
      } catch (e) {}

      // derive some UI-friendly fields
      const lastMsg = messages.length ? messages[messages.length - 1] : null;
      const transformedMessages = messages.map(m => ({
        id: m.id,
        content: m.body || '',
        timestamp: m.created_at,
        direction: m.from === conv.lid ? 'outgoing' : 'incoming',
        type: 'text',
        raw: m,
      }));

      out.push({
        ...conv,
        contact: contact || null,
        contactId: contact?.id || null,
        contactName: contact?.name || (conv.metadata && conv.metadata.title) || null,
        contactPhone: contact?.phone || null,
        contactAvatar: ((): string | null => {
          const avatarName = contact?.name || 'U';
          const pic = (contact as any)?.picture_url || (contact as any)?.profile_picture_url || null;
          return pic || (contact ? null : `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarName)}&background=0ea5e9&color=fff`);
        })(),
        lastMessage: lastMsg ? (lastMsg.body || '') : '',
        lastMessageTime: lastMsg ? lastMsg.created_at : conv.created_at,
        unreadCount: 0,
        messages: transformedMessages,
      });
    }

    return out;
  }

  async create(data: Partial<Conversation>) {
    // Ensure `user` is present (DB enforces NOT NULL). Prefer provided user, then metadata.user, then metadata.phone, then a fallback.
    const userVal = (data as any).user || (data as any).metadata?.user || (data as any).metadata?.phone || `unknown:${Date.now()}`;
    const ent = this.repo.create({ ...data, user: userVal, created_at: new Date() } as any);
    const saved = await this.repo.save(ent);
    this.events.emit('conversation:created', saved);
    return saved;
  }

  async update(id: string, data: Partial<Conversation>) {
    await this.repo.update(id, data as any);
    const updated = await this.repo.findOneBy({ id } as any);
    this.events.emit('conversation:updated', updated);
    return updated;
  }

  async remove(id: string) {
    await this.repo.delete(id);
    this.events.emit('conversation:deleted', { id });
  }
}

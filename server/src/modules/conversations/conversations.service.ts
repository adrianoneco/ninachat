
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../../entities/conversation.entity';
import { Contact } from '../../entities/contact.entity';
import { Message } from '../../entities/message.entity';
import { EventsGateway } from '../../ws/events.gateway';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation) private repo: Repository<Conversation>,
    @InjectRepository(Contact) private contactRepo: Repository<Contact>,
    @InjectRepository(Message) private messageRepo: Repository<Message>,
    private readonly events: EventsGateway,
  ) {}

  /**
   * Return a pooled payload containing conversations, recent messages and contact online status.
   * Optimized to avoid N+1 queries by loading contact via join.
   */
  async pool(limitPerConversation = 50): Promise<any[]> {
    const convs = await this.repo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.contact', 'contact')
      .orderBy('c.updated_at', 'DESC')
      .getMany();
    
    if (convs.length === 0) return [];

    // Fetch all messages for these conversations in bulk
    const convIds = convs.map(c => c.id);
    let allMessages: any[] = [];
    if (convIds.length > 0) {
      allMessages = await this.messageRepo
        .createQueryBuilder('m')
        .where('m.conversation_id IN (:...ids)', { ids: convIds })
        .orderBy('m.sent_at', 'DESC')
        .getMany();
    }

    // Group messages by conversation_id
    const msgsByConv = new Map<string, any[]>();
    for (const m of allMessages) {
      const cid = (m as any).conversation_id;
      if (!msgsByConv.has(cid)) msgsByConv.set(cid, []);
      msgsByConv.get(cid)!.push(m);
    }

    const result: any[] = [];
    for (const c of convs) {
      const contact = c.contact || null;
      let msgs = msgsByConv.get(c.id) || [];
      // Take only limitPerConversation most recent, then reverse to chronological
      msgs = msgs.slice(0, limitPerConversation).reverse();

      // Count unread inbound messages
      const unreadCount = (msgsByConv.get(c.id) || []).filter(
        (m: any) => (m.direction === 'inbound' || m.from_type === 'whatsapp') && m.status !== 'read'
      ).length;

      result.push({
        ...c,
        contact: contact || null,
        messages: msgs,
        client_memory: contact?.client_memory || c.client_memory || null,
        notes: c.notes || contact?.notes || null,
        unread_count: unreadCount,
      });
    }
    return result;
  }

  async getOrCreateActiveConversation(contact_id: string, data: Partial<Conversation> = {}): Promise<Conversation> {
    let conversation = await this.repo.findOne({ where: { contact_id, is_active: true } });
    if (conversation) return conversation;
    const ent = this.repo.create({ livechat_context: {}, metadata: {}, ...data, contact_id, is_active: true });
    const saved = await this.repo.save(ent);
    this.events.emit('conversation:created', saved);
    return saved;
  }

  async findAll(): Promise<any[]> {
    const convs = await this.repo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.contact', 'contact')
      .orderBy('c.updated_at', 'DESC')
      .getMany();
    
    return convs.map(c => ({ ...c, contact: c.contact || null }));
  }

  async createOrUpdate(data: any) {
    // Strip fields that aren't real DB columns to prevent TypeORM errors
    const { contact, ...cleanData } = data;

    // Ensure NOT NULL JSONB columns never receive explicit null (TypeORM passes null
    // which overrides the DB-level DEFAULT, causing a NOT NULL constraint violation)
    const jsonbNotNullCols = ['livechat_context', 'metadata'] as const;
    for (const col of jsonbNotNullCols) {
      if (cleanData[col] == null) cleanData[col] = {};
    }

    if (cleanData.id) {
      // Try to find existing
      const existing = await this.repo.findOneBy({ id: cleanData.id } as any);
      if (existing) {
        // Merge only defined fields to avoid nullifying existing values
        for (const [key, value] of Object.entries(cleanData)) {
          if (key !== 'id' && value !== undefined) {
            (existing as any)[key] = value;
          }
        }
        const saved = await this.repo.save(existing as any);
        const resolvedContact = await this.resolveContact(saved.contact_id);
        const result = { ...saved, contact: resolvedContact || null };
        this.events.emit('conversation:updated', result);
        return result;
      }
    }

    // Create new
    const ent = this.repo.create(cleanData as any);
    const saved = await this.repo.save(ent as any);
    const resolvedContact = await this.resolveContact(saved.contact_id);

    // Auto-create contact if provided in data and doesn't exist yet
    if (contact && saved.contact_id && !resolvedContact) {
      try {
        const newContact = this.contactRepo.create({
          name: contact.name || null,
          phone_number: contact.phone_number || saved.contact_id,
          whatsapp_id: contact.phone_number || saved.contact_id,
          profile_picture_url: contact.profile_picture_url || null,
          email: contact.email || null,
        } as any);
        await this.contactRepo.save(newContact);
      } catch (e) {
        // contact may already exist
      }
    }

    const result = { ...saved, contact: resolvedContact || contact || null };
    this.events.emit('conversation:created', result);
    return result;
  }

  /** Resolve a contact by whatsapp_id, phone_number, or digits-only fallback */
  private async resolveContact(contactId?: string): Promise<Contact | null> {
    if (!contactId) return null;
    try {
      const digits = contactId.replace(/@.*$/, '');
      return (
        (await this.contactRepo.findOneBy({ whatsapp_id: contactId } as any)) ||
        (await this.contactRepo.findOneBy({ phone_number: contactId } as any)) ||
        (digits !== contactId ? (await this.contactRepo.findOneBy({ phone_number: digits } as any)) : null) ||
        null
      );
    } catch {
      return null;
    }
  }
}

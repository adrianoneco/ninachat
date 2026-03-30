import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
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
    // Use LEFT JOIN to get contact info when contact_id exists
    const convs = await this.repo.find({
      relations: ['contact'],
      order: { last_message_at: 'DESC' }
    });

    const out: any[] = [];
    for (const conv of convs) {
      // The contact should already be loaded via relations
      let contact = (conv as any).contact || null;

      // load messages for this conversation (ascending)
      let messages: any[] = [];
      try {
        messages = await this.msgRepo.find({ where: { conversation_id: conv.id } as any, order: { created_at: 'ASC' } });
      } catch (e) {}

      // If no contact linked, try to find via messages "from" field
      if (!contact && messages.length > 0) {
        const fromField = messages[0]?.from;
        if (fromField) {
          try {
            // Try to find contact by lid or serialized (both store WhatsApp ID)
            contact = await this.contactRepo.findOne({ where: [{ lid: fromField }, { serialized: fromField }] } as any) || null;
          } catch (e) { /* ignore */ }
        }
      }

      // Still no contact? Try to find by looking at all contacts' serialized field
      // which contains the WhatsApp ID (format: 5541xxxx@c.us or xxx@lid)
      if (!contact) {
        try {
          // Get all contacts and try to match - this is a fallback approach
          const allContacts = await this.contactRepo.find();
          // Try to find contact where serialized matches any message from field
          const fromField = messages[0]?.from;
          if (fromField) {
            contact = allContacts.find((c: any) => 
              c.serialized === fromField || c.lid === fromField || c.whatsapp_id === fromField
            ) || null;
          }
        } catch (e) { /* ignore */ }
      }

      // derive some UI-friendly fields
      const lastMsg = messages.length ? messages[messages.length - 1] : null;
      const transformedMessages = messages.map(m => ({
        id: m.id,
        content: m.content || m.body || '',
        timestamp: m.created_at,
        direction: m.from_type === 'nina' || m.direction === 'outbound' ? 'outgoing' : 'incoming',
        type: m.type || 'text',
        raw: m,
      }));

      // Get profile picture URL - check multiple possible field names
      const profilePicUrl = (contact as any)?.profile_picture_url || (contact as any)?.picture_url || null;
      const contactName = contact?.name || (contact as any)?.call_name || null;
      const avatarUrl = profilePicUrl || (contactName ? `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName)}&background=0ea5e9&color=fff` : null);

      out.push({
        ...conv,
        contact: contact || null,
        contactId: contact?.id || conv.contact_id || null,
        contactName: contactName || (conv.metadata && conv.metadata.title) || null,
        contactPhone: contact?.phone || (contact as any)?.phone_number || null,
        contactAvatar: avatarUrl,
        lastMessage: lastMsg ? (lastMsg.content || lastMsg.body || '') : '',
        lastMessageTime: lastMsg ? lastMsg.created_at : conv.last_message_at || conv.created_at,
        unreadCount: 0,
        messages: transformedMessages,
      });
    }

    return out;
  }

  async create(data: Partial<Conversation>) {
    // Create a new conversation, optionally linking to a contact
    // If metadata contains contact info (from WhatsApp), try to find or create the contact
    let contactId = (data as any).contact_id;
    
    // If no contact_id but we have contact info in metadata, try to find existing contact
    if (!contactId && (data as any).metadata) {
      const phone = (data as any).metadata?.phone;
      const userId = (data as any).metadata?.user;
      const serialized = (data as any).metadata?.serialized;
      const lid = (data as any).metadata?.lid;
      
      if (phone || userId || serialized || lid) {
        try {
          // Try to find existing contact by various identifiers
          const contact = await this.contactRepo.findOne({
            where: [
              { phone_number: phone } as any,
              { whatsapp_id: userId } as any,
              { serialized: serialized } as any,
              { lid: lid } as any
            ]
          } as any);
          if (contact) {
            contactId = contact.id;
          }
        } catch (e) {
          // Ignore lookup errors
        }
      }
    }
    
    const convData = {
      ...data,
      contact_id: contactId || null,
      started_at: new Date(),
      last_message_at: new Date(),
    };
    
    const ent = this.repo.create(convData as any);
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

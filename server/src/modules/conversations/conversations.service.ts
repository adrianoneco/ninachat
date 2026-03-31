import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../../entities/conversation.entity';
import { Contact } from '../../entities/contact.entity';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation) private repo: Repository<Conversation>,
    @InjectRepository(Contact) private contactRepo: Repository<Contact>,
  ) {}

  async findAll(): Promise<any[]> {
    const convs = await this.repo.find({ order: { updated_at: 'DESC' } });
    const result: any[] = [];
    for (const c of convs) {
      const contact = c.contact_id ? (await this.contactRepo.findOneBy({ whatsapp_id: c.contact_id } as any)) || (await this.contactRepo.findOneBy({ phone_number: c.contact_id } as any)) : null;
      result.push({ ...c, contact: contact || null });
    }
    return result;
  }

  async createOrUpdate(data: any) {
    if (data.id) {
      await this.repo.update(data.id, data as any);
      const updated = await this.repo.findOneBy({ id: data.id } as any);
      const contact = updated?.contact_id ? (await this.contactRepo.findOneBy({ whatsapp_id: updated.contact_id } as any)) || (await this.contactRepo.findOneBy({ phone_number: updated.contact_id } as any)) : null;
      return { ...updated, contact: contact || null };
    }
    const ent = this.repo.create(data as any);
    const saved = await this.repo.save(ent as any);
    const contact = saved.contact_id ? (await this.contactRepo.findOneBy({ whatsapp_id: saved.contact_id } as any)) || (await this.contactRepo.findOneBy({ phone_number: saved.contact_id } as any)) : null;
    return { ...saved, contact: contact || null };
  }
}

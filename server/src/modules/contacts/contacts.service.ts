import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from '../../entities/contact.entity';
import { EventsGateway } from '../../ws/events.gateway';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact) private repo: Repository<Contact>,
    private readonly events: EventsGateway,
  ) {}

  async findAll() {
    return this.repo.find();
  }

  async create(data: Partial<Contact>) {
    const ent = this.repo.create(data as any);
    const saved = await this.repo.save(ent);
    console.log('[CONTACT]', saved);
    this.events.emit('contact:created', saved);
    return saved;
  }

  async update(id: string, data: Partial<Contact>) {
    await this.repo.update(id, data as any);
    const updated = await this.repo.findOneBy({ id } as any);
    console.log('[CONTACT]', updated);
    this.events.emit('contact:updated', updated);
    return updated;
  }

  async remove(id: string) {
    await this.repo.delete(id);
    console.log('[CONTACT] Deleted', { id });

    this.events.emit('contact:deleted', { id });
  }
}

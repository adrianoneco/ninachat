import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../../entities/message.entity';
import { EventsGateway } from '../../ws/events.gateway';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private repo: Repository<Message>,
    private readonly events: EventsGateway,
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
    this.events.emit('message:created', saved);
    return saved;
  }

  async update(id: string, data: Partial<Message>) {
    await this.repo.update(id, data as any);
    const updated = await this.repo.findOneBy({ id } as any);
    this.events.emit('message:updated', updated);
    return updated;
  }

  async remove(id: string) {
    await this.repo.delete(id);
    this.events.emit('message:deleted', { id });
  }
}

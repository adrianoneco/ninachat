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
    return this.repo.find({ order: { updated_at: 'DESC' } });
  }

  /**
   * Create or upsert a contact.
   * The frontend POSTs for both creates and updates, so we handle both cases.
   * Field mapping: frontend may send `phone` or `phone_number`, `blocked` or `is_blocked`.
   */
  async create(data: any) {
    // Normalize field names from frontend format to entity format
    const normalized = this.normalizeFields(data);

    // If id is provided, try to find and update
    if (normalized.id) {
      const existing = await this.repo.findOneBy({ id: normalized.id } as any);
      if (existing) {
        for (const [key, value] of Object.entries(normalized)) {
          if (key !== 'id' && value !== undefined) {
            (existing as any)[key] = value;
          }
        }
        const saved = await this.repo.save(existing);
        this.events.emit('contact:updated', saved);
        return saved;
      }
    }

    // Try to find by phone_number to avoid duplicates
    if (normalized.phone_number) {
      const digits = String(normalized.phone_number).replace(/\D/g, '');
      const byPhone = await this.repo
        .createQueryBuilder('c')
        .where("REPLACE(REPLACE(REPLACE(c.phone_number, '+', ''), '-', ''), ' ', '') = :digits", { digits })
        .getOne();
      if (byPhone) {
        for (const [key, value] of Object.entries(normalized)) {
          if (key !== 'id' && value !== undefined) {
            (byPhone as any)[key] = value;
          }
        }
        const saved = await this.repo.save(byPhone);
        this.events.emit('contact:updated', saved);
        return saved;
      }
    }

    // Try by whatsapp_id
    if (normalized.whatsapp_id) {
      const byWa = await this.repo.findOneBy({ whatsapp_id: normalized.whatsapp_id } as any);
      if (byWa) {
        for (const [key, value] of Object.entries(normalized)) {
          if (key !== 'id' && value !== undefined) {
            (byWa as any)[key] = value;
          }
        }
        const saved = await this.repo.save(byWa);
        this.events.emit('contact:updated', saved);
        return saved;
      }
    }

    // Ensure whatsapp_id is set (required column)
    if (!normalized.whatsapp_id) {
      normalized.whatsapp_id = normalized.phone_number || normalized.id || '';
    }

    // Create new contact
    const ent = this.repo.create(normalized as any);
    const saved = await this.repo.save(ent);
    this.events.emit('contact:created', saved);
    return saved;
  }

  async update(id: string, data: Partial<Contact>) {
    const normalized = this.normalizeFields({ ...data, id });
    const existing = await this.repo.findOneBy({ id } as any);
    if (existing) {
      for (const [key, value] of Object.entries(normalized)) {
        if (key !== 'id' && value !== undefined) {
          (existing as any)[key] = value;
        }
      }
      const saved = await this.repo.save(existing);
      this.events.emit('contact:updated', saved);
      return saved;
    }
    await this.repo.update(id, normalized as any);
    const updated = await this.repo.findOneBy({ id } as any);
    this.events.emit('contact:updated', updated);
    return updated;
  }

  async remove(id: string) {
    await this.repo.delete(id);
    this.events.emit('contact:deleted', { id });
  }

  /** Map frontend field names to entity column names */
  private normalizeFields(data: any): any {
    const result = { ...data };

    // phone -> phone_number
    if (result.phone && !result.phone_number) {
      result.phone_number = result.phone;
    }
    delete result.phone;

    // blocked -> is_blocked
    if (result.blocked !== undefined && result.is_blocked === undefined) {
      result.is_blocked = result.blocked;
      if (result.is_blocked) {
        result.blocked_at = result.blocked_at || new Date();
      }
    }
    delete result.blocked;

    // lastContact -> last_activity
    if (result.lastContact && !result.last_activity) {
      result.last_activity = new Date(result.lastContact);
    }
    delete result.lastContact;

    // status field from frontend is lead/customer/churned — store in tags or ignore
    // (the entity doesn't have a status column, so remove it to avoid errors)
    delete result.status;

    // Remove _rid from generic record system if present
    delete result._rid;

    return result;
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GenericRecord } from '../../entities/generic-record.entity';
import { randomUUID } from 'crypto';

@Injectable()
export class GenericCrudService {
  constructor(
    @InjectRepository(GenericRecord)
    private repo: Repository<GenericRecord>,
  ) {}

  async findAll(
    collection: string,
    query?: Record<string, string>,
  ): Promise<any[]> {
    const records = await this.repo.find({
      where: { collection },
      order: { updated_at: 'DESC' },
    });
    let results = records.map((r) => ({ ...r.data, _rid: r.id }));

    // Apply simple query filtering (e.g. ?deal_id=xxx or ?user_id=xxx)
    if (query) {
      for (const [key, val] of Object.entries(query)) {
        if (!val || key === 'collection') continue;
        results = results.filter((r: any) => String(r[key]) === String(val));
      }
    }
    return results;
  }

  async upsert(collection: string, data: any): Promise<any> {
    const recordId = data.id || data.record_id;
    if (!recordId) {
      // Create new record without client-provided id
      const newId = randomUUID();
      const ent = this.repo.create({
        collection,
        record_id: newId,
        data: { ...data, id: newId },
      });
      const saved = await this.repo.save(ent);
      return { ...saved.data, _rid: saved.id };
    }

    // Check if record exists
    const existing = await this.repo.findOneBy({
      collection,
      record_id: String(recordId),
    });

    if (existing) {
      // Merge data
      existing.data = { ...existing.data, ...data };
      const saved = await this.repo.save(existing);
      return { ...saved.data, _rid: saved.id };
    }

    // Create new
    const ent = this.repo.create({
      collection,
      record_id: String(recordId),
      data,
    });
    const saved = await this.repo.save(ent);
    return { ...saved.data, _rid: saved.id };
  }

  async remove(collection: string, recordId: string): Promise<void> {
    await this.repo.delete({ collection, record_id: recordId });
  }
}

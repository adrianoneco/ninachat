import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TagDefinition } from '../../entities/tag-definition.entity';
import { NinaSettings } from '../../entities/nina-settings.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(TagDefinition) private tagRepo: Repository<TagDefinition>,
    @InjectRepository(NinaSettings) private ninaRepo: Repository<NinaSettings>,
  ) {}

  // ─── Tag Definitions ──────────────────────────────
  async findAllTags(): Promise<TagDefinition[]> {
    return this.tagRepo.find({ order: { created_at: 'ASC' } });
  }

  async upsertTag(data: Partial<TagDefinition>) {
    if (data.id) {
      const existing = await this.tagRepo.findOneBy({ id: data.id });
      if (existing) {
        Object.assign(existing, data);
        return this.tagRepo.save(existing);
      }
    }
    // Check by key to avoid duplicates
    if (data.key) {
      const byKey = await this.tagRepo.findOneBy({ key: data.key });
      if (byKey) {
        Object.assign(byKey, data);
        return this.tagRepo.save(byKey);
      }
    }
    const ent = this.tagRepo.create(data as any);
    return this.tagRepo.save(ent);
  }

  async removeTag(id: string): Promise<void> {
    await this.tagRepo.delete(id);
  }

  // ─── Nina Settings ────────────────────────────────
  async getNinaSettings() {
    const row = await this.ninaRepo.findOne({ where: {} });
    if (row) return row;
    const defaults = this.ninaRepo.create({ is_active: true } as any);
    return this.ninaRepo.save(defaults as any);
  }

  async updateNinaSettings(data: Partial<NinaSettings>) {
    const current = await this.getNinaSettings();
    Object.assign(current, data);
    return this.ninaRepo.save(current as any);
  }
}

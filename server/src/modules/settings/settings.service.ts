import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TagDefinition } from '../../entities/tag-definition.entity';
import { LiveChatSettings } from '../../entities/livechat-settings.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(TagDefinition) private tagRepo: Repository<TagDefinition>,
    @InjectRepository(LiveChatSettings) private livechatRepo: Repository<LiveChatSettings>,
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

  // ─── LiveChat Settings ────────────────────────────────
  async getLiveChatSettings() {
    const row = await this.livechatRepo.findOne({ where: {} });
    if (row) return row;
    const defaults = this.livechatRepo.create({ is_active: true } as any);
    return this.livechatRepo.save(defaults as any);
  }

  async updateLiveChatSettings(data: Partial<LiveChatSettings>) {
    const current = await this.getLiveChatSettings();
    Object.assign(current, data);
    return this.livechatRepo.save(current as any);
  }
}

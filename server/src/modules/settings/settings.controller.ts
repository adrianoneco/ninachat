import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller()
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  // ─── Tag Definitions ──────────────────────────────
  @Get('tag_definitions')
  listTags() {
    return this.svc.findAllTags();
  }

  @Post('tag_definitions')
  upsertTag(@Body() body: any) {
    return this.svc.upsertTag(body);
  }

  @Delete('tag_definitions/:id')
  removeTag(@Param('id') id: string) {
    return this.svc.removeTag(id);
  }

  // ─── Nina Settings ────────────────────────────────
  @Get('nina_settings')
  getNinaSettings() {
    return this.svc.getNinaSettings();
  }

  @Post('nina_settings')
  updateNinaSettings(@Body() body: any) {
    return this.svc.updateNinaSettings(body);
  }

  // ─── Company (alias for settings) ─────────────────
  @Get('company')
  getCompany() {
    // lightweight placeholder – real company data could come from nina_settings or a future entity
    return { id: 'company-1', name: 'Minha Empresa', logo: null };
  }
}

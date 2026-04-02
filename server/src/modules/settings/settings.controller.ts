import { Controller, Get, Post, Delete, Body, Param, Res } from '@nestjs/common';
import express from 'express';
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

  // ─── LiveChat Settings ────────────────────────────────
  @Get('livechat_settings')
  async getLiveChatSettings(@Res() res: express.Response) {
    const data = await this.svc.getLiveChatSettings();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    return res.json(data);
  }

  @Post('livechat_settings')
  updateLiveChatSettings(@Body() body: any) {
    return this.svc.updateLiveChatSettings(body);
  }

  // ─── Company (alias for settings) ─────────────────
  @Get('company')
  getCompany() {
    // lightweight placeholder – real company data could come from livechat_settings or a future entity
    return { id: 'company-1', name: 'Minha Empresa', logo: null };
  }
}

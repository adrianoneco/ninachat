
import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly svc: ConversationsService) {}

  @Get('active')
  async getActive(@Query('contact_id') contact_id: string) {
    return this.svc.getOrCreateActiveConversation(contact_id);
  }

  @Get('pool')
  async pool(@Query('limit') limit?: string) {
    const l = limit ? parseInt(limit, 10) : 50;
    return this.svc.pool(l);
  }

  @Get()
  async list() {
    return this.svc.findAll();
  }

  @Post()
  async create(@Body() body: any) {
    return this.svc.createOrUpdate(body);
  }
}

export default ConversationsController;

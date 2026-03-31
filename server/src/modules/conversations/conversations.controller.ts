import { Controller, Get, Post, Body } from '@nestjs/common';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly svc: ConversationsService) {}

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

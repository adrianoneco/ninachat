import { Controller, Get, Post, Body, Param, Put, Delete, Query } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto, UpdateMessageDto } from './dto';

@Controller('messages')
export class MessagesController {
  constructor(private readonly svc: MessagesService) {}

  @Get()
  async list(@Query('conversation_id') conversation_id?: string) {
    if (conversation_id) return this.svc.findByConversation(conversation_id, 100);
    return this.svc.findAll();
  }

  @Post()
  async create(@Body() body: CreateMessageDto) {
    return this.svc.create(body as any);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}

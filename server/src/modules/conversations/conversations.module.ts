import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from '../../entities/conversation.entity';
import { Contact } from '../../entities/contact.entity';
import { Message } from '../../entities/message.entity';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { EventsGateway } from '../../ws/events.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Contact, Message])],
  providers: [ConversationsService, EventsGateway],
  controllers: [ConversationsController],
  exports: [ConversationsService],
})
export class ConversationsModule {}

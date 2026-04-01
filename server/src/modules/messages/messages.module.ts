import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../../entities/message.entity';
import { Conversation } from '../../entities/conversation.entity';
import { Contact } from '../../entities/contact.entity';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { EventsGateway } from '../../ws/events.gateway';
import { InstancesModule } from '../instances/instances.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, Conversation, Contact]),
    InstancesModule,
    StorageModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService, EventsGateway],
  exports: [MessagesService],
})
export class MessagesModule {}

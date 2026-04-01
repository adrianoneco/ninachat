import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Instance } from '../../entities/instance.entity';
import { InstancesService } from './instances.service';
import { InstancesController } from './instances.controller';
import { WppController } from './wpp.controller';
import { MessagesSendController } from './messages-send.controller';
import { EventsGateway } from '../../ws/events.gateway';
import { WppManagerService } from './wpp-manager.service';
import { Contact } from '../../entities/contact.entity';
import { Message } from '../../entities/message.entity';
import { Conversation } from '../../entities/conversation.entity';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([Instance, Contact, Message, Conversation]), StorageModule],
  controllers: [InstancesController, WppController, MessagesSendController],
  providers: [InstancesService, EventsGateway, WppManagerService],
  exports: [InstancesService, WppManagerService],
})
export class InstancesModule {}

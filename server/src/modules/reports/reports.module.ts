import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Message } from '../../entities/message.entity';
import { Conversation } from '../../entities/conversation.entity';
import { Contact } from '../../entities/contact.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Message, Conversation, Contact])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}

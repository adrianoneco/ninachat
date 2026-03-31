import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AuthModule } from './modules/auth/auth.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { InstancesModule } from './modules/instances/instances.module';
import { MessagesModule } from './modules/messages/messages.module';
import { RolesModule } from './modules/roles/roles.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { ConversationsModule } from './modules/conversations/conversations.module';

const imports = [ConfigModule.forRoot({ isGlobal: true })] as any[];

// If TypeORM is enabled, register the connection first so feature modules can
// resolve repositories during module initialization.
imports.push(
  TypeOrmModule.forRoot({
    type: 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5436', 10),
    username: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.POSTGRES_DB || 'nina_db',
    synchronize: true,
    logging: process.env.TYPEORM_LOGGING === 'true',
    autoLoadEntities: true,
    entities: [__dirname + '/entities/*.entity.{ts,js}'],
  }),
);

// Application modules (after TypeORM connection)
imports.push(
  AuthModule,
  ContactsModule,
  InstancesModule,
  ConversationsModule,
  MessagesModule,
  RolesModule,
  UploadsModule,
);

@Module({
  imports: imports,
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

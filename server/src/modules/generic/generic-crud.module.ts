import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GenericRecord } from '../../entities/generic-record.entity';
import { GenericCrudService } from './generic-crud.service';
import { GenericCrudController } from './generic-crud.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GenericRecord])],
  controllers: [GenericCrudController],
  providers: [GenericCrudService],
  exports: [GenericCrudService],
})
export class GenericCrudModule {}

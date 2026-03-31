import { IsNotEmpty, IsOptional, IsString, IsIn, IsObject } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  message_id!: string;

  @IsString()
  @IsNotEmpty()
  conversation_id!: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsIn(['inbound', 'outbound'])
  direction?: string;

  @IsOptional()
  @IsObject()
  metadata?: any;
}

export class UpdateMessageDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsObject()
  metadata?: any;

  @IsOptional()
  @IsString()
  status?: string;
}

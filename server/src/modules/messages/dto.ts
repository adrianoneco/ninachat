import { IsNotEmpty, IsOptional, IsString, IsIn, IsObject } from 'class-validator';

export class CreateMessageDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  message_id?: string;

  @IsOptional()
  @IsString()
  conversation_id?: string;

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
  @IsString()
  direction?: string;

  @IsOptional()
  @IsString()
  from_type?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  media_url?: string;

  @IsOptional()
  @IsString()
  media_type?: string;

  @IsOptional()
  @IsString()
  created_at?: string;

  @IsOptional()
  @IsObject()
  payload?: any;

  @IsOptional()
  @IsObject()
  metadata?: any;

  @IsOptional()
  raw?: any;
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

  @IsOptional()
  edited_at?: string;

  @IsOptional()
  edits?: any;
}

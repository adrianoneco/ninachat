export class CreateMessageDto {
  conversation_id!: string;
  from?: string;
  to?: string;
  body?: string;
  direction?: string;
  metadata?: any;
}

export class UpdateMessageDto {
  body?: string;
  metadata?: any;
  status?: string;
}

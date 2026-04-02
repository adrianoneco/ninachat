import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Index(['conversation_id'], { unique: false })
@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  conversation_id?: string;

  @Column({ type: 'text', nullable: false, unique: true })
  message_id?: string;

  @Column({ type: 'text', nullable: false, default: 'chat' })
  message_type?: string;

  @Column({ type: 'text', nullable: true })
  reply_to_id?: string;

  @Column({ type: 'text', nullable: true })
  whatsapp_message_id?: string;

  @Column({ type: 'text', nullable: true })
  content?: string;

  @Column({ type: 'text', nullable: true })
  media_url?: string;

  @Column({ type: 'text', nullable: true })
  media_type?: string;

  @Column({ type: 'varchar', default: 'text', nullable: true })
  type?: string;

  @Column({ type: 'varchar', default: 'user', nullable: true })
  from_type?: string;

  @Column({ type: 'varchar', default: 'sent', nullable: true })
  status?: string;

  @Column({ type: 'boolean', default: false })
  processed_by_livechat!: boolean;

  @Column({ type: 'integer', nullable: true })
  livechat_response_time?: number;

  @Column({ type: 'varchar', nullable: true })
  direction?: string;

  @Column({ type: 'timestamptz', nullable: true })
  edited_at?: Date;

  @Column({ type: 'jsonb', nullable: true })
  edits?: any;

  @Column({ type: 'jsonb', nullable: true })
  payload?: any;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: any;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  sent_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  delivered_at?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  read_at?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

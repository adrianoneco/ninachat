import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'send_queue' })
export class SendQueue {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  conversation_id!: string;

  @Column()
  contact_id!: string;

  @Column({ type: 'text', default: 'text' })
  message_type!: string;

  @Column({ type: 'text', default: 'nina' })
  from_type!: string;

  @Column({ type: 'text', nullable: true })
  content?: string;

  @Column({ type: 'text', nullable: true })
  media_url?: string;

  @Column({ type: 'jsonb', nullable: true, default: () => "'{}'::jsonb" })
  metadata?: any;

  @Column({ type: 'text', default: 'pending' })
  status!: string;

  @Column({ type: 'integer', default: 1 })
  priority!: number;

  @Column({ type: 'integer', default: 0 })
  retry_count!: number;

  @Column({ type: 'text', nullable: true })
  error_message?: string;

  @Column({ type: 'timestamptz', nullable: true, default: () => 'now()' })
  scheduled_at?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  sent_at?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

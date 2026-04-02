import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'message_processing_queue' })
export class MessageProcessingQueue {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  whatsapp_message_id!: string;

  @Column()
  phone_number_id!: string;

  @Column({ type: 'jsonb' })
  raw_data!: any;

  @Column({ type: 'text', default: 'pending' })
  status!: string;

  @Column({ type: 'integer', default: 1 })
  priority!: number;

  @Column({ type: 'integer', default: 0 })
  retry_count!: number;

  @Column({ type: 'text', nullable: true })
  error_message?: string;

  @Column({ type: 'timestamptz', nullable: true, default: () => 'now()' })
  scheduled_for?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  processed_at?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

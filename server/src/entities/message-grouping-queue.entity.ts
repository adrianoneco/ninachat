import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'message_grouping_queue' })
export class MessageGroupingQueue {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  whatsapp_message_id!: string;

  @Column()
  phone_number_id!: string;

  @Column({ type: 'jsonb' })
  message_data!: any;

  @Column({ type: 'jsonb', nullable: true })
  contacts_data?: any;

  @Column({ type: 'boolean', default: false })
  processed!: boolean;

  @CreateDateColumn()
  created_at!: Date;
}

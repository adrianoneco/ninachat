import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Index(['contact_id', 'instance_id'], { unique: false })
@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  contact_id?: string;

  @Column({ nullable: true })
  instance_id?: string;

  @Column({ type: 'boolean', default: true })
  is_active?: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  last_message_at?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

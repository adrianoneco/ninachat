import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Contact } from './contact.entity';

@Index(['contact_id'], { unique: false })
@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: false, unique: true })
  chat_id!: string;

  @Column({ nullable: false })
  contact_id!: string;

  @Column({ nullable: false })
  instance_id!: string;

  @ManyToOne(() => Contact, { nullable: true, eager: true })
  @JoinColumn({ name: 'contact_id' })
  contact?: Contact;

  @Column({ type: 'varchar', default: 'nina' })
  status!: string;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @Column({ nullable: true })
  assigned_team!: string;

  @Column({ nullable: true })
  assigned_user_id!: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  tags!: string[];

  @Column({ type: 'jsonb', nullable: true, default: () => "'{}'::jsonb" })
  nina_context!: any;

  @Column({ type: 'jsonb', nullable: true, default: () => "'{}'::jsonb" })
  metadata!: any;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  started_at!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  last_message_at!: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
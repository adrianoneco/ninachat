import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn, Relation } from 'typeorm';
import { Contact } from './contact.entity';

@Index(['contact_id'], { unique: false })
@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  contact_id!: string;

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

  @Column({ type: 'simple-array', nullable: true })
  tags!: string[];

  @Column({ type: 'simple-json', nullable: true })
  nina_context!: any;

  @Column({ type: 'simple-json', nullable: true })
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
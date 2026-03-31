import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Index(['phone_number'], { unique: true })
@Entity('contacts')
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  name?: string;

  @Column({ nullable: true })
  call_name?: string;

  @Column({ nullable: false })
  phone_number?: string;

  @Column({ nullable: false })
  whatsapp_id?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  profile_picture_url?: string;

  @Column({ type: 'boolean', default: false })
  is_business?: boolean;

  @Column({ type: 'boolean', default: false })
  is_blocked?: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  blocked_at?: Date;

  @Column({ nullable: true })
  blocked_reason?: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  tags?: string[];

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'jsonb', nullable: true, default: () => "'{}'::jsonb" })
  client_memory?: any;

  @Column({ type: 'timestamptz', nullable: true })
  first_contact_date?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  last_activity?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

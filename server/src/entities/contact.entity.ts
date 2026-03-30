import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('contacts')
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  name?: string;

  @Column({ nullable: true })
  call_name?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  phone_number?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  picture_url?: string;

  @Column({ nullable: true })
  profile_picture_url?: string;

  @Column({ nullable: true })
  whatsapp_id?: string;

  @Column({ nullable: true })
  serialized?: string;

  @Column({ nullable: true })
  lid?: string;

  @Column({ nullable: true, default: false })
  is_blocked?: boolean;

  @Column({ nullable: true })
  blocked_reason?: string;

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({ nullable: true, type: 'text' })
  notes?: string;

  @Column({ type: 'simple-json', nullable: true })
  client_memory?: any;

  @Column({ type: 'boolean', default: false })
  is_business?: boolean;

  @Column({ nullable: true })
  first_contact_date?: string;

  @Column({ nullable: true })
  last_activity?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

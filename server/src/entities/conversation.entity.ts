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

    @Column({ type: 'varchar', default: 'nina' })
    status?: string;

    @Column({ type: 'varchar', nullable: true })
    assigned_team?: string;

    @Column({ type: 'uuid', nullable: true })
    assigned_user_id?: string;

    @Column({ type: 'text', array: true, default: () => "'{}'" })
    tags?: string[];

    @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
    nina_context?: any;

    @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
    metadata?: any;

    @Column({ type: 'jsonb', nullable: true })
    client_memory?: any;

    @Column({ type: 'text', nullable: true })
    notes?: string;

    @Column({ type: 'boolean', default: false })
    mute_notifications?: boolean;

    @Column({ type: 'timestamptz', nullable: true })
    closed_at?: Date;

    @Column({ type: 'text', nullable: true })
    closed_by?: string;

    @Column({ type: 'timestamptz', nullable: true })
    archived_at?: Date;

    @Column({ type: 'text', nullable: true })
    archived_by?: string;

    @Column({ type: 'timestamptz', default: () => 'now()' })
    started_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  last_message_at?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'conversation_states' })
export class ConversationState {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  conversation_id!: string;

  @Column({ type: 'text', default: 'idle' })
  current_state!: string;

  @Column({ type: 'text', nullable: true })
  last_action?: string;

  @Column({ type: 'timestamptz', nullable: true })
  last_action_at?: Date;

  @Column({ type: 'jsonb', nullable: true, default: () => "'{}'::jsonb" })
  scheduling_context?: any;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

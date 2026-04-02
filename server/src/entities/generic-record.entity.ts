import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Generic JSON record entity.
 * Stores arbitrary data for lightweight resources that don't need dedicated tables
 * (team_members, teams, deals, appointments, tickets, macros, etc.)
 */
@Index(['collection', 'record_id'], { unique: true })
@Entity('generic_records')
export class GenericRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** logical collection name, e.g. 'team_members', 'deals', 'appointments' */
  @Column({ type: 'text' })
  collection!: string;

  /** client-provided id (the id inside the JSON data) */
  @Column({ type: 'text' })
  record_id!: string;

  /** full JSON payload */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  data!: any;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

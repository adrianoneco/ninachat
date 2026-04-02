import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Role } from './role.entity';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  name?: string;

  @Column({ nullable: true })
  password_hash?: string;

  @Column({ default: false })
  email_verified: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: any;

  @ManyToMany(() => Role, { cascade: true })
  @JoinTable({ name: 'user_roles' })
  roles?: Role[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

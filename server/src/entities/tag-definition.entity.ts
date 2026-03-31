import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Index(['key'], { unique: true })
@Entity({ name: 'tag_definitions' })
export class TagDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  key!: string;

  @Column()
  label!: string;

  @Column({ type: 'text', default: '#3b82f6' })
  color!: string;

  @Column({ type: 'text', default: 'custom' })
  category!: string;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

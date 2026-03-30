import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('instances')
export class Instance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: false })
  name!: string;

  @Column({ nullable: true })
  channel?: string;

  @Column({ type: 'text', nullable: true })
  status?: string;

  @Column({ type: 'text', nullable: true })
  wppconnect_session?: string;

  @Column({ type: 'text', nullable: true })
  session_dir?: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: any;

  @Column({ type: 'text', nullable: true })
  puppeteer_info?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

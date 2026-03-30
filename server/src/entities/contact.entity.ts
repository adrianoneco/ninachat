import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('contacts')
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  name?: string;

  @Column({ nullable: false, unique: true })
  phone?: string;

  @Column({ nullable: false, unique: true })
  lid?: string;
  
  @Column({ nullable: false, unique: true })
  serialized?: string;

  @Column({ nullable: true })
  picture_url?: string;

  @Column({ nullable: false, default: false })
  online?: boolean;

  @Column({ type: 'simple-json', nullable: true })
  raw?: any;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

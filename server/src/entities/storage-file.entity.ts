import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('storage_files')
export class StorageFile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Original filename provided by the user */
  @Column({ type: 'text' })
  original_name!: string;

  /** The object key inside MinIO/S3 bucket */
  @Column({ type: 'text', unique: true })
  s3_key!: string;

  /** MIME type, e.g. image/png, video/mp4 */
  @Column({ type: 'varchar', length: 255 })
  mime_type!: string;

  /** File size in bytes */
  @Column({ type: 'bigint', default: 0 })
  size!: number;

  /** Optional: linked message id */
  @Column({ type: 'uuid', nullable: true })
  message_id?: string;

  /** Optional: linked conversation id */
  @Column({ type: 'uuid', nullable: true })
  conversation_id?: string;

  @CreateDateColumn()
  created_at!: Date;
}

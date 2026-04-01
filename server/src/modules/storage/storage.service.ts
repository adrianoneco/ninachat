import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StorageFile } from '../../entities/storage-file.entity';
import { uploadBufferToS3, getPresignedUrl } from '../../lib/s3.client';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @InjectRepository(StorageFile)
    private readonly repo: Repository<StorageFile>,
  ) {}

  /**
   * Upload a Buffer (or base64 data URL) to MinIO and persist a StorageFile record.
   */
  async upload(opts: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    messageId?: string;
    conversationId?: string;
  }): Promise<StorageFile> {
    const ext = path.extname(opts.originalName) || this.extFromMime(opts.mimeType);
    const fileUuid = uuidv4();
    const s3Key = `attachments/${fileUuid}${ext}`;

    await uploadBufferToS3(opts.buffer, s3Key, opts.mimeType);

    const record = this.repo.create({
      original_name: opts.originalName,
      s3_key: s3Key,
      mime_type: opts.mimeType,
      size: opts.buffer.length,
      message_id: opts.messageId || undefined,
      conversation_id: opts.conversationId || undefined,
    });
    const saved = await this.repo.save(record);
    this.logger.log(`Uploaded ${opts.originalName} → ${s3Key} (${saved.id})`);
    return saved;
  }

  /**
   * Upload from a data-URL string (data:mime;base64,...).
   */
  async uploadFromDataUrl(
    dataUrl: string,
    originalName: string,
    messageId?: string,
    conversationId?: string,
  ): Promise<StorageFile> {
    const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
    if (!match) throw new Error('Invalid data URL');
    const mimeType = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    return this.upload({ buffer, originalName, mimeType, messageId, conversationId });
  }

  /**
   * Get a presigned URL for a storage file by its id.  Default 8h expiry.
   */
  async getUrl(fileId: string): Promise<string> {
    const record = await this.repo.findOneBy({ id: fileId });
    if (!record) throw new NotFoundException('File not found');
    return getPresignedUrl(record.s3_key, 8 * 60 * 60);
  }

  /**
   * Get a presigned URL directly by s3 key.
   */
  async getUrlByKey(s3Key: string): Promise<string> {
    return getPresignedUrl(s3Key, 8 * 60 * 60);
  }

  async findById(id: string): Promise<StorageFile | null> {
    return this.repo.findOneBy({ id });
  }

  async findByMessageId(messageId: string): Promise<StorageFile[]> {
    return this.repo.find({ where: { message_id: messageId } });
  }

  private extFromMime(mime: string): string {
    const map: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'audio/mpeg': '.mp3',
      'audio/ogg': '.ogg',
      'audio/wav': '.wav',
      'audio/mp4': '.m4a',
      'application/pdf': '.pdf',
    };
    return map[mime] || '.bin';
  }
}

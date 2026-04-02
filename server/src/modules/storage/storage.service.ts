import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StorageFile } from '../../entities/storage-file.entity';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs-extra';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @InjectRepository(StorageFile)
    private readonly repo: Repository<StorageFile>,
  ) {}

  /**
   * Upload a Buffer to local storage in instance folder and persist a StorageFile record.
   */
  async upload(opts: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    messageId?: string;
    conversationId?: string;
    instanceId?: string;
    mediaType?: string;
  }): Promise<StorageFile> {
    const ext =
      path.extname(opts.originalName) || this.extFromMime(opts.mimeType);
    const fileUuid = uuidv4();

    // Determine media type folder
    const mediaType = opts.mediaType || this.mediaTypeFromMime(opts.mimeType);
    const instanceFolder = opts.instanceId || 'default';

    // Build local file path: data/storage/{instance_id}/{media_type}/{fileUuid}{ext}
    const baseStorageDir = process.env.STORAGE_DIR || 'data/storage';
    const relativePath = path.join(instanceFolder, mediaType, `${fileUuid}${ext}`);
    const fullPath = path.resolve(baseStorageDir, relativePath);

    // Ensure directory exists and write file
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, opts.buffer);

    const record = this.repo.create({
      original_name: opts.originalName,
      s3_key: relativePath, // Now stores local file path
      mime_type: opts.mimeType,
      size: opts.buffer.length,
      message_id: opts.messageId || undefined,
      conversation_id: opts.conversationId || undefined,
      media_type: mediaType,
      instance_id: opts.instanceId || undefined,
    });
    const saved = await this.repo.save(record);
    this.logger.log(`Saved ${opts.originalName} → ${relativePath} (${saved.id})`);
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
    instanceId?: string,
    mediaType?: string,
  ): Promise<StorageFile> {
    const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
    if (!match) throw new Error('Invalid data URL');
    const mimeType = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    return this.upload({
      buffer,
      originalName,
      mimeType,
      messageId,
      conversationId,
      instanceId,
      mediaType,
    });
  }

  /**
   * Get the local file URL for a storage file by its id.
   */
  async getUrl(fileId: string): Promise<string> {
    const record = await this.repo.findOneBy({ id: fileId });
    if (!record) throw new NotFoundException('File not found');
    // Return the local file path or API endpoint
    return `/api/storage/${record.id}/url`;
  }

  /**
   * Get the local file path for a storage file.
   */
  async getLocalPath(fileId: string): Promise<string> {
    const record = await this.repo.findOneBy({ id: fileId });
    if (!record) throw new NotFoundException('File not found');
    const baseStorageDir = process.env.STORAGE_DIR || 'data/storage';
    return path.resolve(baseStorageDir, record.s3_key);
  }

  /**
   * Get the local file path directly by s3 key (relative path).
   */
  async getLocalPathByKey(s3Key: string): Promise<string> {
    const baseStorageDir = process.env.STORAGE_DIR || 'data/storage';
    return path.resolve(baseStorageDir, s3Key);
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

  private mediaTypeFromMime(mime: string): string {
    if (mime.startsWith('image/')) return 'images';
    if (mime.startsWith('video/')) return 'videos';
    if (mime.startsWith('audio/')) return 'audios';
    return 'documents';
  }
}

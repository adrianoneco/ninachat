import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpException,
  HttpStatus,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { StorageService } from './storage.service';
import type { Response } from 'express';
import * as fs from 'fs-extra';

@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  /**
   * Upload a file via data-URL (base64). Used by the existing frontend upload flow.
   * Body: { filename: string, data: string (data URL), messageId?, conversationId?, instanceId?, mediaType? }
   */
  @Post('upload')
  async upload(
    @Body()
    body: {
      filename?: string;
      data?: string;
      messageId?: string;
      conversationId?: string;
      instanceId?: string;
      mediaType?: string;
    },
  ) {
    const { filename, data, messageId, conversationId, instanceId, mediaType } = body || ({} as any);
    if (!filename || !data) {
      throw new HttpException(
        'filename and data are required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const record = await this.storage.uploadFromDataUrl(
      data,
      safeName,
      messageId,
      conversationId,
      instanceId,
      mediaType,
    );
    // Return a URL path compatible with the frontend — it will resolve via /api/storage/:id/url
    return {
      url: `/api/storage/${record.id}/url`,
      fileId: record.id,
      localPath: record.s3_key,
    };
  }

  /**
   * Serve the local file directly.
   */
  @Get(':id/url')
  async serveFile(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const record = await this.storage.findById(id);
    if (!record) {
      throw new HttpException('File not found', HttpStatus.NOT_FOUND);
    }

    const localPath = await this.storage.getLocalPath(id);
    if (!await fs.pathExists(localPath)) {
      throw new HttpException('File not found on disk', HttpStatus.NOT_FOUND);
    }

    // Set content type
    res.setHeader('Content-Type', record.mime_type);
    res.setHeader('Content-Length', record.size);

    // Stream the file
    const fileStream = fs.createReadStream(localPath);
    fileStream.pipe(res);
  }

  /**
   * Get metadata for a stored file.
   */
  @Get(':id')
  async getFile(@Param('id') id: string) {
    const record = await this.storage.findById(id);
    if (!record)
      throw new HttpException('File not found', HttpStatus.NOT_FOUND);
    return record;
  }
}

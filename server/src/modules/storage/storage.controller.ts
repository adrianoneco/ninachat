import { Controller, Get, Post, Param, Body, HttpException, HttpStatus } from '@nestjs/common';
import { StorageService } from './storage.service';

@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  /**
   * Upload a file via data-URL (base64). Used by the existing frontend upload flow.
   * Body: { filename: string, data: string (data URL), messageId?, conversationId? }
   */
  @Post('upload')
  async upload(
    @Body() body: { filename?: string; data?: string; messageId?: string; conversationId?: string },
  ) {
    const { filename, data, messageId, conversationId } = body || ({} as any);
    if (!filename || !data) {
      throw new HttpException('filename and data are required', HttpStatus.BAD_REQUEST);
    }
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const record = await this.storage.uploadFromDataUrl(data, safeName, messageId, conversationId);
    // Return a URL path compatible with the frontend — it will resolve via /api/storage/:id/url
    return { url: `/api/storage/${record.id}/url`, fileId: record.id, s3Key: record.s3_key };
  }

  /**
   * Get a presigned URL (8h) for a stored file.
   */
  @Get(':id/url')
  async getUrl(@Param('id') id: string) {
    const url = await this.storage.getUrl(id);
    return { url };
  }

  /**
   * Get metadata for a stored file.
   */
  @Get(':id')
  async getFile(@Param('id') id: string) {
    const record = await this.storage.findById(id);
    if (!record) throw new HttpException('File not found', HttpStatus.NOT_FOUND);
    return record;
  }
}

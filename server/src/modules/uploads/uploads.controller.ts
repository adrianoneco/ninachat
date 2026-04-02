import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post()
  async upload(
    @Body()
    body: {
      filename?: string;
      data?: string;
      messageId?: string;
      conversationId?: string;
    },
  ) {
    const { filename, data, messageId, conversationId } = body || ({} as any);
    if (!filename || !data) {
      throw new HttpException(
        'filename and data are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    try {
      const record = await this.storage.uploadFromDataUrl(
        data,
        safeName,
        messageId,
        conversationId,
      );
      // Return a presigned-URL-based path that the frontend can resolve
      return { url: `/api/storage/${record.id}/url`, fileId: record.id };
    } catch (e) {
      throw new HttpException(
        'failed to save upload',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags, ApiProperty, ApiResponse, ApiParam } from '@nestjs/swagger';
import { WppManagerService } from './wpp-manager.service';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

class SendTextDto {
  @ApiProperty({ description: 'Número do destinatário', example: '5541999999999' })
  @IsString()
  @IsNotEmpty()
  to!: string;

  @ApiProperty({ description: 'Mensagem de texto', example: 'Olá do Swagger!' })
  @IsString()
  @IsNotEmpty()
  body!: string;
}

@ApiTags('Enviar Mensagens')
@Controller(':session/messages')
export class MessagesSendController {
  constructor(private readonly wpp: WppManagerService) {}

  // ── helpers ──────────────────────────────────────────────
  private resolvePayload(
    file: Express.Multer.File | undefined,
    url: string | undefined,
  ): { payload: Buffer | string; resolved: string } {
    if (file?.buffer?.length) {
      return { payload: file.buffer, resolved: 'binary' };
    }
    const trimmed = url?.trim();
    if (trimmed) return { payload: trimmed, resolved: 'url' };
    throw new Error('file (binary) ou url é obrigatório');
  }

  private serializeError(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    try { return JSON.stringify(err); } catch { return String(err); }
  }

  // ── routes ──────────────────────────────────────────────

  @Post('send-text')
  @ApiOperation({ summary: 'Enviar mensagem de texto' })
  @ApiParam({ name: 'session', description: 'Nome da sessão/instância', example: 'suporte-ti' })
  @ApiBody({ type: SendTextDto })
  @ApiResponse({ status: 201, description: 'Mensagem enviada com sucesso' })
  async sendText(@Param('session') session: string, @Body() dto: SendTextDto) {
    try {
      const result = await this.wpp.sendTextMessage(session, dto.to, dto.body);
      return { success: true, result };
    } catch (err) {
      throw new HttpException(this.serializeError(err), HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('send-image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 512 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Enviar imagem (binário ou URL)' })
  @ApiParam({ name: 'session', description: 'Nome da sessão/instância', example: 'suporte-ti' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['to'],
      properties: {
        to: { type: 'string', example: '5541999999999' },
        file: { type: 'string', format: 'binary', description: 'Arquivo binário (preferencial)' },
        url: { type: 'string', example: 'https://example.com/image.jpg', description: 'URL de fallback' },
        filename: { type: 'string', example: 'imagem.jpg' },
        caption: { type: 'string', example: 'Legenda' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Imagem enviada com sucesso' })
  async sendImage(
    @Param('session') session: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { to: string; url?: string; filename?: string; caption?: string },
  ) {
    try {
      const { payload } = this.resolvePayload(file, body.url);
      const filename = file?.originalname || body.filename || 'image.jpg';
      const result = await this.wpp.sendImageMessage(session, body.to, payload, filename, body.caption, file?.mimetype);
      return { success: true, result };
    } catch (err) {
      throw new HttpException(this.serializeError(err), HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('send-video')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 512 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Enviar vídeo (binário ou URL)' })
  @ApiParam({ name: 'session', description: 'Nome da sessão/instância', example: 'suporte-ti' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['to'],
      properties: {
        to: { type: 'string', example: '5541999999999' },
        file: { type: 'string', format: 'binary', description: 'Arquivo binário (preferencial)' },
        url: { type: 'string', example: 'https://example.com/video.mp4', description: 'URL de fallback' },
        filename: { type: 'string', example: 'video.mp4' },
        caption: { type: 'string', example: 'Legenda' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Vídeo enviado com sucesso' })
  async sendVideo(
    @Param('session') session: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { to: string; url?: string; filename?: string; caption?: string },
  ) {
    try {
      const { payload } = this.resolvePayload(file, body.url);
      const filename = file?.originalname || body.filename || 'video.mp4';
      const result = await this.wpp.sendVideoMessage(session, body.to, payload, filename, body.caption, file?.mimetype);
      return { success: true, result };
    } catch (err) {
      throw new HttpException(this.serializeError(err), HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('send-audio')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 512 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Enviar áudio (binário ou URL)' })
  @ApiParam({ name: 'session', description: 'Nome da sessão/instância', example: 'suporte-ti' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['to'],
      properties: {
        to: { type: 'string', example: '5541999999999' },
        file: { type: 'string', format: 'binary', description: 'Arquivo binário (preferencial)' },
        url: { type: 'string', example: 'https://example.com/audio.mp3', description: 'URL de fallback' },
        filename: { type: 'string', example: 'audio.mp3' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Áudio enviado com sucesso' })
  async sendAudio(
    @Param('session') session: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { to: string; url?: string; filename?: string },
  ) {
    try {
      const { payload } = this.resolvePayload(file, body.url);
      const filename = file?.originalname || body.filename || 'audio.mp3';
      const result = await this.wpp.sendAudioMessage(session, body.to, payload, filename, file?.mimetype);
      return { success: true, result };
    } catch (err) {
      throw new HttpException(this.serializeError(err), HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('send-ptt')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 512 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Enviar áudio como voz — PTT (binário ou URL)' })
  @ApiParam({ name: 'session', description: 'Nome da sessão/instância', example: 'suporte-ti' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['to'],
      properties: {
        to: { type: 'string', example: '5541999999999' },
        file: { type: 'string', format: 'binary', description: 'Arquivo binário (preferencial)' },
        url: { type: 'string', example: 'https://example.com/audio.ogg', description: 'URL de fallback' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Voice note enviado com sucesso' })
  async sendPtt(
    @Param('session') session: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { to: string; url?: string },
  ) {
    try {
      const { payload } = this.resolvePayload(file, body.url);
      const result = await this.wpp.sendPttMessage(session, body.to, payload, file?.originalname, file?.mimetype);
      return { success: true, result };
    } catch (err) {
      throw new HttpException(this.serializeError(err), HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('send-sticker')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 512 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Enviar sticker (binário ou URL)' })
  @ApiParam({ name: 'session', description: 'Nome da sessão/instância', example: 'suporte-ti' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['to'],
      properties: {
        to: { type: 'string', example: '5541999999999' },
        file: { type: 'string', format: 'binary', description: 'Arquivo binário (preferencial)' },
        url: { type: 'string', example: 'https://example.com/sticker.webp', description: 'URL de fallback' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Sticker enviado com sucesso' })
  async sendSticker(
    @Param('session') session: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { to: string; url?: string },
  ) {
    try {
      const { payload } = this.resolvePayload(file, body.url);
      const result = await this.wpp.sendStickerMessage(session, body.to, payload, file?.originalname, file?.mimetype);
      return { success: true, result };
    } catch (err) {
      throw new HttpException(this.serializeError(err), HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}



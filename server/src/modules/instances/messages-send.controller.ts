import { Body, Controller, HttpException, HttpStatus, Param, Post, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WppManagerService } from './wpp-manager.service';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

class SendTextDto {
  @IsString()
  @IsNotEmpty()
  to!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;
}

class SendMediaDto {
  @IsString()
  @IsNotEmpty()
  to!: string;

  // either a public URL or a base64 data URI
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  base64?: string;

  @IsOptional()
  @IsString()
  filename?: string;

  @IsOptional()
  @IsString()
  caption?: string;
}

@ApiTags('Enviar Mensagens')
@Controller('api/:session/messages')
export class MessagesSendController {
  constructor(private readonly wpp: WppManagerService) {}

  @Post('send-text')
  @ApiOperation({ summary: 'Enviar texto via sessão WPP' })
  @ApiBody({ schema: { example: { to: '+5511999999999', body: 'Olá do Swagger!' } } })
  async sendText(@Param('session') session: string, @Body() dto: SendTextDto) {
    try {
      await this.wpp.sendMessage(session, dto.to, dto.body);
      return { success: true };
    } catch (err) {
      throw new HttpException(String(err || 'send failed'), HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('send-image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Enviar imagem (url, base64 ou upload form-data) via sessão WPP' })
  @ApiBody({ schema: { example: { to: '+5511999999999', caption: 'Minha imagem' } } })
  async sendImage(
    @Param('session') session: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: SendMediaDto,
  ) {
    try {
      let payload: string | Buffer;
      let filename = dto.filename || 'image';

      if (file) {
        // form-data: arquivo binário
        payload = file.buffer;
        filename = file.originalname || dto.filename || 'image';
      } else if (dto.url || dto.base64) {
        // JSON: URL ou base64
        payload = dto.url || dto.base64 || '';
      } else {
        throw new Error('file, url or base64 required');
      }

      await this.wpp.sendMedia(session, dto.to, payload, filename, dto.caption || '');
      return { success: true };
    } catch (err) {
      throw new HttpException(String(err || 'send failed'), HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('send-video')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Enviar vídeo (url, base64 ou upload form-data) via sessão WPP' })
  @ApiBody({ schema: { example: { to: '+5511999999999', caption: 'Meu vídeo' } } })
  async sendVideo(
    @Param('session') session: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: SendMediaDto,
  ) {
    try {
      let payload: string | Buffer;
      let filename = dto.filename || 'video';

      if (file) {
        // form-data: arquivo binário
        payload = file.buffer;
        filename = file.originalname || dto.filename || 'video';
      } else if (dto.url || dto.base64) {
        // JSON: URL ou base64
        payload = dto.url || dto.base64 || '';
      } else {
        throw new Error('file, url or base64 required');
      }

      await this.wpp.sendMedia(session, dto.to, payload, filename, dto.caption || '');
      return { success: true };
    } catch (err) {
      throw new HttpException(String(err || 'send failed'), HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('send-audio')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Enviar áudio (url, base64 ou upload form-data) via sessão WPP' })
  @ApiBody({ schema: { example: { to: '+5511999999999' } } })
  async sendAudio(
    @Param('session') session: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: SendMediaDto,
  ) {
    try {
      let payload: string | Buffer;
      let filename = dto.filename || 'audio';

      if (file) {
        // form-data: arquivo binário
        payload = file.buffer;
        filename = file.originalname || dto.filename || 'audio';
      } else if (dto.url || dto.base64) {
        // JSON: URL ou base64
        payload = dto.url || dto.base64 || '';
      } else {
        throw new Error('file, url or base64 required');
      }

      await this.wpp.sendMedia(session, dto.to, payload, filename);
      return { success: true };
    } catch (err) {
      throw new HttpException(String(err || 'send failed'), HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

export default MessagesSendController;

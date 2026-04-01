import { Body, Controller, HttpException, HttpStatus, Param, Post } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Enviar imagem (url ou base64) via sessão WPP' })
  @ApiBody({ schema: { example: { to: '+5511999999999', url: 'https://example.com/image.jpg', filename: 'image.jpg', caption: 'Legenda' } } })
  async sendImage(@Param('session') session: string, @Body() dto: SendMediaDto) {
    try {
      const payload = dto.url || dto.base64;
      if (!payload) throw new Error('url or base64 required');
      await this.wpp.sendMedia(session, dto.to, payload, dto.filename || 'image', dto.caption || '');
      return { success: true };
    } catch (err) {
      throw new HttpException(String(err || 'send failed'), HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('send-video')
  @ApiOperation({ summary: 'Enviar vídeo (url ou base64) via sessão WPP' })
  @ApiBody({ schema: { example: { to: '+5511999999999', url: 'https://example.com/video.mp4', filename: 'video.mp4', caption: 'Vídeo' } } })
  async sendVideo(@Param('session') session: string, @Body() dto: SendMediaDto) {
    try {
      const payload = dto.url || dto.base64;
      if (!payload) throw new Error('url or base64 required');
      await this.wpp.sendMedia(session, dto.to, payload, dto.filename || 'video', dto.caption || '');
      return { success: true };
    } catch (err) {
      throw new HttpException(String(err || 'send failed'), HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('send-audio')
  @ApiOperation({ summary: 'Enviar áudio (url ou base64) via sessão WPP' })
  @ApiBody({ schema: { example: { to: '+5511999999999', url: 'https://example.com/audio.mp3', filename: 'audio.mp3' } } })
  async sendAudio(@Param('session') session: string, @Body() dto: SendMediaDto) {
    try {
      const payload = dto.url || dto.base64;
      if (!payload) throw new Error('url or base64 required');
      await this.wpp.sendMedia(session, dto.to, payload, dto.filename || 'audio');
      return { success: true };
    } catch (err) {
      throw new HttpException(String(err || 'send failed'), HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

export default MessagesSendController;

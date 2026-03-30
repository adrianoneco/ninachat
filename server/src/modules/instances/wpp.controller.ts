import { Body, Controller, Post, Get } from '@nestjs/common';
import { WppManagerService } from './wpp-manager.service';
import { Wpp } from '../../lib/wpp';

@Controller('wppconnect')
export class WppController {
  constructor(private readonly wpp: WppManagerService) {}

  @Post('send')
  async send(@Body() body: any) {
    const { session, to, type, content, filename, caption, payload } = body;
    if (!session || !to || !type) return { status: 'error', message: 'session, to and type are required' };
    try {
      switch (type) {
        case 'text':
          await this.wpp.sendMessage(session, to, content);
          return { status: 'ok' };
        case 'image':
        case 'video':
        case 'audio':
        case 'file':
          await this.wpp.sendMedia(session, to, content, filename, caption);
          return { status: 'ok' };
        case 'sticker':
          await this.wpp.sendSticker(session, to, content);
          return { status: 'ok' };
        case 'rich':
          // arbitrary payload for list/poll or other complex messages
          await this.wpp.sendRich(session, to, payload);
          return { status: 'ok' };
        default:
          return { status: 'error', message: 'unsupported type' };
      }
    } catch (e: any) {
      return { status: 'error', message: e?.toString?.() || String(e) };
    }
  }

  @Get('instances')
  async listInstances() {
    // Return a session -> client summary so callers can inspect active clients
    const rec = Wpp.getInstancesRecord();
    // avoid serializing big circular objects: only return keys and a small info stub
    const out: Record<string, any> = {};
    for (const k of Object.keys(rec)) {
      out[k] = { session: k, hasClient: !!rec[k] };
    }
    return out;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import { Message } from '../../entities/message.entity';
import { Conversation } from '../../entities/conversation.entity';
import { Contact } from '../../entities/contact.entity';
import { Instance } from '../../entities/instance.entity';
import { EventsGateway } from '../../ws/events.gateway';
import { WppManagerService } from '../instances/wpp-manager.service';
import { StorageService } from '../storage/storage.service';

const logger = new Logger('MessagesService');

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private repo: Repository<Message>,
    @InjectRepository(Conversation) private convRepo: Repository<Conversation>,
    @InjectRepository(Contact) private contactRepo: Repository<Contact>,
    @InjectRepository(Instance) private instanceRepo: Repository<Instance>,
    private readonly events: EventsGateway,
    private readonly wpp: WppManagerService,
    private readonly storageService: StorageService,
  ) {}

  async findAll() {
    return this.repo.find();
  }

  async findByConversation(conversationId: string, limit = 50) {
    return this.repo.find({
      where: { conversation_id: conversationId },
      order: { created_at: 'ASC' },
      take: limit,
    });
  }

  /**
   * Resolve a media URL (possibly /api/storage/:id/url) to a Buffer for sending via WPP.
   * Returns { buffer, filename, mimeType } or null if resolution fails.
   */
  private async resolveMediaForWpp(
    mediaUrl: string,
    fallbackFilename?: string,
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string } | null> {
    try {
      // Handle internal storage paths like /api/storage/:id/url
      const storageMatch = mediaUrl.match(/\/api\/storage\/([^/]+)\/url/);
      if (storageMatch) {
        const storageId = storageMatch[1];
        const record = await this.storageService.findById(storageId);
        if (!record) {
          logger.warn(
            `[resolveMediaForWpp] storage record not found: ${storageId}`,
          );
          return null;
        }
        const localPath = await this.storageService.getLocalPath(storageId);
        const buffer = await fs.promises.readFile(localPath);
        return {
          buffer,
          filename: record.original_name || fallbackFilename || 'file',
          mimeType: record.mime_type || 'application/octet-stream',
        };
      }
      // For a direct http(s) URL, download and return as buffer
      if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
        const response = await fetch(mediaUrl);
        if (!response.ok) return null;
        const bufferArr = await response.arrayBuffer();
        const contentType =
          response.headers.get('content-type') || 'application/octet-stream';
        return {
          buffer: Buffer.from(bufferArr),
          filename: fallbackFilename || 'file',
          mimeType: contentType.split(';')[0].trim(),
        };
      }
    } catch (e) {
      logger.warn(`[resolveMediaForWpp] error: ${String(e)}`);
    }
    return null;
  }

  async create(data: Partial<Message>) {
    // Pre-fetch conversation so instance_id is available for storage upload and WPP send
    let conv: any = null;
    if ((data as any).conversation_id) {
      conv = await this.convRepo.findOneBy({
        id: (data as any).conversation_id,
      } as any);
    }

    // If outbound media_url is a data URL, upload to local storage first
    const rawMediaUrl =
      (data as any).media_url || (data as any).mediaUrl || null;
    if (
      rawMediaUrl &&
      typeof rawMediaUrl === 'string' &&
      rawMediaUrl.startsWith('data:')
    ) {
      try {
        const fileName = `outbound_${Date.now()}`;
        // Determine media type from the data URL
        const mimeMatch = rawMediaUrl.match(/^data:([^;]+);/);
        const mimeType = mimeMatch ? mimeMatch[1] : '';
        const mediaType = mimeMatch
          ? mimeType.startsWith('image/')
            ? 'images'
            : mimeType.startsWith('video/')
            ? 'videos'
            : mimeType.startsWith('audio/')
            ? 'audios'
            : 'documents'
          : 'documents';

        const storageFile = await this.storageService.uploadFromDataUrl(
          rawMediaUrl,
          fileName,
          undefined,
          (data as any).conversation_id,
          conv?.instance_id,
          mediaType,
        );
        (data as any).media_url = `/api/storage/${storageFile.id}/url`;
        logger.log(
          `[create] uploaded outbound media to local storage: ${storageFile.s3_key}`,
        );
      } catch (e) {
        logger.warn(
          `[create] failed uploading outbound media to local storage: ${String(e)}`,
        );
      }
    }

    const ent = this.repo.create({ ...data, created_at: new Date() } as any);
    const saved = await this.repo.save(ent);

    // If outbound message belongs to a conversation with an instance_id, send through WPP
    const direction = (data as any).direction || (data as any).from_type;
    const isOutbound =
      direction === 'outbound' ||
      direction === 'user' ||
      direction === 'livechat';

    if (isOutbound && (data as any).conversation_id && !conv) {
      conv = await this.convRepo.findOneBy({
        id: (data as any).conversation_id,
      } as any);
    }

    // Skip WPP send when the frontend already sent via the binary direct endpoint
    const alreadySentViaWpp = (data as any).wpp_sent === true;

    if (isOutbound && !alreadySentViaWpp) {
      try {
        if (conv && conv.instance_id && conv.contact_id) {
          const client = this.wpp.getClient(conv.instance_id);
          if (client) {
            // Resolve the WPP JID for sending.
            // conv.contact_id may be a UUID (preferred), a JID, or digits.
            let to = conv.contact_id;
            try {
              const uuidRegex =
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
              let ct: any = null;
              if (uuidRegex.test(conv.contact_id)) {
                // contact_id is the contacts.id UUID — resolve directly
                ct = await this.contactRepo.findOneBy({
                  id: conv.contact_id,
                } as any);
              } else {
                // legacy JID / digits fallback
                ct =
                  (await this.contactRepo.findOneBy({
                    whatsapp_id: conv.contact_id,
                  } as any)) ||
                  (await this.contactRepo.findOneBy({
                    phone_number: conv.contact_id,
                  } as any));
              }
              if (ct?.whatsapp_id) to = ct.whatsapp_id;
            } catch {
              /* use conv.contact_id as-is */
            }
            // Ensure the JID has a suffix WPP expects — but ONLY if not already a JID
            if (to && !to.includes('@')) to = `${to}@c.us`;

            const content = (data as any).content || '';
            const type = ((data as any).type || 'text').toLowerCase();
            const mediaUrl =
              (data as any).media_url || (data as any).mediaUrl || null;
            const payload = (data as any).payload;

            if (
              type === 'sticker' &&
              (mediaUrl || payload?.attachments?.[0]?.url)
            ) {
              const url = mediaUrl || payload.attachments[0].url;
              const resolvedSticker = await this.resolveMediaForWpp(
                url,
                'sticker.webp',
              );
              await this.wpp.sendSticker(
                conv.instance_id,
                to,
                resolvedSticker ? resolvedSticker.buffer : url,
              );
              logger.log(`[WPP] sent sticker to ${to}`);
            } else if (
              ['image', 'video', 'audio', 'media', 'file', 'document'].includes(
                type,
              ) &&
              (mediaUrl || payload?.attachments?.[0]?.url)
            ) {
              const url = mediaUrl || payload.attachments[0].url;
              const filename = payload?.attachments?.[0]?.name || 'file';
              const caption = content || '';
              const mimeType = payload?.attachments?.[0]?.type || undefined;
              // Resolve internal storage URL to a Buffer for reliable WPP delivery
              const resolved = await this.resolveMediaForWpp(url, filename);
              if (!resolved) {
                logger.warn(`[WPP] could not resolve media URL, skipping send: ${url}`);
              } else {
                // Route to the type-specific sender so WppConnect uses the right WPP API
                if (type === 'video') {
                  await this.wpp.sendVideoMessage(conv.instance_id, to, resolved.buffer, resolved.filename, caption, resolved.mimeType);
                } else if (type === 'image') {
                  await this.wpp.sendImageMessage(conv.instance_id, to, resolved.buffer, resolved.filename, caption, resolved.mimeType);
                } else if (type === 'audio') {
                  await this.wpp.sendAudioMessage(conv.instance_id, to, resolved.buffer, resolved.filename, resolved.mimeType);
                } else {
                  await this.wpp.sendMedia(conv.instance_id, to, resolved.buffer, resolved.filename, caption);
                }
              }
              logger.log(`[WPP] sent ${type} to ${to}`);
            } else if (type === 'text' && content) {
              await this.wpp.sendMessage(conv.instance_id, to, content);
              logger.log(`[WPP] sent text to ${to}`);
            } else if (content) {
              // fallback: send as text
              await this.wpp.sendMessage(conv.instance_id, to, content);
              logger.log(`[WPP] sent text (fallback) to ${to}`);
            }
          }
        }
      } catch (e) {
        const errorMsg = String(e);
        logger.warn(`[WPP] failed sending outbound message: ${errorMsg}`);

        // Check if this is a detached frame error - restart instance if so
        if (errorMsg.includes('detached Frame') || errorMsg.includes('detached')) {
          logger.warn(`[WPP] Detached frame detected - scheduling instance restart for conv.instance_id: ${conv?.instance_id}`);
          try {
            // Emit instance stopped event
            this.events.emit('instance:stopped', { instance_id: conv.instance_id, reason: 'detached_frame' });
            logger.log(`[WPP] Emitted instance:stopped event for ${conv.instance_id}`);

            // Schedule restart
            setTimeout(async () => {
              logger.log(`[WPP] Starting restart process for instance ${conv.instance_id}`);
              try {
                // First need to find the instance object, not just the ID
                const instance = await this.instanceRepo.findOne({ where: { id: conv.instance_id } });
                if (!instance) {
                  logger.error(`[WPP] Instance ${conv.instance_id} not found for restart`);
                  return;
                }

                logger.log(`[WPP] Found instance object, calling restartInstance`);
                await this.wpp.restartInstance(instance);
                logger.log(`[WPP] Instance ${conv.instance_id} restarted after detached frame`);
                this.events.emit('instance:started', { instance_id: conv.instance_id });
              } catch (restartError) {
                logger.error(`[WPP] Failed to restart instance ${conv.instance_id}: ${String(restartError)}`);
              }
            }, 5000); // Wait 5 seconds before restart
          } catch (restartError) {
            logger.error(`[WPP] Error handling detached frame restart: ${String(restartError)}`);
          }
        }

        // Update message status to 'failed' so frontend knows
        try {
          (saved as any).status = 'failed';
          await this.repo.save(saved as any);
        } catch (_) {}
      }
    }

    this.events.emit('message:created', saved);
    return saved;
  }

  async update(id: string, data: Partial<Message>) {
    const existing = await this.repo.findOneBy({ id } as any);
    if (!existing) {
      await this.repo.update(id, data as any);
      const updated = await this.repo.findOneBy({ id } as any);
      this.events.emit('message:updated', updated);
      return updated;
    }

    // Track edit history when content changes
    if (
      (data as any).content !== undefined &&
      (data as any).content !== existing.content
    ) {
      const prevEdits = Array.isArray((existing as any).edits)
        ? [...(existing as any).edits]
        : [];
      prevEdits.push({
        content: existing.content,
        edited_at:
          (existing as any).edited_at ||
          (existing as any).created_at ||
          new Date().toISOString(),
      });
      (data as any).edits = prevEdits;
      (data as any).edited_at = new Date().toISOString();
    }

    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id' && value !== undefined) {
        (existing as any)[key] = value;
      }
    }
    const saved = await this.repo.save(existing as any);
    this.events.emit('message:updated', saved);
    return saved;
  }

  async remove(id: string) {
    await this.repo.delete(id);
    this.events.emit('message:deleted', { id });
  }

  /** Mark all inbound messages in a conversation as read */
  async markAsRead(conversationId: string) {
    const result = await this.repo
      .createQueryBuilder()
      .update()
      .set({ status: 'read', read_at: () => 'NOW()' } as any)
      .where('conversation_id = :conversationId', { conversationId })
      .andWhere("direction = 'inbound' OR from_type = 'whatsapp'")
      .andWhere("status != 'read'")
      .execute();
    if (result.affected && result.affected > 0) {
      this.events.emit('messages:read', {
        conversationId,
        count: result.affected,
      });
    }
    return { updated: result.affected || 0 };
  }

  /** Forward a message to another conversation */
  async forward(messageId: string, targetConversationId: string) {
    const original = await this.repo.findOneBy({ id: messageId } as any);
    if (!original) throw new Error('Message not found');
    const forwarded = this.repo.create({
      conversation_id: targetConversationId,
      content: original.content,
      media_url: (original as any).media_url,
      media_type: (original as any).media_type,
      type: original.type,
      direction: 'outbound',
      from_type: 'user',
      status: 'sent',
      metadata: { forwarded_from: messageId },
      created_at: new Date(),
    } as any);
    const saved = await this.repo.save(forwarded as any);

    // If target conversation has an active WPP instance, send through it
    try {
      const conv = await this.convRepo.findOneBy({
        id: targetConversationId,
      } as any);
      if (
        conv &&
        conv.instance_id &&
        conv.contact_id &&
        (original.content || (original as any).media_url)
      ) {
        const client = this.wpp.getClient(conv.instance_id);
        if (client) {
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          let fwdTo = conv.contact_id;
          const fwdCt: any = uuidRegex.test(conv.contact_id)
            ? await this.contactRepo.findOneBy({ id: conv.contact_id } as any)
            : (await this.contactRepo.findOneBy({
                whatsapp_id: conv.contact_id,
              } as any)) ||
              (await this.contactRepo.findOneBy({
                phone_number: conv.contact_id,
              } as any));
          if (fwdCt?.whatsapp_id) fwdTo = fwdCt.whatsapp_id;
          if (fwdTo && !fwdTo.includes('@')) fwdTo = `${fwdTo}@c.us`;
          const fwdMediaUrl = (original as any).media_url;
          const fwdType = (original.type || 'text').toLowerCase();
          if (
            fwdMediaUrl &&
            [
              'image',
              'video',
              'audio',
              'file',
              'document',
              'media',
              'sticker',
            ].includes(fwdType)
          ) {
            const resolved = await this.resolveMediaForWpp(
              fwdMediaUrl,
              (original as any).media_type || 'file',
            );
            if (resolved) {
              if (fwdType === 'sticker') {
                await this.wpp.sendSticker(
                  conv.instance_id,
                  fwdTo,
                  resolved.buffer as any,
                );
              } else {
                await this.wpp.sendMedia(
                  conv.instance_id,
                  fwdTo,
                  resolved.buffer,
                  resolved.filename,
                  original.content || '',
                );
              }
            } else if (original.content) {
              await this.wpp.sendMessage(
                conv.instance_id,
                fwdTo,
                original.content,
              );
            }
          } else if (original.content) {
            await this.wpp.sendMessage(
              conv.instance_id,
              fwdTo,
              original.content,
            );
          }
        }
      }
    } catch (e) {
      logger.warn(`[WPP] forward send failed: ${String(e)}`);
    }

    this.events.emit('message:created', saved);
    return saved;
  }
}

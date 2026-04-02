import * as wppconnect from '@wppconnect-team/wppconnect';
import { Contact } from '../entities/contact.entity';
import { Conversation } from '../entities/conversation.entity';
import { Instance } from '../entities/instance.entity';
import { Repository } from 'typeorm';
import fs from 'fs';
import { ContactItem } from '../types/ContactItem';
import { getContactByPushName } from '../utils/getContact';
import { EventsGateway } from '../ws/events.gateway';
import { StorageService } from '../modules/storage/storage.service';
import { Logger } from '@nestjs/common';
import { LiveChatSettings } from '../entities/livechat-settings.entity';
import { GenericRecord } from '../entities/generic-record.entity';
import { processAiAgentMessage } from './ai-agent';

const logger = new Logger('OnMessageChanged');

/** Media message types that carry binary content */
const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'ptt', 'document', 'sticker']);

export async function OnMessageChanged(
  message: wppconnect.Message,
  client: wppconnect.Whatsapp,
  convRepo: Repository<Conversation>,
  contactRepo: Repository<Contact>,
  msgRepo: Repository<any>,
  instance: Instance,
  events: EventsGateway,
  storageService?: StorageService,
  settingsRepo?: Repository<LiveChatSettings>,
  genericRecordRepo?: Repository<GenericRecord>,
) {
  const contact: ContactItem =
    ((await getContactByPushName(
      message?.sender?.pushname as string,
      client,
    )) as ContactItem) || null;

  const data = {
    instance: instance,
    contact: contact,
  };

  fs.writeFileSync(
    '/srv/sites/nina_chat/test/message.json',
    JSON.stringify(message, null, 4),
  );
  fs.writeFileSync(
    '/srv/sites/nina_chat/test/data.json',
    JSON.stringify(data, null, 4),
  );

  contactRepo
    .createQueryBuilder()
    .insert()
    .into('contacts')
    .values({
      name: contact?.name,
      phone_number: contact?.phone_number,
      phone_formated: contact?.phone_formated || null,
      whatsapp_id: contact?.whatsapp_id,
      profile_picture_url: contact?.avatar_url,
      is_blocked: contact?.isBlocked,
      is_busness: contact?.isBusiness,
      is_group: message?.isGroupMsg || false,
      instance_id: instance.id,
    })
    .orUpdate(
      ['name', 'phone_number', 'phone_formated', 'profile_picture_url'],
      ['whatsapp_id'],
    )
    .execute();

  const contactId = await contactRepo.findOne({
    where: {
      whatsapp_id: contact?.whatsapp_id,
    },
  });

  console.log('Contact ID found:', contactId?.id, 'for whatsapp_id:', contact?.whatsapp_id);

  convRepo
    .createQueryBuilder()
    .insert()
    .into('conversations')
    .values({
      contact_id: contactId?.id,
      chat_id: `${instance.id}-${message?.chatId}-${contactId?.id}`,
      instance_id: instance.id,
      is_group: message?.isGroupMsg || false,
      last_message_at: new Date(message?.t * 1000),
    })
    .orUpdate(['last_message_at'], ['chat_id'])
    .execute();

  const chatId = `${instance.id}-${message?.chatId}-${contactId?.id}`;
  console.log('Looking for conversation with chat_id:', chatId);

  const convId = await convRepo.findOne({
    where: {
      chat_id: chatId,
    },
  });

  console.log('Found conversation:', convId?.id, 'contact_id:', convId?.contact_id);

  // ── Save inbound media to local storage ──────────────────────────────────
  let mediaUrl: string | null = null;
  let mediaType: string | null = null;
  const msgType = (message?.type || 'chat') as string;

  if (MEDIA_TYPES.has(msgType) && message?.mimetype && storageService) {
    try {
      // message.body contains raw base64 for media messages in wppconnect
      const base64Content = (message as any).body || (message as any).content;
      if (base64Content && typeof base64Content === 'string') {
        const mimeType = message.mimetype as string;
        const buffer = Buffer.from(base64Content, 'base64');
        const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin';
        const originalName = (message as any).filename || `${msgType}_${Date.now()}.${ext}`;

        const storageFile = await storageService.upload({
          buffer,
          originalName,
          mimeType,
          conversationId: convId?.id,
          instanceId: instance.id,
          mediaType: mimeType.startsWith('image/') ? 'images'
            : mimeType.startsWith('video/') ? 'videos'
            : mimeType.startsWith('audio/') ? 'audios'
            : 'documents',
        });

        mediaUrl = `/api/storage/${storageFile.id}/url`;
        mediaType = msgType;
        logger.log(`Saved inbound media ${originalName} → ${storageFile.s3_key} (${storageFile.id})`);
      }
    } catch (e) {
      logger.warn(`Failed saving inbound media to storage: ${String(e)}`);
    }
  }

  msgRepo
    .createQueryBuilder()
    .insert()
    .into('messages')
    .values({
      message_id: message?.id,
      whatsapp_message_id: message?.id,
      content: message?.body,
      conversation_id: convId?.id,
      direction: message?.fromMe ? 'outbound' : 'inbound',
      payload: JSON.stringify(message),
      contact_id: contactId?.id,
      is_group: message?.isGroupMsg || false,
      type: msgType,
      ...(mediaUrl ? { media_url: mediaUrl, media_type: mediaType } : {}),
    })
    .orIgnore()
    .execute();

  // Emit socket events for new message
  if (convId?.id && !message?.fromMe) {
    console.log('[OnMessageChanged] Emitting socket events for message:', message?.body?.substring(0, 50));

    // Resolve best available name and avatar (prefer DB record over WppConnect volatile data)
    const resolvedName = contactId?.name || contact?.name || contact?.phone_number || null;
    const resolvedAvatar = contactId?.profile_picture_url || contact?.avatar_url || null;

    // Build a human-readable preview (avoid emitting base64 for media messages)
    const msgType = (message?.type || 'chat') as string;
    const mediaPreviewMap: Record<string, string> = {
      image: '🖼️ Imagem',
      video: '🎥 Vídeo',
      audio: '🎙️ Áudio',
      ptt: '🎙️ Mensagem de voz',
      document: '📄 Documento',
      sticker: '👋 Figurinha',
    };
    const messagePreview = MEDIA_TYPES.has(msgType)
      ? mediaPreviewMap[msgType] || '📎 Mídia'
      : message?.body?.substring(0, 100) || null;

    // Emit new message event
    events.emit('message:new', {
      instance_id: instance.id,
      conversation_id: convId.id,
      contact_name: resolvedName,
      contact_phone: contactId?.phone_number || contact?.phone_number,
      contact_avatar: resolvedAvatar,
      message_preview: messagePreview,
      message_type: msgType === 'chat' ? 'text' : msgType,
      media_url: mediaUrl || undefined,
      timestamp: new Date(message?.t * 1000).toISOString(),
    });

    // Also emit wpp:message for compatibility
    events.emit('wpp:message', {
      message,
      instance,
      contact,
      conversation: convId,
    });

    // ── AI agent: auto-respond when conversation is in livechat mode ──────
    if (settingsRepo && convId) {
      processAiAgentMessage(
        message,
        client,
        convId,
        convRepo,
        msgRepo,
        settingsRepo,
        events,
        contact?.name ?? undefined,
        genericRecordRepo,
      ).catch((e) =>
        logger.warn(`[AiAgent] processAiAgentMessage error: ${String(e)}`),
      );
    }
  }
}

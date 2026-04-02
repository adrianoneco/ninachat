import * as wppconnect from '@wppconnect-team/wppconnect';
import { Contact } from '../entities/contact.entity';
import { Conversation } from '../entities/conversation.entity';
import { Instance } from '../entities/instance.entity';
import { Repository } from 'typeorm';
import fs from 'fs';
import { ContactItem } from '../types/ContactItem';
import { getContactByPushName } from '../utils/getContact';

export async function OnMessageChanged(
  message: wppconnect.Message,
  client: wppconnect.Whatsapp,
  convRepo: Repository<Conversation>,
  contactRepo: Repository<Contact>,
  msgRepo: Repository<any>,
  instance: Instance,
) {
  const contact: ContactItem =
    ((await getContactByPushName(
      message?.sender?.pushname as string,
      client,
    )) as ContactItem) || null;

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

  const convId = await convRepo.findOne({
    where: {
      chat_id: `${instance.id}-${message?.chatId}-${contactId?.id}`,
    },
  });

  console.log('Updated conversation:', convId?.id);

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
    })
    .orIgnore()
    .execute();
}

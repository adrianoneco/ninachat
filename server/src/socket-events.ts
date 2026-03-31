import * as wppconnect from '@wppconnect-team/wppconnect';
import { Repository, LessThan, InsertResult } from 'typeorm';
import { Contact } from './entities/contact.entity';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import fs from 'fs';
import { getContact } from './utils/getContact';
import { Logger } from '@nestjs/common';

const logger = new Logger('Conversation');

export async function OnMessageUpsert(
    client: wppconnect.Whatsapp,
    instance: { id: string, name: string },
    contactRepo: Repository<Contact>,
    convRepo: Repository<Conversation>,
    msgRepo: Repository<Message>,
    message: any,
) {


    const contact = await getContact(message.from, client);  // wpp-contact

    if (contact) {
        await contactRepo.createQueryBuilder()
            .insert()
            .into('contacts')
            .values({
                whatsapp_id: contact.id || contact.whatsapp_id,
                name: contact.name,
                phone_number: contact.phone_number,
                is_business: contact.is_business,
                profile_picture_url: contact.profile_picture_url,
                is_blocked: contact.is_blocked,
            })
            .orIgnore()
            .execute()
            .then((item: InsertResult) => {
                logger.debug(`[DB] Contact ${contact.name} (${contact.phone_number})  inserted/exists`);
            }).catch((error) => {
                logger.error(`[DB] Error inserting contact ${contact.name} (${contact.phone_number}): ${error.message}`);
            })

        const findContact = await contactRepo.findOne({ where: { whatsapp_id: contact.id } });
        const findConv = await convRepo.findOne({ where: { chat_id: `${instance.id}_${findContact?.id}` } });

        // add conversation
        contactRepo.createQueryBuilder()
            .insert()
            .into('conversations')
            .values({
                chat_id: `${instance.id}_${findContact?.id}`,
                instance_id: instance.id,
                contact_id: findContact?.id,
                status: 'nina',
                is_active: true,
                started_at: new Date(),
                last_message_at: new Date(),
            })
            .orIgnore()
            .execute()
            .then((item: InsertResult) => {
                logger.debug(`[DB] Conversation for contact ${findContact?.name} (${findContact?.phone_number}) inserted/exists`);
            }).catch((error) => {
                logger.error(`[DB] Error inserting conversation for contact ${findContact?.name} (${findContact?.phone_number}): ${error.message}`);
            });

        // find conversation

        if (findConv) {
            // add message
            await msgRepo.createQueryBuilder()
                .insert()
                .into('messages')
                .values({
                    conversation_id: findConv.id,
                    contact_id: findContact?.id,
                    message_id: message.id,
                    from_me: message.fromMe,
                    type: message.type,
                    content: message.body,
                    media_url: message.mediaUrl,
                    metadata: message.metadata,
                    sent_at: new Date(message.timestamp * 1000),
                })
                .orIgnore()
                .execute()
                .then((item: InsertResult) => {
                    logger.debug(`[DB] Message ${message.id} for conversation ${findConv.id} inserted`);
                }).catch((error) => {
                    logger.error(`[DB] Error inserting message ${message.id} for conversation ${findConv.id}: ${error.message}`);
                });
        }


        fs.writeFileSync('/home/neco/Documentos/nina_chat/data/test/contact.json', JSON.stringify(findContact, null, 4));
    }



    fs.writeFileSync('/home/neco/Documentos/nina_chat/data/test/message.json', JSON.stringify(message, null, 4));
    console.debug(`[WPP:MSG] New message from ${message.from}: ${message.body}`);
}

export async function OnPresenceChanged(client: wppconnect.Whatsapp, presence: wppconnect.PresenceEvent, contactRepo: Repository<Contact>) {
    logger.debug(`[WPP:PRESENCE] ${presence.id} is now ${presence.isOnline}`);
}

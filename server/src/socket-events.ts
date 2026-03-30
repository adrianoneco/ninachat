import * as wppconnect from '@wppconnect-team/wppconnect';
import { Repository } from 'typeorm';
import { Contact } from './entities/contact.entity';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import fs from 'fs';
import normalizeContacts, { ContactItem } from './utils/contacts-normalizer';

export async function OnMessageUpsert(
    client: wppconnect.Whatsapp,
    instance: { id: string, name: string },
    contactRepo: Repository<Contact>,
    convRepo: Repository<Conversation>,
    msgRepo: Repository<Message>,
    message: any,
) {
    try {
        try {
            const contacts = (await client.getAllContacts()) || [];

            fs.mkdirSync(`${process.env.DATA_DIR}/${instance.id}/contacts`, { recursive: true });

            
            const _contacts = await normalizeContacts(contacts);
            _contacts.forEach((c: ContactItem) => {
                fs.writeFileSync(`${process.env.DATA_DIR}/${instance.id}/contacts/${c.id}.json`, JSON.stringify(c, null, 4));
            });
        } catch (e) { }

    } catch (e) {
        console.error('Failed to process incoming message', e);
    }
}

export async function OnPresenceChanged(client: wppconnect.Whatsapp, presence: wppconnect.PresenceEvent, contactRepo: Repository<Contact>) {
    console.debug(`[WPP:PRESENCE] ${presence.id} is now ${presence.isOnline}`);
    try {
        await contactRepo.update({ lid: presence.id }, { online: presence.isOnline });
    } catch (e) {
        console.error('Failed to update contact presence', e);
    }
}

import * as wppconnect from '@wppconnect-team/wppconnect';
import { Repository, LessThan } from 'typeorm';
import { Contact } from './entities/contact.entity';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import fs from 'fs';
import { ContactItem } from './interfaces';

export async function OnMessageUpsert(
    client: wppconnect.Whatsapp,
    instance: { id: string, name: string },
    contactRepo: Repository<Contact>,
    convRepo: Repository<Conversation>,
    msgRepo: Repository<Message>,
    message: any,
) {
    try {
        
    } catch (e) {
        console.error('[OnMessageUpsert] Failed to process incoming message', e);
    }
}

export async function OnPresenceChanged(client: wppconnect.Whatsapp, presence: wppconnect.PresenceEvent, contactRepo: Repository<Contact>) {
    console.debug(`[WPP:PRESENCE] ${presence.id} is now ${presence.isOnline}`);
}

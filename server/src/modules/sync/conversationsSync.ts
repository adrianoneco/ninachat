import * as wppconnect from '@wppconnect-team/wppconnect';
import { Contact } from 'src/entities/contact.entity';
import { Conversation } from 'src/entities/conversation.entity';
import { Repository } from 'typeorm';
import fs from 'fs';

export async function syncConversations(
    instance: { id: string, name: string },
    client: wppconnect.Whatsapp,
    convRepo: Repository<Conversation>,
    contactRepo: Repository<Contact>
) {
    const convs: wppconnect.Chat[] = await client.listChats();

    convs.forEach(async (conv: any) => {
        const contact = await contactRepo
            .createQueryBuilder('c')
            .where('c.whatsapp_id = :value', { value: conv.contact.id._serialized })
            .orWhere('c.phone_number = :value', { value: conv.contact.id._serialized.split('@')[0] })
            .getOne();


        convRepo.createQueryBuilder()
            .insert()
            .into("conversations")
            .values({
                chat_id: `${instance.id}-${contact?.whatsapp_id}`,
                instance_id: instance.id,
                contact_id: contact?.id,
                is_group: conv?.isGroup,
            })
            .orIgnore()
            .execute()
            .then(() => {
                console.log(`[${instance.name}] synced conversation: ${conv.id} (${contact ? contact.name : 'unknown contact'})`);
            })
            .catch((e) => {
                console.warn(`[${instance.name}] failed syncing conversation ${conv.id}: ${String(e)}`);
            });

        const existing: any = await convRepo.findOneBy({ chat_id: `${instance.id}-${contact?.whatsapp_id}` });

        // import messages of existing conversations that don't have messages yet
        /*    
         (await client.getMessages(`175759255674896@lid`, { count: 1000 })).forEach((msg: any) => {
            fs.writeFileSync(`/home/neco/Documentos/nina_chat/test/messages/${instance.name}_message.json`, JSON.stringify(msg, null, 4));
        });
        */

        
        /*
        await convRepo.manager.createQueryBuilder()
            .insert()
            .into('messages')
            .values({
                message_id: message.id,
                conversation_id: existing?.id,
                content: message.body,
                //media_url: message?.mediaData?.mediaUrl || null,
                from_type: message.fromMe ? 'user' : 'contact',
                type: message.type
            })
            .orIgnore()
            .execute()
            .then(() => console.log(`[${instance.name}] imported ${message.id} messages for conversation ${conv.id}`))
            .catch(e => console.warn(`[${instance.name}] failed importing messages for conversation ${conv.id}: ${String(e)}`));
*/
    });
}

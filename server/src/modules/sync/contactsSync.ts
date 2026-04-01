import * as wppconnect from '@wppconnect-team/wppconnect';
import { Contact } from 'src/entities/contact.entity';
import { Repository } from 'typeorm';
import { ContactItem } from 'src/types/ContactItem';
import fs from 'fs';
import { formatBR } from 'src/utils/fomatNumber';

export async function syncContacts(instance: { id: string, name: string }, client: wppconnect.Whatsapp, contactRepo: Repository<Contact>): Promise<ContactItem[]> {
    const contacts = {} as { [key: string]: any[] };
    const _contacts_serialized: ContactItem[] = [];

    console.log(`[SYNC] [CONTACTS] Processing contacts for instance ${instance.name} (${instance.id})...`);

    (await client.getAllContacts()).filter((c: any) => !['status@broadcast', '0@c.us'].includes(c.id?._serialized) && ['c.us', 'lid', 'g.us'].includes(c?.id?.server)).forEach((contact: any) => {
        if (!contacts[contact.pushname]) {
            contacts[contact.pushname] = [];
        }

        contacts[contact.pushname].push({
            id: contact?.id?._serialized,
            name: contact?.name,
            verifiedName: contact?.verifiedName || null,
            phone_number: contact?.id?.user,
            isBlocked: contact?.isBlocked || false,
            isBusiness: contact?.isBusiness || false,
            type: contact?.id?.server === 'c.us' ? 'contact' : contact?.id?.server === 'g.us' ? 'group' : 'identity',
            avatar_url: contact?.profilePicThumbObj?.eurl || null,
            server: contact?.id?.server,
        });
    });

    Object.values(contacts).forEach((group: any) => {
        const parameter = {};
        group.forEach((c: any) => {
            if (c.server === 'c.us') {
                parameter['id'] = c.id;
                parameter['name'] = c.name || c.verifiedName || c.phone_number;
                parameter['verifiedName'] = c.verifiedName;
                parameter['phone_number'] = c.phone_number;
                parameter['phone_formated'] = formatBR(c.phone_number) || c.phone_number;
                parameter['isBlocked'] = c.isBlocked;
                parameter['isBusiness'] = c.isBusiness;
                parameter['avatar_url'] = c.avatar_url;
                parameter['is_group'] = c.type === 'group';
            }
        });

        const lid = group.find((c: any) => c.server === 'lid');

        if (lid) {
            parameter['id'] = lid.id;
        }

        _contacts_serialized.push(parameter as ContactItem);
    });


    for await (const contact of _contacts_serialized) {
        if (!contact.phone_number) continue; // Skip contacts without phone number (e.g., groups)
        await contactRepo
            .createQueryBuilder()
            .insert()
            .into('contacts')
            .values({
                name: contact.name,
                call_name: contact.name,
                phone_number: contact.phone_number,
                is_blocked: contact.isBlocked,
                is_business: contact.isBusiness,
                profile_picture_url: contact.avatar_url,
                whatsapp_id: contact.id,
                instance_id: instance.id,
                phone_formated: formatBR(contact.phone_number),
            })
            .orUpdate(
                [
                    'name',
                    'call_name',
                    'whatsapp_id',
                    'is_blocked',
                    'is_business',
                    'profile_picture_url',
                    'phone_formated',
                    'updated_at',
                ],
                ['phone_number']
            )
            .execute()
            .then(() => console.log(`Contact ${contact.name} (${contact.phone_number}) synced successfully.`))
            .catch((err) => console.error(`Failed to sync contact ${contact.name} (${contact.phone_number}):`, err));
    }

    return _contacts_serialized;
}

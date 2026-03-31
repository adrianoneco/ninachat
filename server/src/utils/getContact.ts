import * as wppconnect from '@wppconnect-team/wppconnect';
import { ContactItem } from 'src/types/ContactItem';

export async function getContact(id: string, client: wppconnect.Whatsapp): Promise<ContactItem | null> {
    try {
        const item = {};

        const acceptedServers = ['c.us', 'lid', 'g.us'];
        const profilePic = await client.getProfilePicFromServer(id);
        const contact = await client.getContact(id);
        console.log('Contact found:', contact.pushname);


        (await client.getAllContacts())
            .filter((c: any) => acceptedServers.includes(c.id?.server))
            .filter(c => c.pushname === contact.pushname || c.name === contact.name)
            .forEach(async (c: any) => {
                const contact = JSON.parse(JSON.stringify(c));

                if (c.id.server === 'c.us') {
                    item['name'] = contact.pushname || contact.name || '';
                    item['phone_number'] = contact.id.user || '';
                    item['whatsapp_id'] = contact.id._serialized || '';
                    item['is_business'] = contact.isBusiness || false;
                    item['profile_picture_url'] = profilePic.img;
                    item['is_blocked'] = contact.isBlocked || false;
                } else {
                    item['id'] = contact.id._serialized;
                }
            });

        return (item as ContactItem);

    } catch (e) {
        console.error('Error fetching contact:', e);
        return null;
    }
}
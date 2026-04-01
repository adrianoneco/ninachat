import * as wppconnect from '@wppconnect-team/wppconnect';
import { formatIncompletePhoneNumber } from 'libphonenumber-js/max';
import { ContactItem } from 'src/types/ContactItem';
import { formatBR } from './fomatNumber';

export async function getContactByPushName(pushname: string, client: wppconnect.Whatsapp): Promise<ContactItem | null> {
    try {
        const contacts = (await client.getAllContacts()).filter((c: any) => c.pushname === pushname).map((c: any) => {
          if (c.server === 'c.us') {
            return {
              id: c.id._serialized,
              name: c.name || c.pushname || null,
              phone_number: c.id.user,
              phone_formated: formatBR(c.id.user), // formatBR(c.id.user) || c.id.user, --- IGNORE ---
              isBlocked: c.isBlocked || false,
              isBusiness: c.isBusiness || false,
              type: 'contact',
              avatar_url: c.profilePicThumbObj?.eurl || null,
              server: c.id.server
            };
          } else {
            return {
              id: c.id._serialized,
              name: c.name || c.pushname || null,
              verifiedName: c.verifiedName || null,
              phone_number: c.id.user,
              phone_formated: null,
              isBlocked: c.isBlocked || false,
              isBusiness: c.isBusiness || false,
              type: c.id.server === 'g.us' ? 'group' : 'identity',
              avatar_url: c.profilePicThumbObj?.eurl || null,
              server: c.id.server,
            };
          }
        });

         const _contact: any = {
          name: contacts.find((c: any) => c.server === 'c.us')?.name || null,
          verifiedName: contacts.find((c: any) => c.server === 'c.us')?.verifiedName || null,
          phone_number: contacts.find((c: any) => c.server === 'c.us')?.phone_number,
          phone_formated: contacts.find((c: any) => c.server === 'c.us')?.phone_formated || null,
          isBlocked: contacts.find((c: any) => c.server === 'c.us')?.isBlocked || false,
          isBusiness: contacts.find((c: any) => c.server === 'c.us')?.isBusiness || false,
          type: contacts.find((c: any) => c.server === 'c.us')?.type || null,
          avatar_url: contacts.find((c: any) => c.server === 'c.us')?.avatar_url || contacts.find((c: any) => c.server === 'lid')?.avatar_url || contacts.find((c: any) => c.server === 'g.us')?.avatar_url || null,
          server: contacts.find((c: any) => c.server === 'c.us')?.server,
          whatsapp_id: contacts.find((c: any) => c.server === 'lid')?.id || contacts.find((c: any) => c.server === 'c.us')?.id || contacts.find((c: any) => c.server === 'g.us')?.id,
        };

        return _contact as ContactItem;
    } catch (e) {
        console.error('Error fetching contact:', e);
        return null;
    }
}
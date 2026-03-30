import { createHash } from 'crypto';
import fs from 'fs';

export interface ContactItem {
  id: string;
  name: string | null;
  number: string | null;
  isBusiness: boolean;
  isMe: boolean;
  isGroup: boolean;
  profilePicUrl: string | null;
}

function md5(text: any): string {
  const safe = String(text ?? '');
  return createHash('md5').update(safe).digest('hex');
}

const normalizeContacts: ((
  contacts: any[]
) => Promise<ContactItem[]>) = async (
  contacts: any[]
): Promise<ContactItem[]> => {
    console.log(`[SYNC] Normalizing ${contacts?.length ?? 0} contacts...`);
    if (!Array.isArray(contacts)) return [];

    const contactsMap: any = {};

    fs.writeFileSync('/tmp/debug-raw-contacts.json', JSON.stringify(contacts, null, 4));

    contacts
      .filter(
        (contact) =>
          contact &&
          contact.id &&
          (contact.id.server === 'c.us' || contact.id.server === 'lid'),
      )
      .forEach((contact) => {
        const seed = contact.pushname;
        const id = md5(String(seed));

        if (!contactsMap[id]) {
          contactsMap[id] = {};
        }

        // determine profile pic url: prefer img, then eurl, then imgFull
        const pic =
          contact.profilePicThumbObj?.img ||
          contact.profilePicThumbObj?.eurl ||
          contact.profilePicThumbObj?.imgFull ||
          null;
        if (contact.id.server === 'c.us') {
          contactsMap[id]['default'] = {
            name: contact.name || contact.pushname || null,
            number: contact.number || contact.id?.user || null,
            isBusiness: !!contact.isBusiness,
            isMe: !!contact.isMe,
            isGroup: !!contact.isGroup,
            profilePicUrl: pic,
          };
        } else {
          contactsMap[id]['lid'] = {
            id: contact.id?.user || null,
            name: contact.name || contact.pushname || null,
            number: contact.number || contact.id?.user || null,
            isBusiness: !!contact.isBusiness,
            isMe: !!contact.isMe,
            isGroup: !!contact.isGroup,
            profilePicUrl: pic,
          };
        }
      });

    // merge default and lid contacts (prefer default values when present)
    const mergedContacts: ContactItem[] = [];

    for (const entry of Object.values(contactsMap)) {
      const defaultContact = (entry as any).default || {};
      const lidContact = (entry as any).lid || {};

      const merged: ContactItem = {
        id: lidContact.id || null,
        name: defaultContact.name || lidContact.name || null,
        number: defaultContact.number || lidContact.number || null,
        isBusiness: defaultContact.isBusiness || lidContact.isBusiness || false,
        isMe: defaultContact.isMe || lidContact.isMe || false,
        isGroup: defaultContact.isGroup || lidContact.isGroup || false,
        profilePicUrl: defaultContact.profilePicUrl ?? lidContact.profilePicUrl ?? null,
      };

      mergedContacts.push(merged);
    }

    console.debug(`[SYNC] Processed contacts: ${mergedContacts.length}`);

    return mergedContacts;
  };

export default normalizeContacts;

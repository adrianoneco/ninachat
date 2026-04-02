export interface ContactItem {
  whatsapp_id: string;
  name: string | null;
  phone_number: string;
  phone_formated: string;
  isBlocked: boolean;
  isBusiness: boolean;
  type: 'contact';
  avatar_url: string | null;
  server: string;
}

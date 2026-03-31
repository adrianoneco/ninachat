export interface ContactItem {
  id: string;
  name: string;
  phone_number: string;
  whatsapp_id: string;
  is_business: boolean;
  profile_picture_url?: string | null;
  is_blocked: boolean;
}
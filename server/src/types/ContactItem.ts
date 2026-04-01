export interface ContactItem {
  id: string;
  name: string | null;
  phone_number: string;
  isBlocked: boolean;
  isBusiness: boolean;
  type: 'contact';
  avatar_url: string | null;
  server: string;
}
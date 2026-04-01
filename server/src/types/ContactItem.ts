export interface ContactItem {
  id: string | undefined;
  name: string | undefined;
  verifiedName: string | null;
  phone_number: string | undefined;
  phone_formated?: string;
  phone_contry?: string;
  isBlocked: boolean;
  isBusiness: boolean;
  avatar_url: string | null;
  is_group: boolean;
}
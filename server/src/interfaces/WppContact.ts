import { WppProfilePicThumb } from './WppProfilePic';

export interface WppContact {
  id: string;
  name: string | null;
  shortName: string | null;
  pushname: string | null;

  type: 'in' | 'out' | string;

  parentStatusMute: boolean;
  labels: any[];

  isContactSyncCompleted: number;

  disappearingModeDuration: number;
  disappearingModeSettingTimestamp: number;

  textStatusLastUpdateTime: number;

  isUsernameContact: boolean;
  syncToAddressbook: boolean;

  formattedName: string | null;

  isMe: boolean;
  isMyContact: boolean;
  isWAContact: boolean;

  profilePicThumbObj?: WppProfilePicThumb | null;

  msgs: any[] | null;
}

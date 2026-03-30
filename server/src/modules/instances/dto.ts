export class CreateInstanceDto {
  name!: string;
  channel?: string;
  webhook_url?: string;
  wppconnect_api_url?: string;
  wppconnect_session?: string;
}

export class UpdateInstanceDto {
  name?: string;
  channel?: string;
  webhook_url?: string;
  status?: string;
  wppconnect_api_url?: string;
  wppconnect_session?: string;
}

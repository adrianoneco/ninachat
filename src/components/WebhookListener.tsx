import React from 'react';
import { useWebhookEvents } from '@/hooks/useWebhookEvents';

const WebhookListener: React.FC<{ serverUrl?: string }> = ({ serverUrl }) => {
  useWebhookEvents(serverUrl);
  return null;
};

export default WebhookListener;

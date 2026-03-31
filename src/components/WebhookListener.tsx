import React from 'react';
import { useWebhookEvents } from '@/hooks/useWebhookEvents';
import useWppSocket from '@/hooks/useWppSocket';

const WebhookListener: React.FC<{ serverUrl?: string }> = ({ serverUrl }) => {
  useWebhookEvents(serverUrl);
  useWppSocket(undefined, serverUrl);
  return null;
};

export default WebhookListener;

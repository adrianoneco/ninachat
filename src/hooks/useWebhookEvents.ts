import { useEffect } from 'react';
import { api } from '@/services/api';

export function useWebhookEvents(serverUrl: string = '/api') {
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource(`${serverUrl.replace(/\/$/, '')}/events`);
      es.onmessage = async (e) => {
        try {
          const payload = JSON.parse(e.data);
          // Forward to the frontend API handler to persist/update UI
          if (api && typeof api.processIncomingExternal === 'function') {
            await api.processIncomingExternal(payload);
          }
        } catch (err) {
          console.error('Error handling SSE message', err);
        }
      };
      es.onerror = (err) => {
        console.error('SSE connection error', err);
      };
    } catch (err) {
      console.error('Could not connect to webhook events', err);
    }

    return () => {
      if (es) es.close();
    };
  }, [serverUrl]);
}

import { useEffect, useRef } from 'react';

export function useWebhookEvents(serverUrl: string = '/api') {
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(2000);
  const closed = useRef(false);

  useEffect(() => {
    closed.current = false;
    let es: EventSource | null = null;

    const connect = () => {
      if (closed.current) return;
      try {
        es = new EventSource(`${serverUrl.replace(/\/$/, '')}/events`);

        es.onopen = () => {
          retryDelay.current = 2000; // reset backoff on successful connection
        };

        es.onmessage = () => {
          // SSE stream is keepalive-only. Real-time data arrives via socket.io
          // and is handled by useConversations.
        };

        es.onerror = () => {
          // EventSource.onerror fires on every transient disconnect — it will
          // auto-reconnect by spec. We only intervene if it reaches CLOSED state.
          if (es && es.readyState === EventSource.CLOSED) {
            es.close();
            if (!closed.current) {
              retryTimer.current = setTimeout(() => {
                retryDelay.current = Math.min(retryDelay.current * 2, 30000);
                connect();
              }, retryDelay.current);
            }
          }
        };
      } catch {
        // browser may not support EventSource; fail silently
      }
    };

    connect();

    return () => {
      closed.current = true;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (es) es.close();
    };
  }, [serverUrl]);
}

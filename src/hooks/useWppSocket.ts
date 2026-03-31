import { useEffect } from 'react';
import { connectSocket } from '@/lib/socket';
import { api } from '@/services/api';

export function useWppSocket(session?: string, serverUrl?: string) {
  useEffect(() => {
    const socket = connectSocket(serverUrl);
    if (!socket) return;

    // join session room if provided
    if (session) {
      try { socket.emit('join', session); } catch (e) { }
    }

    const handler = async (payload: any) => {
      try {
        if (api && typeof api.processIncomingExternal === 'function') {
          await api.processIncomingExternal(payload);
        }
      } catch (e) {
        console.error('Failed processing incoming wpp socket message', e);
      }
    };

    socket.on('wpp:message', handler);

    return () => {
      try { socket.off('wpp:message', handler); } catch (e) { }
    };
  }, [session, serverUrl]);
}

export default useWppSocket;

import { useEffect } from 'react';
import { connectSocket } from '@/lib/socket';

export function useWppSocket(session?: string, serverUrl?: string) {
  useEffect(() => {
    const socket = connectSocket(serverUrl);
    if (!socket) return;

    // Join session room so the client receives session-scoped socket events.
    // Full message lifecycle (message:created, conversation:updated) is handled
    // by useConversations — nothing extra needed here.
    if (session) {
      try { socket.emit('join', session); } catch (e) { }
    }

    return () => {};
  }, [session, serverUrl]);
}

export default useWppSocket;

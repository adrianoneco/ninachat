import { useEffect, useState, useCallback } from 'react';
import { getSocket } from '../lib/socket';

export interface PresenceStatus {
  contact_id: string;
  instance_id: string;
  status: 'online' | 'offline' | 'typing' | 'recording' | 'paused';
  is_group: boolean;
  timestamp: string;
}

export function usePresence() {
  const [presences, setPresences] = useState<Map<string, PresenceStatus>>(new Map());
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    const currentSocket = getSocket();
    setSocket(currentSocket);

    if (currentSocket) {
      const handlePresenceChanged = (data: PresenceStatus) => {
        setPresences(prev => {
          const newPresences = new Map(prev);
          newPresences.set(data.contact_id, data);
          return newPresences;
        });
      };

      currentSocket.on('presence:changed', handlePresenceChanged);

      return () => {
        currentSocket.off('presence:changed', handlePresenceChanged);
      };
    }
  }, []);

  const getPresence = useCallback((contactId: string): PresenceStatus | undefined => {
    return presences.get(contactId);
  }, [presences]);

  const isOnline = useCallback((contactId: string): boolean => {
    const presence = presences.get(contactId);
    return presence?.status === 'online';
  }, [presences]);

  const isTyping = useCallback((contactId: string): boolean => {
    const presence = presences.get(contactId);
    return presence?.status === 'typing';
  }, [presences]);

  const isRecording = useCallback((contactId: string): boolean => {
    const presence = presences.get(contactId);
    return presence?.status === 'recording';
  }, [presences]);

  return {
    presences,
    getPresence,
    isOnline,
    isTyping,
    isRecording,
    socket,
  };
}

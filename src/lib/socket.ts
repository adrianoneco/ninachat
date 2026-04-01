import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectSocket(serverUrl?: string): Socket | null {
  if (socket) return socket;

  let target = serverUrl;
  try {
    const viteBase = import.meta.env?.VITE_API_BASE as string | undefined;
    if (!target && typeof window !== 'undefined') {
      if (viteBase && viteBase.startsWith('http')) {
        try { target = new URL(viteBase).origin; } catch (_) { /* ignore */ }
      }
      if (!target) {
        target = `${window.location.protocol}//${window.location.hostname}:40001`;
      }
    }
  } catch (_) {
    // ignore
  }

  socket = io(target || undefined, { transports: ['websocket', 'polling'] });
  socket.on('connect', () => console.log('[socket] connected', socket?.id));
  socket.on('disconnect', (reason) => console.log('[socket] disconnected', reason));
  return socket;
}

export function getSocket(): Socket | null { return socket; }

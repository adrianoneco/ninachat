let socket: any = null;

export function connectSocket(serverUrl?: string) {
  if (socket) return socket;
  try {
    // lazy import to avoid build-time errors if dependency missing
    // install with: npm i socket.io-client
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { io } = require('socket.io-client');

    // determine default server URL:
    // - prefer explicit param
    // - else use VITE_API_BASE origin if provided (works when set to full backend URL)
    // - fallback to same host but port 40001 (backend default)
    let target = serverUrl;
    try {
      // read Vite env at build time (safe in browser build)
      const viteBase = (import.meta as any)?.env?.VITE_API_BASE as string | undefined;
      if (!target && typeof window !== 'undefined') {
        if (viteBase && viteBase.startsWith('http')) {
          try { target = new URL(viteBase).origin; } catch (e) { /* ignore */ }
        }
        if (!target) {
          // default to backend port 40001 on same host
          target = `${window.location.protocol}//${window.location.hostname}:40001`;
        }
      }
    } catch (e) {
      // ignore and let io decide
    }

    socket = io(target || undefined);
    return socket;
  } catch (e) {
    console.warn('socket.io-client not available, run `npm i socket.io-client` to enable real-time updates');
    return null;
  }
}

export function getSocket() { return socket; }

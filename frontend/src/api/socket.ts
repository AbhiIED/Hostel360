import { io, Socket } from 'socket.io-client';

/**
 * Socket.IO client singleton.
 *
 * In local development, connects directly to backend (port 5000) to avoid
 * running WebSockets through the Vite dev-server HTTP proxy, which produces
 * noisy ECONNABORTED / ECONNRESET logs on tab reloads or component unmounts.
 *
 * In production, connects to the same origin ('/') or VITE_SOCKET_URL.
 */
const getSocketUrl = (): string => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  if (import.meta.env.VITE_API_URL) {
    const raw = (import.meta.env.VITE_API_URL as string).trim().replace(/\/+$/, '');
    return raw.replace(/\/api$/, '');
  }
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    return 'http://localhost:5000';
  }
  return '/';
};

let socketInstance: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socketInstance) {
    socketInstance = io(getSocketUrl(), {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
  }
  return socketInstance;
};

export default getSocket;

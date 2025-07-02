import { Socket, io } from 'socket.io-client';

// Internal state
let socket: Socket | null = null;
const callbacks: Record<string, Set<Callback>> = {};

// Types
interface InitOptions {
  host: string;
  port: number;
  protocol?: 'http' | 'https';
}
type Callback<T = any> = (payload: T) => void;

const nodeEvent = {
  init({ host, port, protocol = 'http' }: InitOptions) {
    if (socket) return; // Prevent re-initialization
    socket = io(`${protocol}://${host}:${port}`);
    socket.on('event', ({ type, payload }: { type: string; payload: any }) => {
      if (callbacks[type]) {
        callbacks[type].forEach((cb) => cb(payload));
      }
    });
  },

  subscribe<T = any>(type: string, callback: Callback<T>): () => void {
    if (!socket) throw new Error('nodeEvent not initialized. Call nodeEvent.init first.');
    if (!callbacks[type]) callbacks[type] = new Set();
    callbacks[type].add(callback as Callback);
    socket!.emit('subscribe', type);
    return () => {
      callbacks[type].delete(callback as Callback);
      if (callbacks[type].size === 0) {
        delete callbacks[type];
        socket!.emit('unsubscribe', type);
      }
    };
  },

  publish<T = any>(type: string, payload: T): void {
    if (!socket) throw new Error('nodeEvent not initialized. Call nodeEvent.init first.');
    socket!.emit('publish', { type, payload });
  },
};

export { nodeEvent }; 
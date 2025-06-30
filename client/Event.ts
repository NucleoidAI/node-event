import { Socket, io } from 'socket.io-client';

const socket: Socket = io('http://localhost:8080');

type Callback<T = any> = (payload: T) => void;
const callbacks: Record<string, Set<Callback>> = {};

function subscribe<T = any>(type: string, callback: Callback<T>): () => void {
  if (!callbacks[type]) callbacks[type] = new Set();
  callbacks[type].add(callback as Callback);
  socket.emit('subscribe', type);
  return () => {
    callbacks[type].delete(callback as Callback);
    if (callbacks[type].size === 0) {
      delete callbacks[type];
      socket.emit('unsubscribe', type);
    }
  };
}

function publish<T = any>(type: string, payload: T): void {
  socket.emit('publish', { type, payload });
}

socket.on('event', ({ type, payload }: { type: string; payload: any }) => {
  if (callbacks[type]) {
    callbacks[type].forEach((cb) => cb(payload));
  }
});

export { subscribe, publish }; 
import { Socket, io } from "socket.io-client";

let socket: Socket | null = null;
const callbacks: Record<string, Set<Callback>> = {};

interface InitOptions {
  host: string;
  port: number;
  protocol: string;
}
type Callback<T = any> = (payload: T) => void;

const nodeEvent = {
  init({ host, port, protocol }: InitOptions) {
    if (socket) return; 
    socket = io(`${protocol}://${host}:${port}`);
    socket.on("event", ({ type, payload }: { type: string; payload: any }) => {
      if (callbacks[type]) {
        callbacks[type].forEach((cb) => cb(payload));
      }
    });
  },

  subscribe<T = any>(type: string, callback: Callback<T>): () => void {
    if (!socket)
      throw new Error("nodeEvent not initialized. Call nodeEvent.init first.");
    if (!callbacks[type]) callbacks[type] = new Set();
    callbacks[type].add(callback as Callback);
    socket!.emit("subscribe", type);
    return () => {
      callbacks[type].delete(callback as Callback);
      if (callbacks[type].size === 0) {
        delete callbacks[type];
        socket!.emit("unsubscribe", type);
      }
    };
  },

  publish<T = any>(...args: [...string[], T]): void {
    if (!socket)
      throw new Error("nodeEvent not initialized. Call nodeEvent.init first.");
    
    if (args.length < 2) {
      throw new Error("publish requires at least one event type and a payload");
    }
    
    const payload = args[args.length - 1];
    const types = args.slice(0, -1) as string[];
    
    // Publish to all specified event types
    types.forEach(type => {
      socket!.emit("publish", { type, payload });
    });
  },
};

export { nodeEvent };

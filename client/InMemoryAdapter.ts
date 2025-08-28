import { Callback, EventAdapter, InMemoryOptions, InitOptions } from "./types";
import { Socket, io } from "socket.io-client";

const callbacks: Record<string, Set<Callback>> = {};

export class InMemoryAdapter implements EventAdapter {
  private socket: Socket | null = null;

  async init(options: InitOptions): Promise<void> {
    const opts = options as InMemoryOptions;
    if (!opts.host) {
      throw new Error("host is required for inMemory initialization");
    }
    if (!opts.protocol) {
      throw new Error("protocol is required for inMemory initialization");
    }

    const { host, protocol } = opts;
    const socketPath = opts?.port ? `${protocol}://${host}:${opts.port}` : `${protocol}://${host}`;

    this.socket = io(socketPath);
    this.socket.on("event", ({ type, payload }: { type: string; payload: any }) => {
      if (callbacks[type]) {
        callbacks[type].forEach((cb) => cb(payload));
      }
    });
  }

  async publish<T = any>(...args: [...string[], T]): Promise<void> {
    if (!this.socket) return;
    const payload = args[args.length - 1];
    const types = args.slice(0, -1) as string[];
    types.forEach((type) => {
      this.socket!.emit("publish", { type, payload });
    });
  }

  async subscribe<T = any>(type: string, callback: Callback<T>): Promise<() => void> {
    if (!callbacks[type]) callbacks[type] = new Set();
    callbacks[type].add(callback as Callback);
    if (this.socket) {
      this.socket.emit("subscribe", type);
    }
    return async () => {
      callbacks[type].delete(callback as Callback);
      if (callbacks[type].size === 0) {
        delete callbacks[type];
        if (this.socket) {
          this.socket.emit("unsubscribe", type);
        }
      }
    };
  }

  async cleanup(): Promise<void> {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}



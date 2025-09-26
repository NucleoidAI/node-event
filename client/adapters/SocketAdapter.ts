import { Socket, io } from "socket.io-client";

import { EventAdapter } from "../types/types";

export class SocketAdapter implements EventAdapter {
  private socket: Socket | null = null;
  private messageHandler?: (type: string, payload: any) => void;

  constructor(private readonly options: {
    host: string;
    port?: number;
    protocol: string;
  }) {}

  async connect(): Promise<void> {
    const { host, port, protocol } = this.options;
    const socketPath = port ? `${protocol}://${host}:${port}` : `${protocol}://${host}`;
    
    this.socket = io(socketPath);
    
    this.socket.on("event", ({ type, payload }: { type: string; payload: any }) => {
      if (this.messageHandler) {
        this.messageHandler(type, payload);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  async publish<T = any>(type: string, payload: T): Promise<void> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }
    this.socket.emit("publish", { type, payload });
  }

  async subscribe(type: string): Promise<void> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }
    this.socket.emit("subscribe", type);
  }

  async unsubscribe(type: string): Promise<void> {
    if (!this.socket) {
      throw new Error("Socket not connected");
    }
    this.socket.emit("unsubscribe", type);
  }

  onMessage(handler: (type: string, payload: any) => void): void {
    this.messageHandler = handler;
  }
}
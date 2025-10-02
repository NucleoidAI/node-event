import { EventAdapter } from "../types/types";
export declare class SocketAdapter implements EventAdapter {
    private readonly options;
    private socket;
    private messageHandler?;
    constructor(options: {
        host: string;
        port?: number;
        protocol: string;
    });
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    publish(type: string, payload: object): Promise<void>;
    subscribe(type: string): Promise<void>;
    unsubscribe(type: string): Promise<void>;
    onMessage(handler: (type: string, payload: object) => void): void;
}

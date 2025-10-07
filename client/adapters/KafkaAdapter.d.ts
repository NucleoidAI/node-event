import { EventAdapter } from "../types/types";
export declare class KafkaAdapter implements EventAdapter {
    private readonly options;
    private kafka;
    private consumer;
    private producer;
    private messageHandler?;
    private readonly topics;
    constructor(options: {
        clientId: string;
        brokers: string[];
        groupId: string;
        topics: string[];
    });
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    publish<T = object>(type: string, payload: T): Promise<void>;
    subscribe(type: string): Promise<void>;
    unsubscribe(type: string): Promise<void>;
    onMessage(handler: (type: string, payload: object) => void): void;
    getBacklog(): Promise<Map<string, number>>;
}

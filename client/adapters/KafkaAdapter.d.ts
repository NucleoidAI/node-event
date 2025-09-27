import { EventAdapter } from "../types/types";
export declare class KafkaAdapter implements EventAdapter {
    private readonly options;
    private kafka;
    private consumer;
    private producer;
    private messageHandler?;
    private subscribedTopics;
    private isRunning;
    constructor(options: {
        clientId: string;
        brokers: string[];
        groupId: string;
    });
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    publish<T = any>(type: string, payload: T): Promise<void>;
    subscribe(type: string): Promise<void>;
    unsubscribe(type: string): Promise<void>;
    onMessage(handler: (type: string, payload: any) => void): void;
    private restartConsumer;
    getBacklog(): Promise<Map<string, number>>;
}

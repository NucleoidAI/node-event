import { EventAdapter } from "../types/types";
export declare class TxEventQAdapter implements EventAdapter {
    private readonly options;
    private connection;
    private queue;
    private messageHandler?;
    private isRunning;
    private subscriptionLoop;
    constructor(options: {
        connectString: string;
        user: string;
        password: string;
        queueName: string;
        instantClientPath?: string;
        consumerName?: string;
        batchSize?: number;
        waitTime?: number;
    });
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    publish<T = object>(type: string, payload: T): Promise<void>;
    subscribe(type: string): Promise<void>;
    unsubscribe(type: string): Promise<void>;
    onMessage(handler: (type: string, payload: object) => void): void;
    private startConsumption;
    getBacklog(topics: string[]): Promise<Map<string, number>>;
}

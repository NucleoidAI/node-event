import { Callback, InitOptions } from "./types";
import { EventAdapter } from "./Adapter";
export declare class KafkaAdapter implements EventAdapter {
    private kafka;
    private kafkaProducer;
    private kafkaConsumers;
    private kafkaGroupId;
    init(options: InitOptions): Promise<void>;
    publish<T = any>(...args: [...string[], T]): Promise<void>;
    subscribe<T = any>(type: string, callback: Callback<T>): Promise<() => void>;
    cleanup(): Promise<void>;
}

interface BaseInitOptions {
    type: "inMemory" | "socket" | "kafka";
}
interface InMemoryOptions extends BaseInitOptions {
    type: "inMemory";
    host: string;
    port?: number;
    protocol: string;
}
interface KafkaOptions extends BaseInitOptions {
    type: "kafka";
    clientId: string;
    brokers: string[];
    groupId: string;
}
type InitOptions = InMemoryOptions | KafkaOptions;
type Callback<T = any> = (payload: T) => void;
declare const event: {
    init(options: InitOptions): void;
    publish<T = any>(...args: [...string[], T]): Promise<void>;
    subscribe<T = any>(type: string, callback: Callback<T>): Promise<() => void>;
};
export { event };

export type Callback<T = any> = (payload: T) => void;

export interface BaseInitOptions {
  type: "inMemory" | "kafka";
}

export interface InMemoryOptions extends BaseInitOptions {
  type: "inMemory";
  host: string;
  port?: number;
  protocol: string;
}

export interface KafkaOptions extends BaseInitOptions {
  type: "kafka";
  clientId: string;
  brokers: string[];
  groupId: string;
}

export type InitOptions = InMemoryOptions | KafkaOptions;




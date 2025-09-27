import * as client from "prom-client";
import { EventManager } from "./eventManager";
import { EventMetrics } from "./metrics";
import { KafkaAdapter } from "./adapters/KafkaAdapter";
import { SocketAdapter } from "./adapters/SocketAdapter";
export declare const event: {
    init: (options: any) => Promise<void>;
    publish: <T = any>(...args: [...string[], T]) => Promise<void>;
    subscribe: (type: string, callback: any) => Promise<() => void>;
    disconnect: () => Promise<void>;
    checkBacklog: () => Promise<void>;
    startBacklogMonitoring: () => void;
    stopBacklogMonitoring: () => void;
    restartKafkaConsumer: () => Promise<void>;
};
export { client };
export { EventManager, EventMetrics, SocketAdapter, KafkaAdapter };
export * from "./types/types";

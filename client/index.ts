import * as client from "prom-client";

import { Callback } from "./types/types";
import { EventManager } from "./eventManager";
import { EventMetrics } from "./metrics";
import { KafkaAdapter } from "./adapters/KafkaAdapter";
import { SocketAdapter } from "./adapters/SocketAdapter";

const manager = new EventManager();

export const event = {
  init: (options: any) => manager.init(options),
  publish: <T extends object = object>(...args: [...string[], T]) => manager.publish(...args),
  subscribe: <T extends object = object>(type: string, callback: Callback<T>) => manager.subscribe(type, callback),
  disconnect: () => manager.disconnect(),
  checkBacklog: () => manager.checkBacklog(),
  
  startBacklogMonitoring: () => {
    console.log("Backlog monitoring starts automatically with Kafka adapter");
  },
  stopBacklogMonitoring: () => {
    console.log("Backlog monitoring stops automatically on disconnect");
  },
  restartKafkaConsumer: async () => {
    console.log("Consumer restart is handled automatically");
  },
};

export { client };

export { EventManager, EventMetrics, SocketAdapter, KafkaAdapter };
export * from "./types/types";
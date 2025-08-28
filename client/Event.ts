import { Callback, InitOptions } from "./adapters/types";

import { EventAdapter } from "./adapters/Adapter";
import { InMemoryAdapter } from "./adapters/InMemoryAdapter";
import { KafkaAdapter } from "./adapters/KafkaAdapter";

const event = {
  async init(options: InitOptions) {
    const adapter: EventAdapter =
      options.type === "inMemory" ? new InMemoryAdapter() : new KafkaAdapter();
    (this as any)._adapter = adapter;
    await adapter.init(options);
  },

  async publish<T = any>(...args: [...string[], T]): Promise<void> {
    const adapter: EventAdapter | undefined = (this as any)._adapter;
    if (!adapter) throw new Error("Event not initialized");
    await adapter.publish(...args);
  },

  async subscribe<T = any>(
    type: string,
    callback: Callback<T>
  ): Promise<() => void> {
    const adapter: EventAdapter | undefined = (this as any)._adapter;
    if (!adapter) throw new Error("Event not initialized");
    return adapter.subscribe(type, callback as any);
  },

  async cleanup() {
    const adapter: EventAdapter | undefined = (this as any)._adapter;
    if (!adapter) return;
    await adapter.cleanup();
  },
};

process.on("SIGINT", async () => {
  console.log("Shutting down gracefully...");
  await event.cleanup();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down gracefully...");
  await event.cleanup();
  process.exit(0);
});

export { event };

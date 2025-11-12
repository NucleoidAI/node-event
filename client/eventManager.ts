import { Callback, EventAdapter, InitOptions } from "./types/types";
import { EventMetrics, PushgatewayConfig } from "./metrics";

import { EVENT_TOPICS, BACKLOG_MONITORING } from "./constants";
import { EventSystemNotInitializedError, InvalidEventTypeError } from "./errors";
import { AdapterFactory } from "./factories/AdapterFactory";
import { CallbackRegistry } from "./CallbackRegistry";

export class EventManager {
  private adapter: EventAdapter | null = null;
  private callbackRegistry = new CallbackRegistry();
  private metrics = new EventMetrics();
  private backlogInterval: NodeJS.Timeout | null = null;
  private adapterFactory = new AdapterFactory();

  async init(options: InitOptions): Promise<void> {
    if (this.adapter) {
      await this.disconnect();
    }

    this.adapter = this.adapterFactory.create(options);
    await this.adapter.connect();

    this.adapter.onMessage((type, payload) => {
      this.handleIncomingMessage(type, payload);
    });

    // Set up callback to update metrics when subscriptions change
    this.callbackRegistry.setSubscriptionChangeCallback((type, count) => {
      this.metrics.updateSubscriptions(type, count);
    });

    // Start backlog monitoring for adapters that support it
    if (this.adapterFactory.supportsBacklog(this.adapter)) {
      this.startBacklogMonitoring();
    }
  }

  async publish<T extends object = object>(
    ...args: [...string[], T]
  ): Promise<void> {
    if (args.length < 1) {
      throw new InvalidEventTypeError("", { reason: "publish requires at least one event type and a payload" });
    }
    if (!this.adapter) {
      throw new EventSystemNotInitializedError();
    }
    const payload = args[args.length - 1] as T;
    const type = args.slice(0, -1) as string[];
    const mergedType = type.join("_");
    this.validateEventType(mergedType);
    const payloadSize = JSON.stringify(payload).length;
    const endTimer = this.metrics.recordPublish(mergedType, payloadSize);
    try {
      await this.adapter.publish(mergedType, payload);
      this.callbackRegistry.execute(mergedType, payload, () =>
        this.metrics.recordCallback(mergedType)
      );
      endTimer();
    } catch (error) {
      this.metrics.recordPublishError(mergedType, "publish_error");
      endTimer();
      throw error;
    }
  }

  async subscribe<T extends object = object>(
    type: string,
    callback: Callback<T>
  ): Promise<() => void> {
    const wasEmpty = !this.callbackRegistry.hasCallbacks(type);

    const unsubscribe = this.callbackRegistry.register(type, callback);

    // Subscribe to adapter if this is the first callback for this type
    if (this.adapter && wasEmpty) {
      await this.adapter.subscribe(type);
    }

    // Return async unsubscribe function
    return async () => {
      unsubscribe();

      // Unsubscribe from adapter if no more callbacks for this type
      if (!this.callbackRegistry.hasCallbacks(type) && this.adapter) {
        await this.adapter.unsubscribe(type);
      }
    };
  }

  async disconnect(): Promise<void> {
    this.stopBacklogMonitoring();

    if (this.adapter) {
      await this.adapter.disconnect();
      this.adapter = null;
    }

    this.callbackRegistry.clear();
  }

  private handleIncomingMessage(type: string, payload: object): void {
    this.callbackRegistry.execute(type, payload, () =>
      this.metrics.recordCallback(type)
    );
  }

  private validateEventType(type: string): void {
    if (
      type === "__proto__" ||
      type === "constructor" ||
      type === "prototype"
    ) {
      throw new InvalidEventTypeError(type, { reason: "Reserved keyword" });
    }
  }

  private startBacklogMonitoring(intervalMs: number = BACKLOG_MONITORING.DEFAULT_INTERVAL_MS): void {
    if (!this.adapter) return;

    // Prevent multiple intervals from being created
    if (this.backlogInterval) {
      console.warn("Backlog monitoring is already running");
      return;
    }

    // Only monitor for adapters that implement meaningful backlog
    if (!this.adapterFactory.supportsBacklog(this.adapter)) return;

    this.updateBacklogMetrics();

    this.backlogInterval = setInterval(() => {
      this.updateBacklogMetrics();
    }, intervalMs);
  }

  private stopBacklogMonitoring(): void {
    if (this.backlogInterval) {
      clearInterval(this.backlogInterval);
      this.backlogInterval = null;
    }
  }

  private async updateBacklogMetrics(): Promise<void> {
    if (!this.adapter) return;

    if (!this.adapterFactory.supportsBacklog(this.adapter)) return;

    try {
      const backlog = await this.adapter.getBacklog([...EVENT_TOPICS]);
      backlog.forEach((size, topic) => {
        this.metrics.updateEventBacklog(topic, size);
        console.log(`Backlog for topic ${topic}: ${size} messages`);
      });
    } catch (error) {
      console.error("Error updating backlog metrics:", error);
    }
  }

  async checkBacklog(): Promise<void> {
    await this.updateBacklogMetrics();
  }

  startPushgateway(config?: PushgatewayConfig): void {
    this.metrics.startPushgateway(config);
  }

  stopPushgateway(): void {
    this.metrics.stopPushgateway();
  }

  async pushMetricsToGateway(): Promise<void> {
    await this.metrics.pushMetricsToGateway();
  }

  getPushgatewayConfig(): PushgatewayConfig | undefined {
    return this.metrics.getPushgatewayConfig();
  }
}

import * as client from "prom-client";
import { PUSHGATEWAY_DEFAULTS, METRICS_BUCKETS } from "./constants";
import { PushgatewayNotConfiguredError, MetricsPushError } from "./errors";

export interface PushgatewayConfig {
  url?: string;
  jobName?: string;
  instance?: string;
  interval?: number;
}

export class EventMetrics {
  private readonly registry: client.Registry;
  private pushgatewayInterval?: NodeJS.Timeout;
  private pushgatewayConfig?: PushgatewayConfig;

  private readonly publishCounter: client.Counter<string>;
  private readonly subscriptionGauge: client.Gauge<string>;
  private readonly publishDuration: client.Histogram<string>;
  private readonly payloadSize: client.Histogram<string>;
  private readonly publishErrors: client.Counter<string>;
  private readonly callbackDuration: client.Histogram<string>;
  private readonly throughput: client.Counter<string>;
  private readonly eventBacklog: client.Gauge<string>;

  constructor() {
    this.registry = new client.Registry();

    this.publishCounter = new client.Counter({
      name: "events_published_total",
      help: "Total number of events published",
      labelNames: ["event_type"],
      registers: [this.registry],
    });

    this.subscriptionGauge = new client.Gauge({
      name: "active_event_subscriptions",
      help: "Number of active event subscriptions",
      labelNames: ["event_type"],
      registers: [this.registry],
    });

    this.publishDuration = new client.Histogram({
      name: "event_publish_duration_seconds",
      help: "Time taken to publish events",
      labelNames: ["event_type"],
      buckets: METRICS_BUCKETS.DURATION_SECONDS,
      registers: [this.registry],
    });

    this.payloadSize = new client.Histogram({
      name: "event_payload_size_bytes",
      help: "Size of event payloads in bytes",
      labelNames: ["event_type"],
      buckets: METRICS_BUCKETS.PAYLOAD_SIZE_BYTES,
      registers: [this.registry],
    });

    this.publishErrors = new client.Counter({
      name: "event_publish_errors_total",
      help: "Total number of event publish errors",
      labelNames: ["event_type", "error_type"],
      registers: [this.registry],
    });

    this.callbackDuration = new client.Histogram({
      name: "event_callback_duration_seconds",
      help: "Time taken to process event callbacks",
      labelNames: ["event_type"],
      buckets: METRICS_BUCKETS.DURATION_SECONDS,
      registers: [this.registry],
    });

    this.throughput = new client.Counter({
      name: "event_callbacks_processed_total",
      help: "Total number of event callbacks processed successfully",
      labelNames: ["event_type"],
      registers: [this.registry],
    });

    this.eventBacklog = new client.Gauge({
      name: "backlog_events_total",
      help: "Total number of events waiting to be processed",
      labelNames: ["topic"],
      registers: [this.registry],
    });
  }

  recordPublish(type: string, payloadSizeBytes: number): () => void {
    this.publishCounter.labels(type).inc();
    this.payloadSize.labels(type).observe(payloadSizeBytes);
    return this.publishDuration.labels(type).startTimer();
  }

  recordPublishError(type: string, errorType: string): void {
    this.publishErrors.labels(type, errorType).inc();
  }

  recordCallback(type: string): () => void {
    this.throughput.labels(type).inc();
    return this.callbackDuration.labels(type).startTimer();
  }

  updateSubscriptions(type: string, count: number): void {
    this.subscriptionGauge.labels(type).set(count);
  }

  updateEventBacklog(topic: string, size: number): void {
    this.eventBacklog.labels(topic).set(size);
  }

  startPushgateway(config: PushgatewayConfig = {}): void {
    this.pushgatewayConfig = {
      url: config.url || PUSHGATEWAY_DEFAULTS.URL,
      jobName: config.jobName || PUSHGATEWAY_DEFAULTS.JOB_NAME,
      instance: config.instance || PUSHGATEWAY_DEFAULTS.INSTANCE,
      interval: config.interval || PUSHGATEWAY_DEFAULTS.INTERVAL_MS,
    };

    this.stopPushgateway();

    this.pushgatewayInterval = setInterval(() => {
      this.pushMetricsToGateway();
    }, this.pushgatewayConfig.interval);

    console.log(
      `Started pushing metrics to Pushgateway every ${this.pushgatewayConfig.interval}ms`
    );
  }

  stopPushgateway(): void {
    if (this.pushgatewayInterval) {
      clearInterval(this.pushgatewayInterval);
      this.pushgatewayInterval = undefined;
      console.log("Stopped pushing metrics to Pushgateway");
    }
  }

  async pushMetricsToGateway(): Promise<void> {
    if (!this.pushgatewayConfig) {
      throw new PushgatewayNotConfiguredError();
    }

    try {
      const body = await this.registry.metrics();
      let url = `${this.pushgatewayConfig.url}/metrics/job/${this.pushgatewayConfig.jobName}`;

      if (this.pushgatewayConfig.instance) {
        url += `/instance/${this.pushgatewayConfig.instance}`;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log("Metrics pushed to Pushgateway successfully");
    } catch (err) {
      console.error("Failed to push metrics to Pushgateway:", err);
      throw new MetricsPushError(err as Error);
    }
  }

  getPushgatewayConfig(): PushgatewayConfig | undefined {
    return this.pushgatewayConfig;
  }
}

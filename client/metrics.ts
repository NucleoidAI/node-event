import * as client from "prom-client";

export interface PushgatewayConfig {
  url?: string;
  jobName?: string;
  instance?: string;
  interval?: number;
}

export class EventMetrics {
  private pushgatewayInterval?: NodeJS.Timeout;
  private pushgatewayConfig?: PushgatewayConfig;

  private readonly publishCounter = new client.Counter({
    name: "events_published_total",
    help: "Total number of events published",
    labelNames: ["event_type"],
  });

  private readonly subscriptionGauge = new client.Gauge({
    name: "active_event_subscriptions",
    help: "Number of active event subscriptions",
    labelNames: ["event_type"],
  });

  private readonly publishDuration = new client.Histogram({
    name: "event_publish_duration_seconds",
    help: "Time taken to publish events",
    labelNames: ["event_type"],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  });

  private readonly payloadSize = new client.Histogram({
    name: "event_payload_size_bytes",
    help: "Size of event payloads in bytes",
    labelNames: ["event_type"],
    buckets: [10, 100, 1000, 10000, 100000, 1000000],
  });

  private readonly publishErrors = new client.Counter({
    name: "event_publish_errors_total",
    help: "Total number of event publish errors",
    labelNames: ["event_type", "error_type"],
  });

  private readonly callbackDuration = new client.Histogram({
    name: "event_callback_duration_seconds",
    help: "Time taken to process event callbacks",
    labelNames: ["event_type"],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  });

  private readonly throughput = new client.Counter({
    name: "event_callbacks_processed_total",
    help: "Total number of event callbacks processed successfully",
    labelNames: ["event_type"],
  });

  private readonly kafkaBacklog = new client.Gauge({
    name: "kafka_backlog_events_total",
    help: "Total number of events waiting to be processed",
    labelNames: ["topic"],
  });

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

  updateKafkaBacklog(topic: string, size: number): void {
    this.kafkaBacklog.labels(topic).set(size);
  }

  startPushgateway(config: PushgatewayConfig = {}): void {
    this.pushgatewayConfig = {
      url: config.url || "http://localhost:9091",
      jobName: config.jobName || "node_events",
      instance: config.instance || "default_instance",
      interval: config.interval || 15000,
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
      throw new Error(
        "Pushgateway not configured. Call startPushgateway() first."
      );
    }

    try {
      const body = await client.register.metrics();
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
    }
  }

  getPushgatewayConfig(): PushgatewayConfig | undefined {
    return this.pushgatewayConfig;
  }
}

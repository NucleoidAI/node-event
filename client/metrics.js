"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventMetrics = void 0;
const client = __importStar(require("prom-client"));
class EventMetrics {
    registry;
    pushgatewayInterval;
    pushgatewayConfig;
    publishCounter;
    subscriptionGauge;
    publishDuration;
    payloadSize;
    publishErrors;
    callbackDuration;
    throughput;
    eventBacklog;
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
            buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
            registers: [this.registry],
        });
        this.payloadSize = new client.Histogram({
            name: "event_payload_size_bytes",
            help: "Size of event payloads in bytes",
            labelNames: ["event_type"],
            buckets: [10, 100, 1000, 10000, 100000, 1000000],
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
            buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
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
    recordPublish(type, payloadSizeBytes) {
        this.publishCounter.labels(type).inc();
        this.payloadSize.labels(type).observe(payloadSizeBytes);
        return this.publishDuration.labels(type).startTimer();
    }
    recordPublishError(type, errorType) {
        this.publishErrors.labels(type, errorType).inc();
    }
    recordCallback(type) {
        this.throughput.labels(type).inc();
        return this.callbackDuration.labels(type).startTimer();
    }
    updateSubscriptions(type, count) {
        this.subscriptionGauge.labels(type).set(count);
    }
    updateEventBacklog(topic, size) {
        this.eventBacklog.labels(topic).set(size);
    }
    startPushgateway(config = {}) {
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
        console.log(`Started pushing metrics to Pushgateway every ${this.pushgatewayConfig.interval}ms`);
    }
    stopPushgateway() {
        if (this.pushgatewayInterval) {
            clearInterval(this.pushgatewayInterval);
            this.pushgatewayInterval = undefined;
            console.log("Stopped pushing metrics to Pushgateway");
        }
    }
    async pushMetricsToGateway() {
        if (!this.pushgatewayConfig) {
            throw new Error("Pushgateway not configured. Call startPushgateway() first.");
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
        }
        catch (err) {
            console.error("Failed to push metrics to Pushgateway:", err);
        }
    }
    getPushgatewayConfig() {
        return this.pushgatewayConfig;
    }
}
exports.EventMetrics = EventMetrics;

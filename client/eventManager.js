"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventManager = void 0;
const metrics_1 = require("./metrics");
const KafkaAdapter_1 = require("./adapters/KafkaAdapter");
const SocketAdapter_1 = require("./adapters/SocketAdapter");
const KAFKA_TOPICS = [
    "KNOWLEDGE_CREATED",
    "MESSAGE_USER_MESSAGED",
    "SESSION_USER_MESSAGED",
    "TASK_CREATED",
    "STEP_ADDED",
    "STEP_COMPLETED",
    "MESSAGE_USER_MESSAGED",
    "MESSAGE_ASSISTANT_MESSAGED",
    "SESSION_INITIATED",
    "SESSION_USER_MESSAGED",
    "SESSION_AI_MESSAGED",
    "SUPERVISING_RAISED",
    "SUPERVISING_ANSWERED",
    "TASK_COMPLETED",
    "KNOWLEDGES_LOADED",
    "MESSAGES_LOADED",
];
class EventManager {
    adapter = null;
    callbacks = new Map();
    metrics = new metrics_1.EventMetrics();
    backlogInterval = null;
    async init(options) {
        if (this.adapter) {
            await this.disconnect();
        }
        switch (options.type) {
            case "inMemory":
                this.adapter = new SocketAdapter_1.SocketAdapter({
                    host: options.host,
                    port: options.port,
                    protocol: options.protocol,
                });
                break;
            case "kafka":
                this.adapter = new KafkaAdapter_1.KafkaAdapter({
                    clientId: options.clientId,
                    brokers: options.brokers,
                    groupId: options.groupId,
                    topics: KAFKA_TOPICS,
                });
                this.startBacklogMonitoring();
                break;
            default:
                throw new Error(`Unknown adapter type`);
        }
        await this.adapter.connect();
        this.adapter.onMessage((type, payload) => {
            this.handleIncomingMessage(type, payload);
        });
    }
    async publish(...args) {
        if (args.length < 1) {
            throw new Error("publish requires at least one event type and a payload");
        }
        if (!this.adapter) {
            throw new Error("Event system not initialized");
        }
        const payload = args[args.length - 1];
        const type = args.slice(0, -1);
        const mergedType = type.join("_");
        this.validateEventType(mergedType);
        const payloadSize = JSON.stringify(payload).length;
        const endTimer = this.metrics.recordPublish(mergedType, payloadSize);
        try {
            await this.adapter.publish(mergedType, payload);
            this.executeCallbacks(mergedType, payload);
            endTimer();
        }
        catch (error) {
            this.metrics.recordPublishError(mergedType, "publish_error");
            endTimer();
            throw error;
        }
    }
    async subscribe(type, callback) {
        if (!this.callbacks.has(type)) {
            this.callbacks.set(type, new Set());
        }
        const callbackSet = this.callbacks.get(type);
        callbackSet.add(callback);
        this.metrics.updateSubscriptions(type, callbackSet.size);
        if (this.adapter && callbackSet.size === 1) {
            await this.adapter.subscribe(type);
        }
        return async () => {
            callbackSet.delete(callback);
            if (callbackSet.size === 0) {
                this.callbacks.delete(type);
                if (this.adapter) {
                    await this.adapter.unsubscribe(type);
                }
            }
            this.metrics.updateSubscriptions(type, callbackSet.size);
        };
    }
    async disconnect() {
        this.stopBacklogMonitoring();
        if (this.adapter) {
            await this.adapter.disconnect();
            this.adapter = null;
        }
        this.callbacks.clear();
    }
    handleIncomingMessage(type, payload) {
        this.executeCallbacks(type, payload);
    }
    executeCallbacks(type, payload) {
        const callbackSet = this.callbacks.get(type);
        if (!callbackSet)
            return; // No callbacks for this topic - message ignored
        callbackSet.forEach((callback) => {
            setTimeout(() => {
                const endTimer = this.metrics.recordCallback(type);
                try {
                    callback(payload);
                }
                catch (error) {
                    console.error(`Error in callback for ${type}:`, error);
                }
                endTimer();
            }, 0);
        });
    }
    validateEventType(type) {
        if (type === "__proto__" ||
            type === "constructor" ||
            type === "prototype") {
            throw new Error("Invalid event type");
        }
    }
    startBacklogMonitoring(intervalMs = 30000) {
        if (!(this.adapter instanceof KafkaAdapter_1.KafkaAdapter))
            return;
        this.updateBacklogMetrics();
        this.backlogInterval = setInterval(() => {
            this.updateBacklogMetrics();
        }, intervalMs);
    }
    stopBacklogMonitoring() {
        if (this.backlogInterval) {
            clearInterval(this.backlogInterval);
            this.backlogInterval = null;
        }
    }
    async updateBacklogMetrics() {
        if (!(this.adapter instanceof KafkaAdapter_1.KafkaAdapter))
            return;
        try {
            const backlog = await this.adapter.getBacklog(KAFKA_TOPICS);
            backlog.forEach((size, topic) => {
                this.metrics.updateKafkaBacklog(topic, size);
                console.log(`Backlog for topic ${topic}: ${size} messages`);
            });
        }
        catch (error) {
            console.error("Error updating backlog metrics:", error);
        }
    }
    async checkBacklog() {
        await this.updateBacklogMetrics();
    }
    startPushgateway(config) {
        this.metrics.startPushgateway(config);
    }
    stopPushgateway() {
        this.metrics.stopPushgateway();
    }
    async pushMetricsToGateway() {
        await this.metrics.pushMetricsToGateway();
    }
    getPushgatewayConfig() {
        return this.metrics.getPushgatewayConfig();
    }
}
exports.EventManager = EventManager;

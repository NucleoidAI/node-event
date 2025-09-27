"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KafkaAdapter = void 0;
const kafkajs_1 = require("kafkajs");
class KafkaAdapter {
    options;
    kafka;
    consumer = null;
    producer = null;
    messageHandler;
    subscribedTopics = new Set();
    isRunning = false;
    constructor(options) {
        this.options = options;
        this.kafka = new kafkajs_1.Kafka({
            clientId: options.clientId,
            brokers: options.brokers,
        });
    }
    async connect() {
        this.producer = this.kafka.producer();
        await this.producer.connect();
    }
    async disconnect() {
        if (this.consumer && this.isRunning) {
            await this.consumer.stop();
            await this.consumer.disconnect();
            this.consumer = null;
            this.isRunning = false;
        }
        this.subscribedTopics.clear();
    }
    async publish(type, payload) {
        const producer = this.kafka.producer();
        await producer.connect();
        try {
            await producer.send({
                topic: type,
                messages: [{ value: JSON.stringify(payload) }],
            });
        }
        finally {
            await producer.disconnect();
        }
    }
    async subscribe(type) {
        if (!this.subscribedTopics.has(type)) {
            this.subscribedTopics.add(type);
            await this.restartConsumer();
        }
    }
    async unsubscribe(type) {
        this.subscribedTopics.delete(type);
        if (this.subscribedTopics.size > 0) {
            await this.restartConsumer();
        }
        else if (this.consumer) {
            await this.consumer.stop();
            await this.consumer.disconnect();
            this.consumer = null;
            this.isRunning = false;
        }
    }
    onMessage(handler) {
        this.messageHandler = handler;
    }
    async restartConsumer() {
        if (this.subscribedTopics.size === 0)
            return;
        if (this.consumer && this.isRunning) {
            console.log("Stopping existing Kafka consumer...");
            await this.consumer.stop();
            await this.consumer.disconnect();
            this.isRunning = false;
        }
        console.log(`Starting Kafka consumer with topics: ${Array.from(this.subscribedTopics).join(", ")}`);
        this.consumer = this.kafka.consumer({ groupId: this.options.groupId });
        await this.consumer.connect();
        await this.consumer.subscribe({
            topics: Array.from(this.subscribedTopics),
            fromBeginning: false,
        });
        await this.consumer.run({
            partitionsConsumedConcurrently: 1,
            eachMessage: async ({ topic, message }) => {
                if (this.messageHandler) {
                    try {
                        const payload = JSON.parse(message.value?.toString() || "{}");
                        this.messageHandler(topic, payload);
                    }
                    catch (error) {
                        console.error(`Error processing message for topic ${topic}:`, error);
                    }
                }
            },
        });
        this.isRunning = true;
    }
    async getBacklog() {
        const backlogMap = new Map();
        if (this.subscribedTopics.size === 0)
            return backlogMap;
        const admin = this.kafka.admin();
        await admin.connect();
        try {
            for (const topic of this.subscribedTopics) {
                const offsetsResponse = await admin.fetchOffsets({
                    groupId: this.options.groupId,
                    topics: [topic],
                });
                const topicOffsets = await admin.fetchTopicOffsets(topic);
                let totalLag = 0;
                const topicResponse = offsetsResponse.find(r => r.topic === topic);
                if (topicResponse) {
                    topicResponse.partitions.forEach((partitionOffset) => {
                        const latestOffset = topicOffsets.find(to => to.partition === partitionOffset.partition);
                        if (latestOffset) {
                            const consumerOffset = parseInt(partitionOffset.offset);
                            const latestOffsetValue = parseInt(latestOffset.offset);
                            totalLag += Math.max(0, latestOffsetValue - consumerOffset);
                        }
                    });
                }
                backlogMap.set(topic, totalLag);
            }
        }
        finally {
            await admin.disconnect();
        }
        return backlogMap;
    }
}
exports.KafkaAdapter = KafkaAdapter;

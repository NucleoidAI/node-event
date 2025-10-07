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
    topics;
    constructor(options) {
        this.options = options;
        this.kafka = new kafkajs_1.Kafka({
            clientId: options.clientId,
            brokers: options.brokers,
        });
        this.topics = options.topics;
    }
    async connect() {
        this.producer = this.kafka.producer();
        await this.producer.connect();
        this.consumer = this.kafka.consumer({ groupId: this.options.groupId });
        await this.consumer.connect();
        await this.consumer.subscribe({
            topics: this.topics,
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
        console.log(`Kafka consumer started with topics: ${this.topics.join(", ")}`);
    }
    async disconnect() {
        if (this.consumer) {
            await this.consumer.stop();
            await this.consumer.disconnect();
            this.consumer = null;
        }
        if (this.producer) {
            await this.producer.disconnect();
            this.producer = null;
        }
    }
    async publish(type, payload) {
        if (!this.producer) {
            throw new Error("Producer not connected");
        }
        await this.producer.send({
            topic: type,
            messages: [{ value: JSON.stringify(payload) }],
        });
    }
    async subscribe(type) {
        // EventManager handles callback registration in memory
    }
    async unsubscribe(type) {
        // EventManager handles callback removal in memory
    }
    onMessage(handler) {
        this.messageHandler = handler;
    }
    async getBacklog() {
        const backlogMap = new Map();
        const admin = this.kafka.admin();
        await admin.connect();
        try {
            for (const topic of this.topics) {
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

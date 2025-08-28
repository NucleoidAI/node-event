import { Callback, EventAdapter, InitOptions, KafkaOptions } from "./types";
import { Consumer, Kafka, Producer } from "kafkajs";

const callbacks: Record<string, Set<Callback>> = {};

export class KafkaAdapter implements EventAdapter {
  private kafka: Kafka | null = null;
  private kafkaProducer: Producer | null = null;
  private kafkaConsumers: Map<string, Consumer> = new Map();
  private kafkaGroupId: string | null = null;

  async init(options: InitOptions): Promise<void> {
    const opts = options as KafkaOptions;
    if (!opts.clientId) {
      throw new Error("clientId is required for Kafka initialization");
    }
    if (!opts.brokers || !Array.isArray(opts.brokers) || opts.brokers.length === 0) {
      throw new Error("brokers array is required for Kafka initialization");
    }
    if (!opts.groupId) {
      throw new Error("groupId is required for Kafka initialization");
    }

    this.kafka = new Kafka({
      clientId: opts.clientId,
      brokers: opts.brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8,
        multiplier: 2,
        maxRetryTime: 30000,
      },
      connectionTimeout: 10000,
      requestTimeout: 30000,
    });

    this.kafkaGroupId = opts.groupId;

    this.kafkaProducer = this.kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
    });

    await this.kafkaProducer.connect();
    this.kafkaProducer.on("producer.disconnect", () => {
      console.error("Producer disconnected");
    });
  }

  async publish<T = any>(...args: [...string[], T]): Promise<void> {
    if (!this.kafka || !this.kafkaProducer) return;
    const payload = args[args.length - 1];
    const types = args.slice(0, -1) as string[];
    try {
      const messages = types.map((type) => ({
        topic: type,
        messages: [
          {
            value: JSON.stringify(payload),
            timestamp: Date.now().toString(),
          },
        ],
      }));
      await Promise.all(messages.map((msg) => this.kafkaProducer!.send(msg)));
    } catch (error: any) {
      console.error("Failed to publish to Kafka:", error);
      if (error.message?.includes("disconnected")) {
        try {
          await this.kafkaProducer.connect();
          await this.publish(...args);
        } catch (reconnectError: any) {
          throw new Error(`Failed to reconnect producer: ${reconnectError.message}`);
        }
      } else {
        throw error;
      }
    }
  }

  async subscribe<T = any>(type: string, callback: Callback<T>): Promise<() => void> {
    if (!callbacks[type]) callbacks[type] = new Set();
    callbacks[type].add(callback as Callback);

    if (!this.kafka) {
      return async () => {
        callbacks[type].delete(callback as Callback);
        if (callbacks[type].size === 0) delete callbacks[type];
      };
    }

    if (!this.kafkaConsumers.has(type)) {
      const consumer = this.kafka.consumer({
        groupId: `${this.kafkaGroupId}-${type}`,
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
      });

      await consumer.connect();
      await consumer.subscribe({ topic: type, fromBeginning: false });
      await consumer.run({
        autoCommit: true,
        eachMessage: async ({ topic, partition, message }) => {
          if (callbacks[topic]) {
            try {
              const payload = JSON.parse(message.value?.toString() || "{}");
              callbacks[topic].forEach((cb) => cb(payload));
            } catch (error) {
              console.error(`Failed to parse message from topic ${topic}:`, error);
            }
          }
        },
      });

      consumer.on("consumer.disconnect", () => {
        console.error(`Consumer for topic ${type} disconnected`);
        this.kafkaConsumers.delete(type);
      });

      this.kafkaConsumers.set(type, consumer);
    }

    return async () => {
      callbacks[type].delete(callback as Callback);
      if (callbacks[type].size === 0) {
        delete callbacks[type];
        const consumer = this.kafkaConsumers.get(type);
        if (consumer) {
          await consumer.disconnect();
          this.kafkaConsumers.delete(type);
        }
      }
    };
  }

  async cleanup(): Promise<void> {
    const entries = Array.from(this.kafkaConsumers.entries());
    for (const [topic, consumer] of entries) {
      try {
        await consumer.disconnect();
      } catch (error) {
        console.error(`Failed to disconnect consumer for ${topic}:`, error);
      }
    }
    this.kafkaConsumers.clear();

    if (this.kafkaProducer) {
      try {
        await this.kafkaProducer.disconnect();
      } catch (error) {
        console.error("Failed to disconnect producer:", error);
      }
      this.kafkaProducer = null;
    }

    this.kafka = null;
  }
}



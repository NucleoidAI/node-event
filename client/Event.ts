import { Consumer, Kafka, Producer } from "kafkajs";
import { Socket, io } from "socket.io-client";

let socket: Socket | null = null;
let kafka: Kafka | null = null;
let kafkaProducer: Producer | null = null;
let kafkaConsumers: Map<string, Consumer> = new Map();
let kafkaGroupId: string | null = null;

const callbacks: Record<string, Set<Callback>> = {};

interface BaseInitOptions {
  type: "inMemory" | "socket" | "kafka";
}

interface InMemoryOptions extends BaseInitOptions {
  type: "inMemory";
  host: string;
  port?: number;
  protocol: string;
}

interface KafkaOptions extends BaseInitOptions {
  type: "kafka";
  clientId: string;
  brokers: string[];
  groupId: string;
}

type InitOptions = InMemoryOptions | KafkaOptions;
type Callback<T = any> = (payload: T) => void;

const event = {
  async init(options: InitOptions) {
    switch (options.type) {
      case "inMemory":
        if (!options.host) {
          throw new Error("host is required for inMemory initialization");
        }
        if (!options.protocol) {
          throw new Error("protocol is required for inMemory initialization");
        }

        const { host, protocol } = options;
        const socketPath = options?.port
          ? `${protocol}://${host}:${options.port}`
          : `${protocol}://${host}`;

        socket = io(socketPath);
        socket.on(
          "event",
          ({ type, payload }: { type: string; payload: any }) => {
            if (callbacks[type]) {
              callbacks[type].forEach((cb) => cb(payload));
            }
          }
        );
        break;

      case "kafka":
        if (!options.clientId) {
          throw new Error("clientId is required for Kafka initialization");
        }
        if (
          !options.brokers ||
          !Array.isArray(options.brokers) ||
          options.brokers.length === 0
        ) {
          throw new Error("brokers array is required for Kafka initialization");
        }
        if (!options.groupId) {
          throw new Error("groupId is required for Kafka initialization");
        }

        kafka = new Kafka({
          clientId: options.clientId,
          brokers: options.brokers,
          retry: {
            initialRetryTime: 100,
            retries: 8,
            multiplier: 2,
            maxRetryTime: 30000,
          },
          connectionTimeout: 10000,
          requestTimeout: 30000,
        });

        kafkaGroupId = options.groupId;

        kafkaProducer = kafka.producer({
          allowAutoTopicCreation: true,
          transactionTimeout: 30000,
        });

        await kafkaProducer.connect();

        kafkaProducer.on("producer.disconnect", () => {
          console.error("Producer disconnected");
        });

        break;
    }
  },

  async publish<T = any>(...args: [...string[], T]): Promise<void> {
    if (args.length < 2) {
      throw new Error("publish requires at least one event type and a payload");
    }

    const payload = args[args.length - 1];
    const types = args.slice(0, -1) as string[];

    if (socket) {
      types.forEach((type) => {
        socket!.emit("publish", { type, payload });
      });
    } else if (kafka && kafkaProducer) {
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

        await Promise.all(messages.map((msg) => kafkaProducer!.send(msg)));
      } catch (error) {
        console.error("Failed to publish to Kafka:", error);

        if (error.message?.includes("disconnected")) {
          try {
            await kafkaProducer.connect();
            await this.publish(...args);
          } catch (reconnectError) {
            throw new Error(
              `Failed to reconnect producer: ${reconnectError.message}`
            );
          }
        } else {
          throw error;
        }
      }
    }
  },

  async subscribe<T = any>(
    type: string,
    callback: Callback<T>
  ): Promise<() => void> {
    if (!callbacks[type]) callbacks[type] = new Set();
    callbacks[type].add(callback as Callback);

    if (socket) {
      socket!.emit("subscribe", type);
    } else if (kafka) {
      if (!kafkaConsumers.has(type)) {
        const consumer = kafka.consumer({
          groupId: `${kafkaGroupId}-${type}`,
          sessionTimeout: 30000,
          heartbeatInterval: 3000,
        });

        await consumer.connect();
        await consumer.subscribe({
          topic: type,
          fromBeginning: false,
        });

        await consumer.run({
          autoCommit: true,
          eachMessage: async ({ topic, partition, message }) => {
            if (callbacks[topic]) {
              try {
                const payload = JSON.parse(message.value?.toString() || "{}");
                callbacks[topic].forEach((cb) => cb(payload));
              } catch (error) {
                console.error(
                  `Failed to parse message from topic ${topic}:`,
                  error
                );
              }
            }
          },
        });

        consumer.on("consumer.disconnect", () => {
          console.error(`Consumer for topic ${type} disconnected`);
          kafkaConsumers.delete(type);
        });

        kafkaConsumers.set(type, consumer);
      }
    }

    return async () => {
      callbacks[type].delete(callback as Callback);
      if (callbacks[type].size === 0) {
        delete callbacks[type];
        if (socket) {
          socket.emit("unsubscribe", type);
        } else if (kafka) {
          const consumer = kafkaConsumers.get(type);
          if (consumer) {
            await consumer.disconnect();
            kafkaConsumers.delete(type);
          }
        }
      }
    };
  },

  async cleanup() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }

    if (kafka) {
      const entries = Array.from(kafkaConsumers.entries());
      for (const [topic, consumer] of entries) {
        try {
          await consumer.disconnect();
        } catch (error) {
          console.error(`Failed to disconnect consumer for ${topic}:`, error);
        }
      }
      kafkaConsumers.clear();

      if (kafkaProducer) {
        try {
          await kafkaProducer.disconnect();
        } catch (error) {
          console.error("Failed to disconnect producer:", error);
        }
        kafkaProducer = null;
      }

      kafka = null;
    }
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

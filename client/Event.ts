import { Socket, io } from "socket.io-client";

import { Kafka } from "kafkajs";

let socket: Socket | null = null;
let kafka: Kafka | null = null;
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
  init(options: InitOptions) {
    switch (options.type) {
      case "inMemory":
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
        kafka = new Kafka({
          clientId: options.clientId,
          brokers: options.brokers,
        });
        kafkaGroupId = options.groupId;
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
    } else if (kafka) {
      const producer = kafka!.producer();
      await producer.connect();

      types.forEach((type) => {
        producer.send({
          topic: type,
          messages: [{ value: JSON.stringify(payload) }],
        });
      });

      await producer.disconnect();
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
      const consumer = kafka!.consumer({ groupId: kafkaGroupId! });
      await consumer.connect();
      await consumer.subscribe({ topic: type, fromBeginning: true });

      consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          if (callbacks[topic]) {
            callbacks[topic].forEach((cb) =>
              cb(JSON.parse(message.value?.toString() || ""))
            );
          }
        },
      });
    }

    return async () => {
      callbacks[type].delete(callback as Callback);
      if (callbacks[type].size === 0) {
        delete callbacks[type];
        socket!.emit("unsubscribe", type);
      }
    };
  },
};

export { event };


import * as client from "prom-client";

import { Consumer, Kafka } from "kafkajs";
import { Socket, io } from "socket.io-client";

let socket: Socket | null = null;
let kafka: Kafka | null = null;
let kafkaGroupId: string | null = null;
let sharedConsumer: Consumer | null = null;
let subscribedTopics: Set<string> = new Set();

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

const eventPublishCounter = new client.Counter({
  name: "events_published_total",
  help: "Total number of events published",
  labelNames: ["event_type"],
});

const eventSubscriptionGauge = new client.Gauge({
  name: "active_event_subscriptions",
  help: "Number of active event subscriptions",
  labelNames: ["event_type"],
});

const eventPublishDuration = new client.Histogram({
  name: "event_publish_duration_seconds",
  help: "Time taken to publish events",
  labelNames: ["event_type"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

// Track payload size for analysis
const eventPayloadSize = new client.Histogram({
  name: "event_payload_size_bytes",
  help: "Size of event payloads in bytes",
  labelNames: ["event_type"],
  buckets: [10, 100, 1000, 10000, 100000, 1000000],
});

// Track error rates
const eventPublishErrors = new client.Counter({
  name: "event_publish_errors_total",
  help: "Total number of event publish errors",
  labelNames: ["event_type", "error_type"],
});

// Track callback processing duration
const callbackProcessingDuration = new client.Histogram({
  name: "event_callback_duration_seconds",
  help: "Time taken to process event callbacks",
  labelNames: ["event_type"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

// Track subscription rates
const subscriptionRate = new client.Counter({
  name: "event_subscriptions_total",
  help: "Total number of event subscriptions created",
  labelNames: ["event_type"],
});

// Track unsubscription rates
const unsubscriptionRate = new client.Counter({
  name: "event_unsubscriptions_total",
  help: "Total number of event unsubscriptions",
  labelNames: ["event_type"],
});

// Track throughput (events processed per second)
const eventThroughput = new client.Counter({
  name: "event_callbacks_processed_total",
  help: "Total number of event callbacks processed successfully",
  labelNames: ["event_type"],
});

const event = {
  init(options: InitOptions) {
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

    for (const type of types) {
      console.log("node-event", "publish", type, payload);

      if (
        type === "__proto__" ||
        type === "constructor" ||
        type === "prototype"
      ) {
        throw new Error("Invalid publish type");
      }

      const endTimer = eventPublishDuration.labels(type).startTimer();
      eventPublishCounter.labels(type).inc();

      const payloadSize = JSON.stringify(payload).length;
      eventPayloadSize.labels(type).observe(payloadSize);

      if (socket) {
        socket!.emit("publish", { type, payload });
      } else if (kafka) {
        const producer = kafka!.producer();
        await producer.connect();

        await producer.send({
          topic: type,
          messages: [{ value: JSON.stringify(payload) }],
        });

        await producer.disconnect();
      }

      if (callbacks[type]) {
        callbacks[type].forEach((callback) => {
          setTimeout(() => {
            const callbackTimer = callbackProcessingDuration
              .labels(type)
              .startTimer();

            callback(payload);
            eventThroughput.labels(type).inc();
            callbackTimer();
          }, 0);
        });
      }

      endTimer();
    }
  },

  async subscribe<T = any>(
    type: string,
    callback: Callback<T>
  ): Promise<() => void> {
    if (!callbacks[type]) callbacks[type] = new Set();

    callbacks[type].add(callback as Callback);

    subscriptionRate.labels(type).inc();
    eventSubscriptionGauge.labels(type).set(callbacks[type].size);

    if (socket) {
      socket!.emit("subscribe", type);
    } else if (kafka) {
      if (!sharedConsumer) {
        sharedConsumer = kafka!.consumer({ groupId: kafkaGroupId! });
        await sharedConsumer.connect();
        await sharedConsumer.run({
          eachMessage: async ({ topic, partition, message }) => {
            if (callbacks[topic]) {
              const payload = JSON.parse(message.value?.toString() || "{}");
              callbacks[topic].forEach((cb) => cb(payload));
            }
          },
        });
      }

      if (!subscribedTopics.has(type)) {
        await sharedConsumer.subscribe({ topic: type, fromBeginning: false });
        subscribedTopics.add(type);
      }
    }

    return async () => {
      callbacks[type].delete(callback as Callback);

      unsubscriptionRate.labels(type).inc();

      if (callbacks[type].size === 0) {
        delete callbacks[type];
        eventSubscriptionGauge.labels(type).set(0);
        if (socket) {
          socket.emit("unsubscribe", type);
        }
      } else {
        eventSubscriptionGauge.labels(type).set(callbacks[type].size);
      }
    };
  },

  async disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    } else if (kafka) {
      if (sharedConsumer) {
        await sharedConsumer.disconnect();
        sharedConsumer = null;
      }

      subscribedTopics.clear();
      kafka = null;
    }

    Object.keys(callbacks).forEach((key) => delete callbacks[key]);
  },
};

export { event };

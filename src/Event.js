"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.client =
  exports.last =
  exports.messages =
  exports.publish =
  exports.subscribe =
    void 0;

const client = require("prom-client");
const { v4: uuid } = require("uuid");

const subscriptions = {};
const messages = new Map();

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

const eventPayloadSize = new client.Histogram({
  name: "event_payload_size_bytes",
  help: "Size of event payloads in bytes",
  labelNames: ["event_type"],
  buckets: [10, 100, 1000, 10000, 100000, 1000000],
});

const eventPublishErrors = new client.Counter({
  name: "event_publish_errors_total",
  help: "Total number of event publish errors",
  labelNames: ["event_type", "error_type"],
});

const callbackProcessingDuration = new client.Histogram({
  name: "event_callback_duration_seconds",
  help: "Time taken to process event callbacks",
  labelNames: ["event_type"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

const subscriptionRate = new client.Counter({
  name: "event_subscriptions_total",
  help: "Total number of event subscriptions created",
  labelNames: ["event_type"],
});

const unsubscriptionRate = new client.Counter({
  name: "event_unsubscriptions_total",
  help: "Total number of event unsubscriptions",
  labelNames: ["event_type"],
});

const eventThroughput = new client.Counter({
  name: "event_callbacks_processed_total",
  help: "Total number of event callbacks processed successfully",
  labelNames: ["event_type"],
});

const colors = [
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "gray",
];

function typeColor(type) {
  const hash = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  };

  const colorIndex = hash(type) % colors.length;
  return colors[colorIndex];
}

const subscribe = (...args) => {
  if (args.length < 2) {
    throw new Error("subscribe requires at least 2 arguments");
  }

  const callback = args.pop();
  const type = args.join(".");
  const id = uuid();

  console.log("node-event", "subscribe", type, id);

  if (type === "__proto__" || type === "constructor" || type === "prototype") {
    throw new Error("Invalid subscription type");
  }
  if (!subscriptions[type]) {
    subscriptions[type] = {};
  }

  const registry = {
    id,
    type,
    callback,
    unsubscribe: () => {
      console.log("node-event", "unsubscribe", type, id);
      delete subscriptions[type][id];

      unsubscriptionRate.labels(type).inc();

      if (Object.keys(subscriptions[type]).length === 0) {
        delete subscriptions[type];
        eventSubscriptionGauge.labels(type).set(0);
      } else {
        eventSubscriptionGauge
          .labels(type)
          .set(Object.keys(subscriptions[type]).length);
      }
    },
  };

  subscriptions[type][id] = registry;

  subscriptionRate.labels(type).inc();
  eventSubscriptionGauge
    .labels(type)
    .set(Object.keys(subscriptions[type]).length);

  return registry;
};

const publish = (...args) => {
  if (args.length < 2) {
    throw new Error("publish requires at least 2 arguments");
  }

  const payload = args.pop();
  const type = args.join(".");

  console.log("node-event", "publish", type, payload);
  messages.set(type, payload);

  if (type === "__proto__" || type === "constructor" || type === "prototype") {
    throw new Error("Invalid publish type");
  }

  const endTimer = eventPublishDuration.labels(type).startTimer();
  eventPublishCounter.labels(type).inc();

  let payloadSize = 0;
  try {
    payloadSize = JSON.stringify(payload).length;
  } catch (err) {
    console.error("node-event", "error stringifying payload", type, err);
    const errorName = err instanceof Error ? err.name : "UnknownError";
    eventPublishErrors.labels(type, errorName).inc();
    payloadSize = 0;
  }

  eventPayloadSize.labels(type).observe(payloadSize);

  Object.keys(subscriptions[type] || {}).forEach((key) => {
    const registry = subscriptions[type][key];

    setTimeout(() => {
      const callbackTimer = callbackProcessingDuration
        .labels(type)
        .startTimer();
      try {
        registry.callback(payload, registry);
        eventThroughput.labels(type).inc();
      } catch (err) {
        console.error("node-event", "error", type, err);
        const errorName = err instanceof Error ? err.name : "UnknownError";
        eventPublishErrors.labels(type, errorName).inc();
      } finally {
        callbackTimer();
      }
    }, 0);
  });

  endTimer();
};

function last(type, init) {
  if (messages.has(type)) {
    return messages.get(type);
  } else {
    return init;
  }
}

exports.subscribe = subscribe;
exports.publish = publish;
exports.messages = messages;
exports.last = last;
exports.client = client;

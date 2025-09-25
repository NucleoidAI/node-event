"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.client = exports.event = void 0;
var client = require("prom-client");
exports.client = client;
var kafkajs_1 = require("kafkajs");
var socket_io_client_1 = require("socket.io-client");
var socket = null;
var kafka = null;
var kafkaGroupId = null;
var sharedConsumer = null;
var subscribedTopics = new Set();
var backlogMonitoringInterval = null;
var isConsumerRunning = false;
var callbacks = {};
var eventPublishCounter = new client.Counter({
    name: "events_published_total",
    help: "Total number of events published",
    labelNames: ["event_type"],
});
var eventSubscriptionGauge = new client.Gauge({
    name: "active_event_subscriptions",
    help: "Number of active event subscriptions",
    labelNames: ["event_type"],
});
var eventPublishDuration = new client.Histogram({
    name: "event_publish_duration_seconds",
    help: "Time taken to publish events",
    labelNames: ["event_type"],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});
// Track payload size for analysis
var eventPayloadSize = new client.Histogram({
    name: "event_payload_size_bytes",
    help: "Size of event payloads in bytes",
    labelNames: ["event_type"],
    buckets: [10, 100, 1000, 10000, 100000, 1000000],
});
// Track error rates
var eventPublishErrors = new client.Counter({
    name: "event_publish_errors_total",
    help: "Total number of event publish errors",
    labelNames: ["event_type", "error_type"],
});
// Track callback processing duration
var callbackProcessingDuration = new client.Histogram({
    name: "event_callback_duration_seconds",
    help: "Time taken to process event callbacks",
    labelNames: ["event_type"],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});
// Track subscription rates
var subscriptionRate = new client.Counter({
    name: "event_subscriptions_total",
    help: "Total number of event subscriptions created",
    labelNames: ["event_type"],
});
// Track unsubscription rates
var unsubscriptionRate = new client.Counter({
    name: "event_unsubscriptions_total",
    help: "Total number of event unsubscriptions",
    labelNames: ["event_type"],
});
// Track throughput (events processed per second)
var eventThroughput = new client.Counter({
    name: "event_callbacks_processed_total",
    help: "Total number of event callbacks processed successfully",
    labelNames: ["event_type"],
});
var kafkaBacklogSize = new client.Gauge({
    name: "kafka_backlog_events_total",
    help: "Total number of events waiting to be processed",
    labelNames: ["topic"],
});
// Function to update Kafka backlog metrics
var updateKafkaBacklogMetrics = function () { return __awaiter(void 0, void 0, void 0, function () {
    var admin, _loop_1, _i, _a, topic;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (!kafka || !kafkaGroupId || subscribedTopics.size === 0)
                    return [2 /*return*/];
                admin = kafka.admin();
                return [4 /*yield*/, admin.connect()];
            case 1:
                _b.sent();
                _loop_1 = function (topic) {
                    var offsetsResponse, topicOffsets, totalLag, topicResponse;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0: return [4 /*yield*/, admin.fetchOffsets({
                                    groupId: kafkaGroupId,
                                    topics: [topic],
                                })];
                            case 1:
                                offsetsResponse = _c.sent();
                                return [4 /*yield*/, admin.fetchTopicOffsets(topic)];
                            case 2:
                                topicOffsets = _c.sent();
                                totalLag = 0;
                                topicResponse = offsetsResponse.find(function (response) { return response.topic === topic; });
                                if (topicResponse) {
                                    // Calculate lag for each partition
                                    topicResponse.partitions.forEach(function (partitionOffset) {
                                        var latestOffset = topicOffsets.find(function (to) { return to.partition === partitionOffset.partition; });
                                        if (latestOffset) {
                                            var consumerOffset = parseInt(partitionOffset.offset);
                                            var latestOffsetValue = parseInt(latestOffset.offset);
                                            var lag = Math.max(0, latestOffsetValue - consumerOffset);
                                            totalLag += lag;
                                        }
                                    });
                                }
                                kafkaBacklogSize.labels(topic).set(totalLag);
                                console.log("Backlog for topic ".concat(topic, ": ").concat(totalLag, " messages"));
                                return [2 /*return*/];
                        }
                    });
                };
                _i = 0, _a = Array.from(subscribedTopics);
                _b.label = 2;
            case 2:
                if (!(_i < _a.length)) return [3 /*break*/, 5];
                topic = _a[_i];
                return [5 /*yield**/, _loop_1(topic)];
            case 3:
                _b.sent();
                _b.label = 4;
            case 4:
                _i++;
                return [3 /*break*/, 2];
            case 5: return [4 /*yield*/, admin.disconnect()];
            case 6:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); };
var event = {
    init: function (options) {
        switch (options.type) {
            case "inMemory":
                if (!options.host) {
                    throw new Error("host is required for inMemory initialization");
                }
                if (!options.protocol) {
                    throw new Error("protocol is required for inMemory initialization");
                }
                var host = options.host, protocol = options.protocol;
                var socketPath = (options === null || options === void 0 ? void 0 : options.port)
                    ? "".concat(protocol, "://").concat(host, ":").concat(options.port)
                    : "".concat(protocol, "://").concat(host);
                socket = (0, socket_io_client_1.io)(socketPath);
                socket.on("event", function (_a) {
                    var type = _a.type, payload = _a.payload;
                    if (callbacks[type]) {
                        callbacks[type].forEach(function (cb) { return cb(payload); });
                    }
                });
                break;
            case "kafka":
                if (!options.clientId) {
                    throw new Error("clientId is required for Kafka initialization");
                }
                if (!options.brokers ||
                    !Array.isArray(options.brokers) ||
                    options.brokers.length === 0) {
                    throw new Error("brokers array is required for Kafka initialization");
                }
                if (!options.groupId) {
                    throw new Error("groupId is required for Kafka initialization");
                }
                kafka = new kafkajs_1.Kafka({
                    clientId: options.clientId,
                    brokers: options.brokers,
                });
                kafkaGroupId = options.groupId;
                // Start backlog monitoring after Kafka initialization
                event.startBacklogMonitoring();
                break;
        }
    },
    // Start backlog monitoring
    startBacklogMonitoring: function (intervalMs) {
        if (intervalMs === void 0) { intervalMs = 30000; }
        if (kafka && !backlogMonitoringInterval) {
            console.log("Starting Kafka backlog monitoring...");
            // Run once immediately
            updateKafkaBacklogMetrics();
            // Set up periodic monitoring
            backlogMonitoringInterval = setInterval(function () {
                updateKafkaBacklogMetrics();
            }, intervalMs);
        }
    },
    // Stop backlog monitoring
    stopBacklogMonitoring: function () {
        if (backlogMonitoringInterval) {
            clearInterval(backlogMonitoringInterval);
            backlogMonitoringInterval = null;
            console.log("Stopped Kafka backlog monitoring");
        }
    },
    // Manual backlog check
    checkBacklog: function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!kafka) return [3 /*break*/, 2];
                        return [4 /*yield*/, updateKafkaBacklogMetrics()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    },
    publish: function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return __awaiter(this, void 0, void 0, function () {
            var payload, types, _loop_2, _a, types_1, type;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (args.length < 2) {
                            throw new Error("publish requires at least one event type and a payload");
                        }
                        payload = args[args.length - 1];
                        types = args.slice(0, -1);
                        _loop_2 = function (type) {
                            var endTimer, payloadSize, producer;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        console.log("node-event", "publish", type, payload);
                                        if (type === "__proto__" ||
                                            type === "constructor" ||
                                            type === "prototype") {
                                            throw new Error("Invalid publish type");
                                        }
                                        endTimer = eventPublishDuration.labels(type).startTimer();
                                        eventPublishCounter.labels(type).inc();
                                        payloadSize = JSON.stringify(payload).length;
                                        eventPayloadSize.labels(type).observe(payloadSize);
                                        if (!socket) return [3 /*break*/, 1];
                                        socket.emit("publish", { type: type, payload: payload });
                                        return [3 /*break*/, 5];
                                    case 1:
                                        if (!kafka) return [3 /*break*/, 5];
                                        producer = kafka.producer();
                                        return [4 /*yield*/, producer.connect()];
                                    case 2:
                                        _c.sent();
                                        return [4 /*yield*/, producer.send({
                                                topic: type,
                                                messages: [{ value: JSON.stringify(payload) }],
                                            })];
                                    case 3:
                                        _c.sent();
                                        return [4 /*yield*/, producer.disconnect()];
                                    case 4:
                                        _c.sent();
                                        setTimeout(function () { return updateKafkaBacklogMetrics(); }, 500);
                                        _c.label = 5;
                                    case 5:
                                        if (callbacks[type]) {
                                            callbacks[type].forEach(function (callback) {
                                                setTimeout(function () {
                                                    var callbackTimer = callbackProcessingDuration
                                                        .labels(type)
                                                        .startTimer();
                                                    callback(payload);
                                                    eventThroughput.labels(type).inc();
                                                    callbackTimer();
                                                }, 0);
                                            });
                                        }
                                        endTimer();
                                        return [2 /*return*/];
                                }
                            });
                        };
                        _a = 0, types_1 = types;
                        _b.label = 1;
                    case 1:
                        if (!(_a < types_1.length)) return [3 /*break*/, 4];
                        type = types_1[_a];
                        return [5 /*yield**/, _loop_2(type)];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3:
                        _a++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    },
    subscribe: function (type, callback) {
        return __awaiter(this, void 0, void 0, function () {
            var wasNewTopic;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!callbacks[type])
                            callbacks[type] = new Set();
                        callbacks[type].add(callback);
                        subscriptionRate.labels(type).inc();
                        eventSubscriptionGauge.labels(type).set(callbacks[type].size);
                        if (!socket) return [3 /*break*/, 1];
                        socket.emit("subscribe", type);
                        return [3 /*break*/, 3];
                    case 1:
                        if (!kafka) return [3 /*break*/, 3];
                        wasNewTopic = !subscribedTopics.has(type);
                        if (!wasNewTopic) return [3 /*break*/, 3];
                        subscribedTopics.add(type);
                        return [4 /*yield*/, this.restartKafkaConsumer()];
                    case 2:
                        _a.sent();
                        setTimeout(function () {
                            updateKafkaBacklogMetrics();
                        }, 1000);
                        _a.label = 3;
                    case 3: return [2 /*return*/, function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                callbacks[type].delete(callback);
                                unsubscriptionRate.labels(type).inc();
                                if (callbacks[type].size === 0) {
                                    delete callbacks[type];
                                    eventSubscriptionGauge.labels(type).set(0);
                                    if (socket) {
                                        socket.emit("unsubscribe", type);
                                    }
                                }
                                else {
                                    eventSubscriptionGauge.labels(type).set(callbacks[type].size);
                                }
                                return [2 /*return*/];
                            });
                        }); }];
                }
            });
        });
    },
    restartKafkaConsumer: function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!kafka || subscribedTopics.size === 0)
                            return [2 /*return*/];
                        if (!(sharedConsumer && isConsumerRunning)) return [3 /*break*/, 3];
                        console.log("Stopping existing Kafka consumer...");
                        return [4 /*yield*/, sharedConsumer.stop()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, sharedConsumer.disconnect()];
                    case 2:
                        _a.sent();
                        sharedConsumer = null;
                        isConsumerRunning = false;
                        _a.label = 3;
                    case 3:
                        console.log("Starting Kafka consumer with topics: ".concat(Array.from(subscribedTopics).join(", ")));
                        sharedConsumer = kafka.consumer({ groupId: kafkaGroupId });
                        return [4 /*yield*/, sharedConsumer.connect()];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, sharedConsumer.subscribe({
                                topics: Array.from(subscribedTopics),
                                fromBeginning: false,
                            })];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, sharedConsumer.run({
                                partitionsConsumedConcurrently: 1,
                                eachMessage: function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                                    var payload_1, callbackTimer;
                                    var _c;
                                    var topic = _b.topic, partition = _b.partition, message = _b.message;
                                    return __generator(this, function (_d) {
                                        if (callbacks[topic]) {
                                            try {
                                                payload_1 = JSON.parse(((_c = message.value) === null || _c === void 0 ? void 0 : _c.toString()) || "{}");
                                                callbackTimer = callbackProcessingDuration
                                                    .labels(topic)
                                                    .startTimer();
                                                callbacks[topic].forEach(function (cb) {
                                                    cb(payload_1);
                                                    eventThroughput.labels(topic).inc();
                                                });
                                                callbackTimer();
                                            }
                                            catch (error) {
                                                console.error("Error processing message for topic ".concat(topic, ":"), error);
                                                eventPublishErrors.labels(topic, "processing_error").inc();
                                            }
                                        }
                                        return [2 /*return*/];
                                    });
                                }); },
                            })];
                    case 6:
                        _a.sent();
                        isConsumerRunning = true;
                        return [2 /*return*/];
                }
            });
        });
    },
    disconnect: function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        event.stopBacklogMonitoring();
                        if (!socket) return [3 /*break*/, 1];
                        socket.disconnect();
                        socket = null;
                        return [3 /*break*/, 5];
                    case 1:
                        if (!kafka) return [3 /*break*/, 5];
                        if (!(sharedConsumer && isConsumerRunning)) return [3 /*break*/, 4];
                        return [4 /*yield*/, sharedConsumer.stop()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, sharedConsumer.disconnect()];
                    case 3:
                        _a.sent();
                        sharedConsumer = null;
                        isConsumerRunning = false;
                        _a.label = 4;
                    case 4:
                        subscribedTopics.clear();
                        kafka = null;
                        kafkaGroupId = null;
                        _a.label = 5;
                    case 5:
                        Object.keys(callbacks).forEach(function (key) { return delete callbacks[key]; });
                        return [2 /*return*/];
                }
            });
        });
    },
};
exports.event = event;

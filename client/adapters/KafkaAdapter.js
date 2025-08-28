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
exports.KafkaAdapter = void 0;
var kafkajs_1 = require("kafkajs");
var callbacks = {};
var KafkaAdapter = /** @class */ (function () {
    function KafkaAdapter() {
        this.kafka = null;
        this.kafkaProducer = null;
        this.kafkaConsumers = new Map();
        this.kafkaGroupId = null;
    }
    KafkaAdapter.prototype.init = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var opts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        opts = options;
                        if (!opts.clientId) {
                            throw new Error("clientId is required for Kafka initialization");
                        }
                        if (!opts.brokers || !Array.isArray(opts.brokers) || opts.brokers.length === 0) {
                            throw new Error("brokers array is required for Kafka initialization");
                        }
                        if (!opts.groupId) {
                            throw new Error("groupId is required for Kafka initialization");
                        }
                        this.kafka = new kafkajs_1.Kafka({
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
                        return [4 /*yield*/, this.kafkaProducer.connect()];
                    case 1:
                        _a.sent();
                        this.kafkaProducer.on("producer.disconnect", function () {
                            console.error("Producer disconnected");
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    KafkaAdapter.prototype.publish = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return __awaiter(this, void 0, void 0, function () {
            var payload, types, messages, error_1, reconnectError_1;
            var _this = this;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.kafka || !this.kafkaProducer)
                            return [2 /*return*/];
                        payload = args[args.length - 1];
                        types = args.slice(0, -1);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 11]);
                        messages = types.map(function (type) { return ({
                            topic: type,
                            messages: [
                                {
                                    value: JSON.stringify(payload),
                                    timestamp: Date.now().toString(),
                                },
                            ],
                        }); });
                        return [4 /*yield*/, Promise.all(messages.map(function (msg) { return _this.kafkaProducer.send(msg); }))];
                    case 2:
                        _b.sent();
                        return [3 /*break*/, 11];
                    case 3:
                        error_1 = _b.sent();
                        console.error("Failed to publish to Kafka:", error_1);
                        if (!((_a = error_1.message) === null || _a === void 0 ? void 0 : _a.includes("disconnected"))) return [3 /*break*/, 9];
                        _b.label = 4;
                    case 4:
                        _b.trys.push([4, 7, , 8]);
                        return [4 /*yield*/, this.kafkaProducer.connect()];
                    case 5:
                        _b.sent();
                        return [4 /*yield*/, this.publish.apply(this, args)];
                    case 6:
                        _b.sent();
                        return [3 /*break*/, 8];
                    case 7:
                        reconnectError_1 = _b.sent();
                        throw new Error("Failed to reconnect producer: ".concat(reconnectError_1.message));
                    case 8: return [3 /*break*/, 10];
                    case 9: throw error_1;
                    case 10: return [3 /*break*/, 11];
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    KafkaAdapter.prototype.subscribe = function (type, callback) {
        return __awaiter(this, void 0, void 0, function () {
            var consumer;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!callbacks[type])
                            callbacks[type] = new Set();
                        callbacks[type].add(callback);
                        if (!this.kafka) {
                            return [2 /*return*/, function () { return __awaiter(_this, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        callbacks[type].delete(callback);
                                        if (callbacks[type].size === 0)
                                            delete callbacks[type];
                                        return [2 /*return*/];
                                    });
                                }); }];
                        }
                        if (!!this.kafkaConsumers.has(type)) return [3 /*break*/, 4];
                        consumer = this.kafka.consumer({
                            groupId: "".concat(this.kafkaGroupId, "-").concat(type),
                            sessionTimeout: 30000,
                            heartbeatInterval: 3000,
                        });
                        return [4 /*yield*/, consumer.connect()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, consumer.subscribe({ topic: type, fromBeginning: false })];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, consumer.run({
                                autoCommit: true,
                                eachMessage: function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                                    var payload_1;
                                    var _c;
                                    var topic = _b.topic, partition = _b.partition, message = _b.message;
                                    return __generator(this, function (_d) {
                                        if (callbacks[topic]) {
                                            try {
                                                payload_1 = JSON.parse(((_c = message.value) === null || _c === void 0 ? void 0 : _c.toString()) || "{}");
                                                callbacks[topic].forEach(function (cb) { return cb(payload_1); });
                                            }
                                            catch (error) {
                                                console.error("Failed to parse message from topic ".concat(topic, ":"), error);
                                            }
                                        }
                                        return [2 /*return*/];
                                    });
                                }); },
                            })];
                    case 3:
                        _a.sent();
                        consumer.on("consumer.disconnect", function () {
                            console.error("Consumer for topic ".concat(type, " disconnected"));
                            _this.kafkaConsumers.delete(type);
                        });
                        this.kafkaConsumers.set(type, consumer);
                        _a.label = 4;
                    case 4: return [2 /*return*/, function () { return __awaiter(_this, void 0, void 0, function () {
                            var consumer;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        callbacks[type].delete(callback);
                                        if (!(callbacks[type].size === 0)) return [3 /*break*/, 2];
                                        delete callbacks[type];
                                        consumer = this.kafkaConsumers.get(type);
                                        if (!consumer) return [3 /*break*/, 2];
                                        return [4 /*yield*/, consumer.disconnect()];
                                    case 1:
                                        _a.sent();
                                        this.kafkaConsumers.delete(type);
                                        _a.label = 2;
                                    case 2: return [2 /*return*/];
                                }
                            });
                        }); }];
                }
            });
        });
    };
    KafkaAdapter.prototype.cleanup = function () {
        return __awaiter(this, void 0, void 0, function () {
            var entries, _i, entries_1, _a, topic, consumer, error_2, error_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        entries = Array.from(this.kafkaConsumers.entries());
                        _i = 0, entries_1 = entries;
                        _b.label = 1;
                    case 1:
                        if (!(_i < entries_1.length)) return [3 /*break*/, 6];
                        _a = entries_1[_i], topic = _a[0], consumer = _a[1];
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, consumer.disconnect()];
                    case 3:
                        _b.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _b.sent();
                        console.error("Failed to disconnect consumer for ".concat(topic, ":"), error_2);
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6:
                        this.kafkaConsumers.clear();
                        if (!this.kafkaProducer) return [3 /*break*/, 11];
                        _b.label = 7;
                    case 7:
                        _b.trys.push([7, 9, , 10]);
                        return [4 /*yield*/, this.kafkaProducer.disconnect()];
                    case 8:
                        _b.sent();
                        return [3 /*break*/, 10];
                    case 9:
                        error_3 = _b.sent();
                        console.error("Failed to disconnect producer:", error_3);
                        return [3 /*break*/, 10];
                    case 10:
                        this.kafkaProducer = null;
                        _b.label = 11;
                    case 11:
                        this.kafka = null;
                        return [2 /*return*/];
                }
            });
        });
    };
    return KafkaAdapter;
}());
exports.KafkaAdapter = KafkaAdapter;

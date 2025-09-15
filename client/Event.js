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
exports.event = void 0;
var kafkajs_1 = require("kafkajs");
var socket_io_client_1 = require("socket.io-client");
var socket = null;
var kafka = null;
var kafkaAdmin = null;
var kafkaGroupId = null;
var activeConsumers = new Map();
var callbacks = {};
var event = {
    init: function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, host, protocol, socketPath;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = options.type;
                        switch (_a) {
                            case "inMemory": return [3 /*break*/, 1];
                            case "kafka": return [3 /*break*/, 2];
                        }
                        return [3 /*break*/, 4];
                    case 1:
                        if (!options.host) {
                            throw new Error("host is required for inMemory initialization");
                        }
                        if (!options.protocol) {
                            throw new Error("protocol is required for inMemory initialization");
                        }
                        host = options.host, protocol = options.protocol;
                        socketPath = (options === null || options === void 0 ? void 0 : options.port)
                            ? "".concat(protocol, "://").concat(host, ":").concat(options.port)
                            : "".concat(protocol, "://").concat(host);
                        socket = (0, socket_io_client_1.io)(socketPath);
                        socket.on("event", function (_a) {
                            var type = _a.type, payload = _a.payload;
                            if (callbacks[type]) {
                                callbacks[type].forEach(function (cb) { return cb(payload); });
                            }
                        });
                        return [3 /*break*/, 4];
                    case 2:
                        if (!options.clientId) {
                            throw new Error("clientId is required for Kafka initialization");
                        }
                        if (!options.brokers || !Array.isArray(options.brokers) || options.brokers.length === 0) {
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
                        kafkaAdmin = kafka.admin();
                        return [4 /*yield*/, kafkaAdmin.connect()];
                    case 3:
                        _b.sent();
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
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
            var payload, types, producer, _a, types_1, type;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (args.length < 2) {
                            throw new Error("publish requires at least one event type and a payload");
                        }
                        payload = args[args.length - 1];
                        types = args.slice(0, -1);
                        if (!socket) return [3 /*break*/, 1];
                        types.forEach(function (type) {
                            socket.emit("publish", { type: type, payload: payload });
                        });
                        return [3 /*break*/, 8];
                    case 1:
                        if (!kafka) return [3 /*break*/, 8];
                        producer = kafka.producer();
                        return [4 /*yield*/, producer.connect()];
                    case 2:
                        _b.sent();
                        _a = 0, types_1 = types;
                        _b.label = 3;
                    case 3:
                        if (!(_a < types_1.length)) return [3 /*break*/, 6];
                        type = types_1[_a];
                        return [4 /*yield*/, producer.send({
                                topic: type,
                                messages: [{ value: JSON.stringify(payload) }],
                            })];
                    case 4:
                        _b.sent();
                        _b.label = 5;
                    case 5:
                        _a++;
                        return [3 /*break*/, 3];
                    case 6: return [4 /*yield*/, producer.disconnect()];
                    case 7:
                        _b.sent();
                        _b.label = 8;
                    case 8: return [2 /*return*/];
                }
            });
        });
    },
    subscribe: function (type, callback) {
        return __awaiter(this, void 0, void 0, function () {
            var consumer;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!callbacks[type])
                            callbacks[type] = new Set();
                        callbacks[type].add(callback);
                        if (!socket) return [3 /*break*/, 1];
                        socket.emit("subscribe", type);
                        return [3 /*break*/, 5];
                    case 1:
                        if (!kafka) return [3 /*break*/, 5];
                        consumer = activeConsumers.get(type);
                        if (!!consumer) return [3 /*break*/, 5];
                        consumer = kafka.consumer({
                            groupId: "".concat(kafkaGroupId, "-").concat(type),
                        });
                        return [4 /*yield*/, consumer.connect()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, consumer.subscribe({ topic: type, fromBeginning: true })];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, consumer.run({
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
                    case 4:
                        _a.sent();
                        activeConsumers.set(type, consumer);
                        _a.label = 5;
                    case 5: return [2 /*return*/, function () { return __awaiter(_this, void 0, void 0, function () {
                            var consumer;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        callbacks[type].delete(callback);
                                        if (!(callbacks[type].size === 0)) return [3 /*break*/, 3];
                                        delete callbacks[type];
                                        if (!socket) return [3 /*break*/, 1];
                                        socket.emit("unsubscribe", type);
                                        return [3 /*break*/, 3];
                                    case 1:
                                        if (!kafka) return [3 /*break*/, 3];
                                        consumer = activeConsumers.get(type);
                                        if (!consumer) return [3 /*break*/, 3];
                                        return [4 /*yield*/, consumer.disconnect()];
                                    case 2:
                                        _a.sent();
                                        activeConsumers.delete(type);
                                        _a.label = 3;
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); }];
                }
            });
        });
    },
    disconnect: function () {
        return __awaiter(this, void 0, void 0, function () {
            var consumers, _i, consumers_1, _a, topic, consumer;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!socket) return [3 /*break*/, 1];
                        socket.disconnect();
                        socket = null;
                        return [3 /*break*/, 8];
                    case 1:
                        if (!kafka) return [3 /*break*/, 8];
                        consumers = Array.from(activeConsumers.entries());
                        _i = 0, consumers_1 = consumers;
                        _b.label = 2;
                    case 2:
                        if (!(_i < consumers_1.length)) return [3 /*break*/, 5];
                        _a = consumers_1[_i], topic = _a[0], consumer = _a[1];
                        return [4 /*yield*/, consumer.disconnect()];
                    case 3:
                        _b.sent();
                        _b.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5:
                        activeConsumers.clear();
                        if (!kafkaAdmin) return [3 /*break*/, 7];
                        return [4 /*yield*/, kafkaAdmin.disconnect()];
                    case 6:
                        _b.sent();
                        kafkaAdmin = null;
                        _b.label = 7;
                    case 7:
                        kafka = null;
                        _b.label = 8;
                    case 8:
                        Object.keys(callbacks).forEach(function (key) { return delete callbacks[key]; });
                        return [2 /*return*/];
                }
            });
        });
    }
};
exports.event = event;

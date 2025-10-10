"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TxEventQAdapter = exports.KafkaAdapter = exports.SocketAdapter = exports.EventMetrics = exports.EventManager = exports.client = exports.event = void 0;
const client = __importStar(require("prom-client"));
exports.client = client;
const metrics_1 = require("./metrics");
Object.defineProperty(exports, "EventMetrics", { enumerable: true, get: function () { return metrics_1.EventMetrics; } });
const eventManager_1 = require("./eventManager");
Object.defineProperty(exports, "EventManager", { enumerable: true, get: function () { return eventManager_1.EventManager; } });
const KafkaAdapter_1 = require("./adapters/KafkaAdapter");
Object.defineProperty(exports, "KafkaAdapter", { enumerable: true, get: function () { return KafkaAdapter_1.KafkaAdapter; } });
const SocketAdapter_1 = require("./adapters/SocketAdapter");
Object.defineProperty(exports, "SocketAdapter", { enumerable: true, get: function () { return SocketAdapter_1.SocketAdapter; } });
const TxEventQAdapter_1 = require("./adapters/TxEventQAdapter");
Object.defineProperty(exports, "TxEventQAdapter", { enumerable: true, get: function () { return TxEventQAdapter_1.TxEventQAdapter; } });
const manager = new eventManager_1.EventManager();
exports.event = {
    init: (options) => manager.init(options),
    publish: (...args) => manager.publish(...args),
    subscribe: (type, callback) => manager.subscribe(type, callback),
    disconnect: () => manager.disconnect(),
    checkBacklog: () => manager.checkBacklog(),
    startBacklogMonitoring: () => {
        console.log("Backlog monitoring starts automatically with Kafka adapter");
    },
    stopBacklogMonitoring: () => {
        console.log("Backlog monitoring stops automatically on disconnect");
    },
    restartKafkaConsumer: async () => {
        console.log("Consumer restart is handled automatically");
    },
    startPushgateway: (config) => manager.startPushgateway(config),
    stopPushgateway: () => manager.stopPushgateway(),
    pushMetricsToGateway: () => manager.pushMetricsToGateway(),
    getPushgatewayConfig: () => manager.getPushgatewayConfig(),
};
__exportStar(require("./types/types"), exports);

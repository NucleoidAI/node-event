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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TxEventQAdapter = void 0;
const oracledb = __importStar(require("oracledb"));
class TxEventQAdapter {
    options;
    connection = null;
    queue = null;
    queueCache = new Map();
    messageHandler;
    isRunning = false;
    constructor(options) {
        this.options = options;
    }
    async connect() {
        try {
            if (this.options.instantClientPath && oracledb.thin) {
                try {
                    oracledb.initOracleClient({
                        libDir: this.options.instantClientPath,
                        configDir: this.options.walletPath,
                        walletPath: this.options.walletPath,
                    });
                    console.log("Oracle Thick client initialized");
                }
                catch (initError) {
                    if (initError.code !== "NJS-509") {
                        throw initError;
                    }
                    console.log("Oracle Thick client already initialized");
                }
            }
            this.connection = await oracledb.getConnection({
                connectString: this.options.connectString,
                user: this.options.user,
                password: this.options.password,
                configDir: this.options.walletPath,
                walletPath: this.options.walletPath,
            });
            this.isRunning = true;
            console.log("TxEventQ adapter connected successfully");
        }
        catch (error) {
            console.error("Failed to connect to TxEventQ:", error.message);
            throw error;
        }
    }
    async disconnect() {
        this.isRunning = false;
        if (this.connection) {
            try {
                // Clear the queue cache
                this.queueCache.clear();
                await this.connection.close();
                console.log("TxEventQ connection closed");
            }
            catch (error) {
                console.error("Error closing TxEventQ connection:", error);
            }
            this.connection = null;
            this.queue = null;
        }
    }
    async getOrCreateQueue(queueName, options) {
        if (!this.connection) {
            throw new Error("TxEventQAdapter not connected");
        }
        // Check if queue is already cached
        if (this.queueCache.has(queueName)) {
            return this.queueCache.get(queueName);
        }
        // Create new queue and cache it
        const queue = await this.connection.getQueue(queueName, options);
        this.queueCache.set(queueName, queue);
        console.log(`Queue ${queueName} cached`);
        return queue;
    }
    async publish(type, payload) {
        if (!this.connection) {
            throw new Error("TxEventQAdapter not connected");
        }
        try {
            const queueName = type;
            this.queue = await this.getOrCreateQueue(queueName, {
                payloadType: oracledb.DB_TYPE_JSON,
            });
            const message = {
                topic: type,
                payload: payload,
            };
            await this.queue.enqOne({
                payload: message,
                correlation: type,
                priority: 0,
                delay: 0,
                expiration: -1,
                exceptionQueue: "",
            });
            await this.connection.commit();
        }
        catch (error) {
            console.error("Failed to publish event to TxEventQ:", error.message);
            throw error;
        }
    }
    async subscribe(type) {
        if (!this.connection) {
            throw new Error("Subscriber not initialized");
        }
        this.isRunning = true;
        const queueName = `TXEVENTQ_USER.${type}`;
        this.queue = await this.getOrCreateQueue(queueName, {
            payloadType: oracledb.DB_TYPE_JSON,
        });
        this.queue.deqOptions.wait = 5000;
        this.queue.deqOptions.consumerName =
            this.options.consumerName || `${type.toLowerCase()}_subscriber`;
        try {
            while (this.isRunning) {
                let messages = [];
                const message = await this.queue.deqOne();
                if (message) {
                    messages = [message];
                }
                if (messages && messages.length > 0) {
                    if (this.messageHandler) {
                        try {
                            const payload = message.payload.payload || {};
                            this.messageHandler(type, payload);
                        }
                        catch (error) {
                            console.error(`Error processing message for topic ${type}:`, error);
                        }
                    }
                    if (this.options.autoCommit) {
                        await this.connection.commit();
                        console.log(`Transaction committed for ${messages.length} message(s)`);
                    }
                }
            }
        }
        catch (error) {
            console.error("Fatal error during consumption:", error);
            throw error;
        }
    }
    async unsubscribe(type) {
        if (!this.connection) {
            throw new Error("Subscriber not initialized");
        }
        this.isRunning = false;
        this.queue = null;
    }
    onMessage(handler) {
        this.messageHandler = handler;
    }
    async getBacklog(topics) {
        const backlogMap = new Map();
        if (topics.length === 0) {
            return backlogMap;
        }
        // TODO: Implement backlog calculation for TxEventQ
        return backlogMap;
    }
}
exports.TxEventQAdapter = TxEventQAdapter;

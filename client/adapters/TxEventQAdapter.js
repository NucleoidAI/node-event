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
    messageHandler;
    isRunning = false;
    subscriptionLoop = null;
    constructor(options) {
        this.options = options;
    }
    async connect() {
        try {
            if (this.options.instantClientPath && oracledb.thin) {
                try {
                    oracledb.initOracleClient({
                        libDir: this.options.instantClientPath,
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
            });
            this.queue = await this.connection.getQueue(this.options.queueName, {
                payloadType: oracledb.DB_TYPE_JSON,
            });
            const batchSize = this.options.batchSize || 1;
            const waitTime = this.options.waitTime || 1000;
            this.queue.deqOptions.wait =
                batchSize > 1 ? oracledb.AQ_DEQ_NO_WAIT : waitTime;
            if (this.options.consumerName) {
                this.queue.deqOptions.consumerName = this.options.consumerName;
            }
            else {
                this.queue.deqOptions.consumerName = "event_subscriber";
            }
            this.isRunning = true;
            this.subscriptionLoop = this.startConsumption();
            console.log("TxEventQ adapter connected successfully");
        }
        catch (error) {
            console.error("Failed to connect to TxEventQ:", error.message);
            throw error;
        }
    }
    async disconnect() {
        this.isRunning = false;
        if (this.subscriptionLoop) {
            await this.subscriptionLoop;
            this.subscriptionLoop = null;
        }
        if (this.connection) {
            try {
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
    async publish(type, payload) {
        if (!this.connection || !this.queue) {
            throw new Error("TxEventQAdapter not connected");
        }
        try {
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
        // No-op: EventManager handles callback registration in memory
    }
    async unsubscribe(type) {
        // No-op: EventManager handles callback removal in memory
    }
    onMessage(handler) {
        this.messageHandler = handler;
    }
    async startConsumption() {
        if (!this.connection || !this.queue) {
            throw new Error("TxEventQAdapter not initialized");
        }
        console.log("Starting TxEventQ message consumption...");
        try {
            while (this.isRunning) {
                try {
                    let messages = [];
                    const batchSize = this.options.batchSize || 1;
                    if (batchSize === 1) {
                        const message = await this.queue.deqOne();
                        if (message) {
                            messages = [message];
                        }
                    }
                    else {
                        const dequeuedMessages = await this.queue.deqMany(batchSize);
                        if (dequeuedMessages) {
                            messages = dequeuedMessages;
                        }
                    }
                    if (messages && messages.length > 0) {
                        for (const message of messages) {
                            const messageData = message.payload;
                            if (this.messageHandler && messageData.topic) {
                                try {
                                    this.messageHandler(messageData.topic, messageData.payload);
                                }
                                catch (error) {
                                    console.error(`Error processing message for topic ${messageData.topic}:`, error);
                                }
                            }
                        }
                        await this.connection.commit();
                    }
                }
                catch (error) {
                    if (error.code === 25228) {
                        await new Promise((resolve) => setTimeout(resolve, 100));
                        continue;
                    }
                    console.error("Error during TxEventQ consumption:", error.message);
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }
            }
        }
        catch (error) {
            console.error("Fatal error during TxEventQ consumption:", error.message);
            throw error;
        }
        console.log("TxEventQ message consumption stopped");
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

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
        if (!this.connection) {
            throw new Error("TxEventQAdapter not connected");
        }
        try {
            const queueName = `TXEVENTQ_USER.${type}`;
            this.queue = await this.connection.getQueue(queueName, {
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
        this.queue = await this.connection.getQueue(queueName, {
            payloadType: oracledb.DB_TYPE_JSON,
        });
        this.queue.deqOptions.wait =
            this.options.batchSize > 1
                ? oracledb.AQ_DEQ_NO_WAIT
                : this.options.waitTime || 1000;
        this.queue.deqOptions.consumerName =
            this.options.consumerName || `${type.toLowerCase()}_subscriber`;
        try {
            while (this.isRunning) {
                let messages = [];
                if (this.options.batchSize === 1) {
                    console.log("Using deqOne()");
                    const message = await this.queue.deqOne();
                    if (message) {
                        messages = [message];
                    }
                }
                else {
                    const dequeuedMessages = await this.queue.deqMany(this.options.batchSize);
                    if (dequeuedMessages) {
                        messages = dequeuedMessages;
                    }
                }
                if (messages && messages.length > 0) {
                    if (this.options.autoCommit) {
                        await this.connection.commit();
                        console.log(`Transaction committed for ${messages.length} message(s)`);
                    }
                }
            }
        }
        catch (error) {
            console.error("Fatal error during consumption:", error.message);
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

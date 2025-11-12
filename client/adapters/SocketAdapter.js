"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketAdapter = void 0;
const socket_io_client_1 = require("socket.io-client");
class SocketAdapter {
    options;
    socket = null;
    messageHandler;
    constructor(options) {
        this.options = options;
    }
    async connect() {
        const { host, port, protocol } = this.options;
        const socketPath = port ? `${protocol}://${host}:${port}` : `${protocol}://${host}`;
        this.socket = (0, socket_io_client_1.io)(socketPath);
        this.socket.on("event", ({ type, payload }) => {
            if (this.messageHandler) {
                this.messageHandler(type, payload);
            }
        });
    }
    async disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
    async publish(type, payload) {
        if (!this.socket) {
            throw new Error("Socket not connected");
        }
        this.socket.emit("publish", { type, payload });
    }
    async subscribe(type) {
        if (!this.socket) {
            throw new Error("Socket not connected");
        }
        this.socket.emit("subscribe", type);
    }
    async unsubscribe(type) {
        if (!this.socket) {
            throw new Error("Socket not connected");
        }
        this.socket.emit("unsubscribe", type);
    }
    onMessage(handler) {
        this.messageHandler = handler;
    }
}
exports.SocketAdapter = SocketAdapter;

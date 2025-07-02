"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nodeEvent = void 0;
var socket_io_client_1 = require("socket.io-client");
// Internal state
var socket = null;
var callbacks = {};
var nodeEvent = {
    init: function (_a) {
        var host = _a.host, port = _a.port, _b = _a.protocol, protocol = _b === void 0 ? 'http' : _b;
        if (socket)
            return; // Prevent re-initialization
        socket = (0, socket_io_client_1.io)("".concat(protocol, "://").concat(host, ":").concat(port));
        socket.on('event', function (_a) {
            var type = _a.type, payload = _a.payload;
            if (callbacks[type]) {
                callbacks[type].forEach(function (cb) { return cb(payload); });
            }
        });
    },
    subscribe: function (type, callback) {
        if (!socket)
            throw new Error('nodeEvent not initialized. Call nodeEvent.init first.');
        if (!callbacks[type])
            callbacks[type] = new Set();
        callbacks[type].add(callback);
        socket.emit('subscribe', type);
        return function () {
            callbacks[type].delete(callback);
            if (callbacks[type].size === 0) {
                delete callbacks[type];
                socket.emit('unsubscribe', type);
            }
        };
    },
    publish: function (type, payload) {
        if (!socket)
            throw new Error('nodeEvent not initialized. Call nodeEvent.init first.');
        socket.emit('publish', { type: type, payload: payload });
    },
};
exports.nodeEvent = nodeEvent;

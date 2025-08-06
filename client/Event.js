"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.event = void 0;
var socket_io_client_1 = require("socket.io-client");
var socket = null;
var callbacks = {};
var event = {
    init: function (_a) {
        var host = _a.host, port = _a.port, protocol = _a.protocol;
        if (socket)
            return;
        socket = (0, socket_io_client_1.io)("".concat(protocol, "://").concat(host, ":").concat(port));
        socket.on("event", function (_a) {
            var type = _a.type, payload = _a.payload;
            if (callbacks[type]) {
                callbacks[type].forEach(function (cb) { return cb(payload); });
            }
        });
    },
    subscribe: function (type, callback) {
        if (!socket)
            throw new Error("Event not initialized. Call event.init first.");
        if (!callbacks[type])
            callbacks[type] = new Set();
        callbacks[type].add(callback);
        socket.emit("subscribe", type);
        return function () {
            callbacks[type].delete(callback);
            if (callbacks[type].size === 0) {
                delete callbacks[type];
                socket.emit("unsubscribe", type);
            }
        };
    },
    publish: function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (!socket)
            throw new Error("Event not initialized. Call event.init first.");
        if (args.length < 2) {
            throw new Error("publish requires at least one event type and a payload");
        }
        var payload = args[args.length - 1];
        var types = args.slice(0, -1);
        // Publish to all specified event types
        types.forEach(function (type) {
            socket.emit("publish", { type: type, payload: payload });
        });
    },
};
exports.event = event;

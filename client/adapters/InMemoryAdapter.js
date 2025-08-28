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
exports.InMemoryAdapter = void 0;
var socket_io_client_1 = require("socket.io-client");
var callbacks = {};
var InMemoryAdapter = /** @class */ (function () {
    function InMemoryAdapter() {
        this.socket = null;
    }
    InMemoryAdapter.prototype.init = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var opts, host, protocol, socketPath;
            return __generator(this, function (_a) {
                opts = options;
                if (!opts.host) {
                    throw new Error("host is required for inMemory initialization");
                }
                if (!opts.protocol) {
                    throw new Error("protocol is required for inMemory initialization");
                }
                host = opts.host, protocol = opts.protocol;
                socketPath = (opts === null || opts === void 0 ? void 0 : opts.port) ? "".concat(protocol, "://").concat(host, ":").concat(opts.port) : "".concat(protocol, "://").concat(host);
                this.socket = (0, socket_io_client_1.io)(socketPath);
                this.socket.on("event", function (_a) {
                    var type = _a.type, payload = _a.payload;
                    if (callbacks[type]) {
                        callbacks[type].forEach(function (cb) { return cb(payload); });
                    }
                });
                return [2 /*return*/];
            });
        });
    };
    InMemoryAdapter.prototype.publish = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return __awaiter(this, void 0, void 0, function () {
            var payload, types;
            var _this = this;
            return __generator(this, function (_a) {
                if (!this.socket)
                    return [2 /*return*/];
                payload = args[args.length - 1];
                types = args.slice(0, -1);
                types.forEach(function (type) {
                    _this.socket.emit("publish", { type: type, payload: payload });
                });
                return [2 /*return*/];
            });
        });
    };
    InMemoryAdapter.prototype.subscribe = function (type, callback) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                if (!callbacks[type])
                    callbacks[type] = new Set();
                callbacks[type].add(callback);
                if (this.socket) {
                    this.socket.emit("subscribe", type);
                }
                return [2 /*return*/, function () { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            callbacks[type].delete(callback);
                            if (callbacks[type].size === 0) {
                                delete callbacks[type];
                                if (this.socket) {
                                    this.socket.emit("unsubscribe", type);
                                }
                            }
                            return [2 /*return*/];
                        });
                    }); }];
            });
        });
    };
    InMemoryAdapter.prototype.cleanup = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (this.socket) {
                    this.socket.disconnect();
                    this.socket = null;
                }
                return [2 /*return*/];
            });
        });
    };
    return InMemoryAdapter;
}());
exports.InMemoryAdapter = InMemoryAdapter;

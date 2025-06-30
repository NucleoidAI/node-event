const { io } = require('socket.io-client');

const socket = io('http://localhost:8080');

const callbacks = {};

function subscribe(type, callback) {
  if (!callbacks[type]) callbacks[type] = new Set();
  callbacks[type].add(callback);
  socket.emit('subscribe', type);
  return () => {
    callbacks[type].delete(callback);
    if (callbacks[type].size === 0) {
      delete callbacks[type];
      socket.emit('unsubscribe', type);
    }
  };
}

function publish(type, payload) {
  socket.emit('publish', { type, payload });
}

socket.on('event', ({ type, payload }) => {
  if (callbacks[type]) {
    callbacks[type].forEach((cb) => cb(payload));
  }
});

module.exports = { subscribe, publish }; 
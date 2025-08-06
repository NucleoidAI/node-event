const express = require('express');
const { event } = require('@nucleoidai/node-event/client');

const app = express();

event.init({ host: 'localhost', port: 8080 });

event.subscribe('test', (payload) => {
  console.log('Received event:', payload);
});

app.get('/', (req, res) => {
  res.send('Subscriber is running and listening for events.');
});

app.listen(3002, () => {
  console.log('Subscriber app listening on http://localhost:3002');
}); 
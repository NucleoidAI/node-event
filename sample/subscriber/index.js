const express = require('express');
const { nodeEvent } = require('nuc-node-event-test/client');

const app = express();

nodeEvent.init({ host: 'localhost', port: 8080 });

nodeEvent.subscribe('test', (payload) => {
  console.log('Received event:', payload);
});

app.get('/', (req, res) => {
  res.send('Subscriber is running and listening for events.');
});

app.listen(3002, () => {
  console.log('Subscriber app listening on http://localhost:3002');
}); 
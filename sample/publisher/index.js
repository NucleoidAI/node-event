const express = require("express");
const { nodeEvent } = require("nuc-node-event-test/client");

const app = express();
app.use(express.json());

nodeEvent.init({ host: "localhost", port: 8080 });

app.post("/send", (req, res) => {
  const { type = "test", payload = {} } = req.body;
  nodeEvent.publish(type, payload);
  res.json({ status: "sent", type, payload });
});

app.listen(3001, () => {
  console.log("Publisher app listening on http://localhost:3001");
});

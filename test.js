const { EventManager } = require("./client");

const eventManager = new EventManager();

(async () => {
  await eventManager.init({
    type: "txeventq",
    connectString: "localhost:1522/FREEPDB1",
    user: "txeventq_user",
    password: "pass123",
    instantClientPath:
      "C:\\Users\\Halil\\Downloads\\instantclient-basic-windows.x64-23.9.0.25.07\\instantclient_23_9",
    autoCommit: true,
  });
})();

await (async () => {
  await eventManager.subscribe("test", (payload) => {
  console.log(payload);
  });
})();

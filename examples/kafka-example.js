const { event } = require("../client/Event");

event.init({
  type: "kafka",
  clientId: "example-client",
  brokers: ["localhost:9092"],
  groupId: "example-group",
});

async function simpleExample() {
  console.log("🚀 Starting simple example...");

  const unsubscribe = await event.subscribe("user.created", (payload) => {
    console.log("📨 Received user.created event:", payload);
  });

  await event.publish("user.created", {
    userId: "123",
    email: "user@example.com",
    timestamp: new Date().toISOString(),
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  await unsubscribe();
  console.log("✅ Simple example completed\n");
}

async function runExamples() {
  console.log("Starting Kafka Event System Examples\n");

  try {
    await simpleExample();
  } catch (error) {
    console.error("Error running examples:", error);
  }
}

if (require.main === module) {
  runExamples();
}

module.exports = {
  simpleExample,
  runExamples,
};


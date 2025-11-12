import * as oracledb from "oracledb";

import { AdapterConnectionError, AdapterNotConnectedError, PublishError, SubscribeError, UnsubscribeError } from "../errors";

import { EventAdapter } from "../types/types";

interface QueueMessage {
  topic: string;
  payload: object;
}

interface QueueOptions {
  payloadType: typeof oracledb.DB_TYPE_JSON;
}

interface EnqueueOptions {
  payload: QueueMessage;
  correlation: string;
  priority: number;
  delay: number;
  expiration: number;
  exceptionQueue: string;
}

class TopicConsumer {
  private isRunning: boolean = false;
  private consumerPromise: Promise<void> | null = null;

  constructor(
    private queue: oracledb.AdvancedQueue<QueueMessage>,
    private topic: string,
    private messageHandler: (type: string, payload: object) => void,
    private connection: oracledb.Connection,
    private autoCommit: boolean = false
  ) {}

  start(): void {
    if (this.isRunning) {
      console.warn(`Consumer for topic ${this.topic} is already running`);
      return;
    }

    this.isRunning = true;
    this.consumerPromise = this.consumeLoop();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.consumerPromise) {
      await this.consumerPromise;
      this.consumerPromise = null;
    }
  }

  private async consumeLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        const message = await this.queue.deqOne();

        if (message && message.payload) {
          try {
            const actualPayload = message.payload.payload || message.payload;
            this.messageHandler(this.topic, actualPayload);

            if (this.autoCommit) {
              await this.connection.commit();
            }
          } catch (processingError) {
            console.error(
              `Error processing message for topic ${this.topic}:`,
              processingError
            );
          }
        }
      } catch (dequeueError: any) {
        if (dequeueError.message && !dequeueError.message.includes("DPI-1067")) {
          console.error(
            `Error dequeuing message for topic ${this.topic}:`,
            dequeueError
          );
        }
        await this.sleep(100);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

export class TxEventQAdapter implements EventAdapter {
  private connection: oracledb.Connection | null = null;
  private queueCache: Map<string, oracledb.AdvancedQueue<QueueMessage>> = new Map();
  private consumers: Map<string, TopicConsumer> = new Map();
  private messageHandler?: (type: string, payload: object) => void;

  constructor(
    private readonly options: {
      connectString: string;
      user: string;
      password: string;
      instantClientPath?: string;
      walletPath?: string;
      consumerName?: string;
      batchSize?: number;
      waitTime?: number;
      autoCommit?: boolean;
    }
  ) {}

  async connect(): Promise<void> {
    try {
      if (this.options.instantClientPath && oracledb.thin) {
        try {
          oracledb.initOracleClient({
            libDir: this.options.instantClientPath,
            configDir: this.options.walletPath,
            walletPath: this.options.walletPath,
          });
          console.log("Oracle Thick client initialized");
        } catch (initError: any) {
          if (initError.code !== "NJS-509") {
            throw initError;
          }
          console.log("Oracle Thick client already initialized");
        }
      }

      this.connection = await oracledb.getConnection({
        connectString: this.options.connectString,
        user: this.options.user,
        password: this.options.password,
        configDir: this.options.walletPath,
        walletPath: this.options.walletPath,
      });

      console.log("TxEventQ adapter connected successfully");
    } catch (error: any) {
      console.error("Failed to connect to TxEventQ:", error.message);
      throw new AdapterConnectionError("TxEventQ", error);
    }
  }

  async disconnect(): Promise<void> {
    const stopPromises = Array.from(this.consumers.values()).map(consumer =>
      consumer.stop()
    );
    await Promise.all(stopPromises);
    this.consumers.clear();

    if (this.connection) {
      try {
        this.queueCache.clear();
        await this.connection.close();
        console.log("TxEventQ connection closed");
      } catch (error) {
        console.error("Error closing TxEventQ connection:", error);
      }
      this.connection = null;
    }
  }

  private async getOrCreateQueue(
    queueName: string,
    options: QueueOptions
  ): Promise<oracledb.AdvancedQueue<QueueMessage>> {
    if (!this.connection) {
      throw new AdapterNotConnectedError("TxEventQAdapter");
    }

    if (this.queueCache.has(queueName)) {
      return this.queueCache.get(queueName)!;
    }

    const queue = await this.connection.getQueue(queueName, options);
    this.queueCache.set(queueName, queue);

    console.log(`Queue ${queueName} created and cached`);

    return queue;
  }

  private getQueueName(type: string): string {
     return `TXEVENTQ_USER.${type}`;
  }

  async publish<T = object>(type: string, payload: T): Promise<void> {
    if (!this.connection) {
      throw new AdapterNotConnectedError("TxEventQAdapter");
    }

    const queueName = this.getQueueName(type);

    try {
      const queue = await this.getOrCreateQueue(queueName, {
        payloadType: oracledb.DB_TYPE_JSON,
      });

      const message: QueueMessage = {
        topic: type,
        payload: payload as object,
      };

      const enqOptions: EnqueueOptions = {
        payload: message,
        correlation: type,
        priority: 0,
        delay: 0,
        expiration: -1,
        exceptionQueue: "",
      };

      await queue.enqOne(enqOptions);

      if (this.connection) {
        await this.connection.commit();
      }

      console.log(`Message published to queue ${queueName}`);
    } catch (error) {
      console.error(`Failed to publish to queue ${queueName}:`, error);
      throw new PublishError(type, error as Error);
    }
  }

  async subscribe(type: string): Promise<void> {
    if (!this.connection) {
      throw new AdapterNotConnectedError("TxEventQAdapter");
    }

    if (this.consumers.has(type)) {
      console.warn(`Already subscribed to topic ${type}`);
      return;
    }

    if (!this.messageHandler) {
      console.warn(`No message handler set for topic ${type}`);
      return;
    }

    const queueName = this.getQueueName(type);

    try {
      const queue = await this.getOrCreateQueue(queueName, {
        payloadType: oracledb.DB_TYPE_JSON,
      });

      queue.deqOptions.wait = this.options.waitTime || 5000;
      queue.deqOptions.consumerName =
        this.options.consumerName || `${type.toLowerCase()}_consumer`;

      const consumer = new TopicConsumer(
        queue,
        type,
        this.messageHandler,
        this.connection,
        this.options.autoCommit ?? false
      );

      this.consumers.set(type, consumer);
      consumer.start();

      console.log(`Subscribed to topic ${type} on queue ${queueName}`);
    } catch (error) {
      console.error(`Failed to subscribe to topic ${type}:`, error);
      throw new SubscribeError(type, error as Error);
    }
  }

  async unsubscribe(type: string): Promise<void> {
    const consumer = this.consumers.get(type);

    if (!consumer) {
      console.warn(`No active subscription for topic ${type}`);
      return;
    }

    try {
      await consumer.stop();
      this.consumers.delete(type);
      console.log(`Unsubscribed from topic ${type}`);
    } catch (error) {
      console.error(`Failed to unsubscribe from topic ${type}:`, error);
      throw new UnsubscribeError(type, error as Error);
    }
  }

  onMessage(handler: (type: string, payload: object) => void): void {
    this.messageHandler = handler;
  }

  async getBacklog(topics: string[]): Promise<Map<string, number>> {
    const backlogMap = new Map<string, number>();
    if (!this.connection || !topics?.length) return backlogMap;

    const sql = `
      SELECT NVL(SUM(s.ENQUEUED_MSGS - s.DEQUEUED_MSGS), 0) AS BACKLOG
        FROM GV$AQ_SHARDED_SUBSCRIBER_STAT s
        JOIN USER_QUEUES q
          ON q.QID = s.QUEUE_ID
        JOIN USER_QUEUE_SUBSCRIBERS sub
          ON sub.SUBSCRIBER_ID = s.SUBSCRIBER_ID
         AND sub.QUEUE_NAME = q.NAME
       WHERE q.NAME = :queueName
         AND (:consumerName IS NULL OR sub.CONSUMER_NAME = :consumerName)
    `;

    const consumerName =
      typeof this.options.consumerName === "string"
        ? this.options.consumerName
        : null;

    for (const topic of topics) {
      const queueName = this.getQueueName(topic);

      try {
        const result = await this.connection.execute(
          sql,
          { queueName, consumerName },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const rows = (result.rows || []) as Array<{ BACKLOG: number }>;
        const val = Number(rows?.[0]?.BACKLOG ?? 0);
        backlogMap.set(topic, isNaN(val) ? 0 : val);
      } catch (err) {
        console.error(`Backlog query failed for topic ${topic}:`, err);
        backlogMap.set(topic, 0);
      }
    }

    return backlogMap;
  }
}

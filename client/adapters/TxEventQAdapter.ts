import * as oracledb from "oracledb";

import { EventAdapter } from "../types/types";

export class TxEventQAdapter implements EventAdapter {
  private connection: oracledb.Connection | null = null;
  private queue: oracledb.AdvancedQueue<any> | null = null;
  private messageHandler?: (type: string, payload: object) => void;
  private isRunning: boolean = false;
  private subscriptionLoop: Promise<void> | null = null;

  constructor(
    private readonly options: {
      connectString: string;
      user: string;
      password: string;
      queueName: string;
      instantClientPath?: string;
      consumerName?: string;
      batchSize?: number;
      waitTime?: number;
    }
  ) {}

  async connect(): Promise<void> {
    try {
      if (this.options.instantClientPath && oracledb.thin) {
        try {
          oracledb.initOracleClient({
            libDir: this.options.instantClientPath,
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
      });

      this.queue = await this.connection.getQueue(this.options.queueName, {
        payloadType: oracledb.DB_TYPE_JSON,
      } as any);

      const batchSize = this.options.batchSize || 1;
      const waitTime = this.options.waitTime || 1000;

      this.queue.deqOptions.wait =
        batchSize > 1 ? oracledb.AQ_DEQ_NO_WAIT : waitTime;

      if (this.options.consumerName) {
        this.queue.deqOptions.consumerName = this.options.consumerName;
      }else {
        this.queue.deqOptions.consumerName = "event_subscriber";
      }

      this.isRunning = true;
      this.subscriptionLoop = this.startConsumption();

      console.log("TxEventQ adapter connected successfully");
    } catch (error: any) {
      console.error("Failed to connect to TxEventQ:", error.message);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isRunning = false;
    if (this.subscriptionLoop) {
      await this.subscriptionLoop;
      this.subscriptionLoop = null;
    }

    if (this.connection) {
      try {
        await this.connection.close();
        console.log("TxEventQ connection closed");
      } catch (error) {
        console.error("Error closing TxEventQ connection:", error);
      }
      this.connection = null;
      this.queue = null;
    }
  }

  async publish<T = object>(type: string, payload: T): Promise<void> {
    if (!this.connection || !this.queue) {
      throw new Error("TxEventQAdapter not connected");
    }

    try {
      const message = {
        topic: type,
        payload: payload,
      };

      await this.queue.enqOne({
        payload: message,
        correlation: type,
        priority: 0,
        delay: 0,
        expiration: -1,
        exceptionQueue: "",
      } as any);

      await this.connection.commit();
    } catch (error: any) {
      console.error("Failed to publish event to TxEventQ:", error.message);
      throw error;
    }
  }

  async subscribe(type: string): Promise<void> {
    // No-op: EventManager handles callback registration in memory
  }

  async unsubscribe(type: string): Promise<void> {
    // No-op: EventManager handles callback removal in memory
  }

  onMessage(handler: (type: string, payload: object) => void): void {
    this.messageHandler = handler;
  }

  private async startConsumption(): Promise<void> {
    if (!this.connection || !this.queue) {
      throw new Error("TxEventQAdapter not initialized");
    }

    console.log("Starting TxEventQ message consumption...");

    try {
      while (this.isRunning) {
        try {
          let messages: oracledb.AdvancedQueueMessage<any>[] = [];

          const batchSize = this.options.batchSize || 1;

          if (batchSize === 1) {
            const message = await this.queue!.deqOne();
            if (message) {
              messages = [message];
            }
          } else {
            const dequeuedMessages = await this.queue!.deqMany(batchSize);
            if (dequeuedMessages) {
              messages = dequeuedMessages;
            }
          }

          if (messages && messages.length > 0) {
            for (const message of messages) {
              const messageData = message.payload as any;

              if (this.messageHandler && messageData.topic) {
                try {
                  this.messageHandler(messageData.topic, messageData.payload);
                } catch (error) {
                  console.error(
                    `Error processing message for topic ${messageData.topic}:`,
                    error
                  );
                }
              }
            }

            await this.connection!.commit();
          }
        } catch (error: any) {
          if (error.code === 25228) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            continue;
          }

          console.error("Error during TxEventQ consumption:", error.message);

          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    } catch (error: any) {
      console.error("Fatal error during TxEventQ consumption:", error.message);
      throw error;
    }

    console.log("TxEventQ message consumption stopped");
  }

  async getBacklog(topics: string[]): Promise<Map<string, number>> {
    const backlogMap = new Map<string, number>();

    if (topics.length === 0) {
      return backlogMap;
    }
    // TODO: Implement backlog calculation for TxEventQ
    return backlogMap;
  }
}

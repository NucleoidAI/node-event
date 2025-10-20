import * as oracledb from "oracledb";

import { EventAdapter } from "../types/types";

export class TxEventQAdapter implements EventAdapter {
  private connection: oracledb.Connection | null = null;
  private queue: oracledb.AdvancedQueue<any> | null = null;
  private queueCache: Map<string, oracledb.AdvancedQueue<any>> = new Map();
  private messageHandler?: (type: string, payload: object) => void;
  private isRunning: boolean = false;

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
      queueOwner?: string;
    }
  ) {}

  async connect(): Promise<void> {
    try {
      if (this.options.instantClientPath && (oracledb as any).thin) {
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

      this.isRunning = true;

      console.log("TxEventQ adapter connected successfully");
    } catch (error: any) {
      console.error("Failed to connect to TxEventQ:", error.message);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isRunning = false;

    if (this.connection) {
      try {
        this.queueCache.clear();

        await this.connection.close();
        console.log("TxEventQ connection closed");
      } catch (error) {
        console.error("Error closing TxEventQ connection:", error);
      }
      this.connection = null;
      this.queue = null;
    }
  }

  private async getOrCreateQueue(
    queueName: string,
    options: any
  ): Promise<oracledb.AdvancedQueue<any>> {
    if (!this.connection) {
      throw new Error("TxEventQAdapter not connected");
    }

    if (this.queueCache.has(queueName)) {
      return this.queueCache.get(queueName)!;
    }

    const queue = await this.connection.getQueue(queueName, options);
    this.queueCache.set(queueName, queue);

    console.log(`Queue ${queueName} cached`);

    return queue;
  }

  async publish<T = object>(type: string, payload: T): Promise<void> {
    if (!this.connection) {
      throw new Error("TxEventQAdapter not connected");
    }

    try {
      const queueName = type;

      this.queue = await this.getOrCreateQueue(queueName, {
        payloadType: (oracledb as any).DB_TYPE_JSON,
      } as any);

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
    if (!this.connection) {
      throw new Error("Subscriber not initialized");
    }
    this.isRunning = true;

    const queueName = `TXEVENTQ_USER.${type}`;

    this.queue = await this.getOrCreateQueue(queueName, {
      payloadType: (oracledb as any).DB_TYPE_JSON,
    });

    this.queue.deqOptions.wait = 5000;
    this.queue.deqOptions.consumerName =
      this.options.consumerName || `${type.toLowerCase()}_subscriber`;
    try {
      while (this.isRunning) {
        let messages: oracledb.AdvancedQueueMessage[] = [];

        const message = await this.queue.deqOne();
        if (message) {
          messages = [message];
        }
        if (messages && messages.length > 0) {
          if (this.messageHandler) {
            try {
              const payload = (message as any).payload?.payload || {};
              this.messageHandler(type, payload);
            } catch (error) {
              console.error(
                `Error processing message for topic ${type}:`,
                error
              );
            }
          }
          if (this.options.autoCommit && this.connection) {
            await this.connection.commit();
            console.log(
              `Transaction committed for ${messages.length} message(s)`
            );
          }
        }
      }
    } catch (error) {
      console.error("Fatal error during consumption:", error);
      throw error;
    }
  }

  async unsubscribe(_type: string): Promise<void> {
    if (!this.connection) {
      throw new Error("Subscriber not initialized");
    }
    this.isRunning = false;
    this.queue = null;
  }

  onMessage(handler: (type: string, payload: object) => void): void {
    this.messageHandler = handler;
  }

  async getHistory(
    topics: string[],
    options?: { since?: Date; limitPerTopic?: number; newestFirst?: boolean }
  ): Promise<Map<string, Array<{ enqueuedAt?: Date | null; state?: string }>>> {
    const result = new Map<
      string,
      Array<{ enqueuedAt?: Date | null; state?: string }>
    >();
    if (!topics.length) return result;
    if (!this.connection) {
      for (const t of topics) result.set(t, []);
      return result;
    }

    const owner = (this.options.queueOwner || "TXEVENTQ_USER").toUpperCase();
    const limit = options?.limitPerTopic ?? 50;
    const newestFirst = options?.newestFirst !== false;
    const since = options?.since;

    for (const topic of topics) {
      const qname = topic.toUpperCase();
      try {
        const resAny = (await this.connection.execute(
          `SELECT OWNER, NAME, QUEUE_TABLE
             FROM ALL_QUEUES
            WHERE UPPER(OWNER) = :owner AND UPPER(NAME) = :name`,
          { owner, name: qname },
          { outFormat: (oracledb as any).OUT_FORMAT_OBJECT }
        )) as unknown as {
          rows?: Array<{ OWNER: string; NAME: string; QUEUE_TABLE: string }>;
        };

        const row = resAny.rows?.[0];
        if (!row) {
          result.set(topic, []);
          continue;
        }

        const tab = `AQ$${String(row.QUEUE_TABLE).toUpperCase()}`;
        const colsAny = (await this.connection.execute(
          `SELECT COLUMN_NAME, DATA_TYPE
             FROM ALL_TAB_COLUMNS
            WHERE OWNER = :owner AND TABLE_NAME = :tab
              AND COLUMN_NAME IN ('Q_NAME','QUEUE','QUEUE_NAME','MSG_STATE','STATE','ENQ_TIME')`,
          { owner, tab },
          { outFormat: (oracledb as any).OUT_FORMAT_OBJECT }
        )) as unknown as {
          rows?: Array<{ COLUMN_NAME: string; DATA_TYPE: string }>;
        };

        const present = new Map<string, string>();
        for (const r of colsAny.rows || []) {
          present.set(
            String(r.COLUMN_NAME).toUpperCase(),
            String(r.DATA_TYPE).toUpperCase()
          );
        }
        const qNameCol =
          (present.has("Q_NAME") && "Q_NAME") ||
          (present.has("QUEUE") && "QUEUE") ||
          (present.has("QUEUE_NAME") && "QUEUE_NAME");
        const stateCol =
          (present.has("MSG_STATE") && "MSG_STATE") ||
          (present.has("STATE") && "STATE");
        const hasEnqTime = present.has("ENQ_TIME");
        if (!qNameCol) {
          result.set(topic, []);
          continue;
        }

        const tableFqn = `${owner}.${tab}`;
        const where: string[] = [`UPPER(${qNameCol}) = :qname`];
        const binds: Record<string, any> = { qname };

        if (since && hasEnqTime) {
          where.push("ENQ_TIME >= :since");
          binds.since = since;
        }

        const orderCol = hasEnqTime ? "ENQ_TIME" : stateCol || qNameCol;
        const orderDir = newestFirst ? "DESC" : "ASC";
        const selectCols = [
          stateCol ? `${stateCol} AS STATE` : `NULL AS STATE`,
          hasEnqTime ? `ENQ_TIME` : `NULL AS ENQ_TIME`,
        ].join(", ");

        const sql = `
          SELECT * FROM (
            SELECT ${selectCols}
              FROM ${tableFqn}
             WHERE ${where.join(" AND ")}
             ORDER BY ${orderCol} ${orderDir}
          )
          WHERE ROWNUM <= :limit_n
        `;
        binds.limit_n = limit;

        const rowsAny = (await this.connection.execute(sql, binds, {
          outFormat: (oracledb as any).OUT_FORMAT_OBJECT,
        })) as unknown as {
          rows?: Array<{ STATE?: number | string; ENQ_TIME?: Date | null }>;
        };

        const rows = rowsAny.rows || [];
        result.set(
          topic,
          rows.map((r) => ({
            enqueuedAt: r.ENQ_TIME ?? null,
            state: r.STATE != null ? String(r.STATE) : undefined,
          }))
        );
      } catch (err) {
        console.error(`Error fetching history for topic ${topic}:`, err);
        result.set(topic, []);
      }
    }

    return result;
  }
}

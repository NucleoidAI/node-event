import { EventAdapter, InitOptions } from "../types/types";
import { KafkaAdapter } from "../adapters/KafkaAdapter";
import { SocketAdapter } from "../adapters/SocketAdapter";
import { TxEventQAdapter } from "../adapters/TxEventQAdapter";
import { UnknownAdapterTypeError } from "../errors";
import { EVENT_TOPICS } from "../constants";

/**
 * Factory class for creating event adapter instances
 */
export class AdapterFactory {
  /**
   * Creates an adapter instance based on the provided options
   * @param options - Initialization options specifying adapter type and configuration
   * @returns EventAdapter instance
   * @throws UnknownAdapterTypeError if adapter type is not recognized
   */
  create(options: InitOptions): EventAdapter {
    switch (options.type) {
      case "inMemory":
        return new SocketAdapter({
          host: options.host,
          port: options.port,
          protocol: options.protocol,
        });

      case "kafka":
        return new KafkaAdapter({
          clientId: options.clientId,
          brokers: options.brokers,
          groupId: options.groupId,
          topics: [...EVENT_TOPICS],
        });

      case "txeventq":
        return new TxEventQAdapter({
          connectString: options.connectString,
          user: options.user,
          password: options.password,
          instantClientPath: options.instantClientPath,
          walletPath: options.walletPath,
          consumerName: options.consumerName,
          batchSize: options.batchSize,
          waitTime: options.waitTime,
        });

      default:
        throw new UnknownAdapterTypeError((options as any).type);
    }
  }

  /**
   * Determines if the adapter type supports backlog monitoring
   * @param adapter - The adapter instance to check
   * @returns true if the adapter supports backlog monitoring
   */
  supportsBacklog(adapter: EventAdapter): adapter is EventAdapter & { getBacklog: (topics: string[]) => Promise<Map<string, number>> } {
    return typeof adapter.getBacklog === "function";
  }
}

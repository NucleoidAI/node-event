import * as client from "prom-client";

export interface EventRegistry {
  id: string;
  type: string;
  callback: (...args: any[]) => void;
  unsubscribe: () => void;
}

export type EventCallback = (...args: any[]) => void;

/**
 * Subscribe to events with a callback function
 * @param args - Event type parts followed by a callback function
 * @returns Event registry object with unsubscribe method
 */
export declare function subscribe(
  ...args: [...string[], EventCallback]
): EventRegistry;

/**
 * Publish an event with a payload
 * @param args - Event type parts followed by the payload
 */
export declare function publish(...args: [...string[], any]): void;

/**
 * Map containing the last message for each event type
 */
export declare const messages: Map<string, any>;

/**
 * Get the last published message for a given event type
 * @param type - The event type
 * @param init - Default value if no message exists
 * @returns The last message or the init value
 */
export declare function last(type: string, init?: any): any;

/**
 * Prometheus client for metrics
 */
export declare const client: typeof import("prom-client");

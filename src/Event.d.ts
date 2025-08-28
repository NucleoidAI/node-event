import * as client from "prom-client";

export interface EventRegistry {
  id: string;
  type: string;
  callback: (...args: any[]) => void;
  unsubscribe: () => void;
}

export type EventCallback = (...args: any[]) => void;

export declare function subscribe(
  ...args: [...string[], EventCallback]
): EventRegistry;

export declare function publish(...args: [...string[], any]): void;

export declare const messages: Map<string, any>;

export declare function last(type: string, init?: any): any;

export declare const client: typeof import("prom-client");

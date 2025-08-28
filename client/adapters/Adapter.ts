import { Callback, InitOptions } from "./types";

export interface EventAdapter {
  init(options: InitOptions): Promise<void>;
  publish<T = any>(...args: [...string[], T]): Promise<void>;
  subscribe<T = any>(type: string, callback: Callback<T>): Promise<() => void>;
  cleanup(): Promise<void>;
}



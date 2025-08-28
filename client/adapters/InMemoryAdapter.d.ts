import { Callback, InitOptions } from "./types";
import { EventAdapter } from "./Adapter";
export declare class InMemoryAdapter implements EventAdapter {
    private socket;
    init(options: InitOptions): Promise<void>;
    publish<T = any>(...args: [...string[], T]): Promise<void>;
    subscribe<T = any>(type: string, callback: Callback<T>): Promise<() => void>;
    cleanup(): Promise<void>;
}

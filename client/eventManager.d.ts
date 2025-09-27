import { Callback, InitOptions } from "./types/types";
export declare class EventManager {
    private adapter;
    private callbacks;
    private metrics;
    private backlogInterval;
    init(options: InitOptions): Promise<void>;
    publish<T = any>(...args: [...string[], T]): Promise<void>;
    subscribe<T = any>(type: string, callback: Callback<T>): Promise<() => void>;
    disconnect(): Promise<void>;
    private handleIncomingMessage;
    private executeCallbacks;
    private validateEventType;
    private startBacklogMonitoring;
    private stopBacklogMonitoring;
    private updateBacklogMetrics;
    checkBacklog(): Promise<void>;
}

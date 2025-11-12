import { Callback, InitOptions } from "./types/types";
import { PushgatewayConfig } from "./metrics";
export declare class EventManager {
    private adapter;
    private callbacks;
    private metrics;
    private backlogInterval;
    init(options: InitOptions): Promise<void>;
    publish<T extends object = object>(...args: [...string[], T]): Promise<void>;
    subscribe<T extends object = object>(type: string, callback: Callback<T>): Promise<() => void>;
    disconnect(): Promise<void>;
    private handleIncomingMessage;
    private executeCallbacks;
    private validateEventType;
    private startBacklogMonitoring;
    private stopBacklogMonitoring;
    private updateBacklogMetrics;
    checkBacklog(): Promise<void>;
    startPushgateway(config?: PushgatewayConfig): void;
    stopPushgateway(): void;
    pushMetricsToGateway(): Promise<void>;
    getPushgatewayConfig(): PushgatewayConfig | undefined;
}

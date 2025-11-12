export interface PushgatewayConfig {
    url?: string;
    jobName?: string;
    instance?: string;
    interval?: number;
}
export declare class EventMetrics {
    private readonly registry;
    private pushgatewayInterval?;
    private pushgatewayConfig?;
    private readonly publishCounter;
    private readonly subscriptionGauge;
    private readonly publishDuration;
    private readonly payloadSize;
    private readonly publishErrors;
    private readonly callbackDuration;
    private readonly throughput;
    private readonly eventBacklog;
    constructor();
    recordPublish(type: string, payloadSizeBytes: number): () => void;
    recordPublishError(type: string, errorType: string): void;
    recordCallback(type: string): () => void;
    updateSubscriptions(type: string, count: number): void;
    updateEventBacklog(topic: string, size: number): void;
    startPushgateway(config?: PushgatewayConfig): void;
    stopPushgateway(): void;
    pushMetricsToGateway(): Promise<void>;
    getPushgatewayConfig(): PushgatewayConfig | undefined;
}

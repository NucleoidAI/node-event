export declare class EventMetrics {
    private readonly publishCounter;
    private readonly subscriptionGauge;
    private readonly publishDuration;
    private readonly payloadSize;
    private readonly publishErrors;
    private readonly callbackDuration;
    private readonly throughput;
    private readonly kafkaBacklog;
    recordPublish(type: string, payloadSizeBytes: number): () => void;
    recordPublishError(type: string, errorType: string): void;
    recordCallback(type: string): () => void;
    updateSubscriptions(type: string, count: number): void;
    updateKafkaBacklog(topic: string, size: number): void;
}

/**
 * Event Topics Configuration
 */
export const EVENT_TOPICS = [
  "KNOWLEDGE_CREATED",
  "MESSAGE_USER_MESSAGED",
  "SESSION_USER_MESSAGED",
  "TASK_CREATED",
  "STEP_ADDED",
  "STEP_COMPLETED",
  "MESSAGE_ASSISTANT_MESSAGED",
  "RESPONSIBILITY_CREATED",
  "RESPONSIBILITY_DESCRIPTION_GENERATED",
  "SESSION_INITIATED",
  "SESSION_AI_MESSAGED",
  "SUPERVISING_RAISED",
  "SUPERVISING_ANSWERED",
  "TASK_COMPLETED",
  "KNOWLEDGES_LOADED",
  "MESSAGES_LOADED",
] as const;

/**
 * Kafka Configuration Constants
 */
export const KAFKA_CONFIG = {
  PARTITIONS_CONSUMED_CONCURRENTLY: 160,
} as const;

/**
 * Backlog Monitoring Configuration
 */
export const BACKLOG_MONITORING = {
  DEFAULT_INTERVAL_MS: 60000, // 60 seconds
} as const;

/**
 * Event Processing Configuration
 */
export const EVENT_PROCESSING = {
  CALLBACK_EXECUTION_DELAY_MS: 0,
} as const;

/**
 * Pushgateway Configuration Defaults
 */
export const PUSHGATEWAY_DEFAULTS = {
  URL: "http://localhost:9091",
  JOB_NAME: "node_events",
  INSTANCE: "default_instance",
  INTERVAL_MS: 15000, // 15 seconds
} as const;

/**
 * Metrics Histogram Buckets
 */
export const METRICS_BUCKETS = {
  DURATION_SECONDS: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  PAYLOAD_SIZE_BYTES: [10, 100, 1000, 10000, 100000, 1000000],
} as const;

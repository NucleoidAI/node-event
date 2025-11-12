/**
 * Base class for all event system errors
 */
export class EventSystemError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Thrown when an adapter is not connected but an operation requires it
 */
export class AdapterNotConnectedError extends EventSystemError {
  constructor(adapterType?: string, details?: unknown) {
    super(
      adapterType
        ? `${adapterType} adapter not connected`
        : "Adapter not connected",
      "ADAPTER_NOT_CONNECTED",
      details
    );
  }
}

/**
 * Thrown when an invalid event type is provided
 */
export class InvalidEventTypeError extends EventSystemError {
  constructor(eventType: string, details?: unknown) {
    super(
      `Invalid event type: ${eventType}`,
      "INVALID_EVENT_TYPE",
      details
    );
  }
}

/**
 * Thrown when publishing an event fails
 */
export class PublishError extends EventSystemError {
  constructor(
    eventType: string,
    cause: Error,
    details?: unknown
  ) {
    super(
      `Failed to publish event "${eventType}": ${cause.message}`,
      "PUBLISH_ERROR",
      { ...details, cause }
    );
  }
}

/**
 * Thrown when subscribing to an event fails
 */
export class SubscribeError extends EventSystemError {
  constructor(
    eventType: string,
    cause: Error,
    details?: unknown
  ) {
    super(
      `Failed to subscribe to event "${eventType}": ${cause.message}`,
      "SUBSCRIBE_ERROR",
      { ...details, cause }
    );
  }
}

/**
 * Thrown when unsubscribing from an event fails
 */
export class UnsubscribeError extends EventSystemError {
  constructor(
    eventType: string,
    cause: Error,
    details?: unknown
  ) {
    super(
      `Failed to unsubscribe from event "${eventType}": ${cause.message}`,
      "UNSUBSCRIBE_ERROR",
      { ...details, cause }
    );
  }
}

/**
 * Thrown when adapter initialization fails
 */
export class AdapterInitializationError extends EventSystemError {
  constructor(adapterType: string, cause: Error, details?: unknown) {
    super(
      `Failed to initialize ${adapterType} adapter: ${cause.message}`,
      "ADAPTER_INITIALIZATION_ERROR",
      { ...details, cause }
    );
  }
}

/**
 * Thrown when adapter connection fails
 */
export class AdapterConnectionError extends EventSystemError {
  constructor(adapterType: string, cause: Error, details?: unknown) {
    super(
      `Failed to connect ${adapterType} adapter: ${cause.message}`,
      "ADAPTER_CONNECTION_ERROR",
      { ...details, cause }
    );
  }
}

/**
 * Thrown when adapter disconnection fails
 */
export class AdapterDisconnectionError extends EventSystemError {
  constructor(adapterType: string, cause: Error, details?: unknown) {
    super(
      `Failed to disconnect ${adapterType} adapter: ${cause.message}`,
      "ADAPTER_DISCONNECTION_ERROR",
      { ...details, cause }
    );
  }
}

/**
 * Thrown when an unknown adapter type is requested
 */
export class UnknownAdapterTypeError extends EventSystemError {
  constructor(adapterType: string, details?: unknown) {
    super(
      `Unknown adapter type: ${adapterType}`,
      "UNKNOWN_ADAPTER_TYPE",
      details
    );
  }
}

/**
 * Thrown when event system is not initialized
 */
export class EventSystemNotInitializedError extends EventSystemError {
  constructor(details?: unknown) {
    super(
      "Event system not initialized. Call init() first.",
      "EVENT_SYSTEM_NOT_INITIALIZED",
      details
    );
  }
}

/**
 * Thrown when a callback execution fails
 */
export class CallbackExecutionError extends EventSystemError {
  constructor(
    eventType: string,
    cause: Error,
    details?: unknown
  ) {
    super(
      `Error in callback for event "${eventType}": ${cause.message}`,
      "CALLBACK_EXECUTION_ERROR",
      { ...details, cause }
    );
  }
}

/**
 * Thrown when metrics push to gateway fails
 */
export class MetricsPushError extends EventSystemError {
  constructor(cause: Error, details?: unknown) {
    super(
      `Failed to push metrics to Pushgateway: ${cause.message}`,
      "METRICS_PUSH_ERROR",
      { ...details, cause }
    );
  }
}

/**
 * Thrown when pushgateway is not configured
 */
export class PushgatewayNotConfiguredError extends EventSystemError {
  constructor(details?: unknown) {
    super(
      "Pushgateway not configured. Call startPushgateway() first.",
      "PUSHGATEWAY_NOT_CONFIGURED",
      details
    );
  }
}

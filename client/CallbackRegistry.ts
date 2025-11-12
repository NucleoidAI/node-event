import { Callback } from "./types/types";
import { EVENT_PROCESSING } from "./constants";

/**
 * Manages event callbacks and their execution
 */
export class CallbackRegistry {
  private callbacks: Map<string, Set<Callback>> = new Map();
  private onSubscriptionChange?: (type: string, count: number) => void;

  /**
   * Sets a callback to be invoked when subscription count changes
   * @param callback - Function to call with event type and new count
   */
  setSubscriptionChangeCallback(callback: (type: string, count: number) => void): void {
    this.onSubscriptionChange = callback;
  }

  /**
   * Registers a callback for a specific event type
   * @param type - Event type to subscribe to
   * @param callback - Callback function to execute
   * @returns Unsubscribe function
   */
  register<T extends object = object>(
    type: string,
    callback: Callback<T>
  ): () => void {
    if (!this.callbacks.has(type)) {
      this.callbacks.set(type, new Set());
    }

    const callbackSet = this.callbacks.get(type)!;
    callbackSet.add(callback as Callback);

    this.notifySubscriptionChange(type, callbackSet.size);

    // Return unsubscribe function
    return () => {
      callbackSet.delete(callback as Callback);

      if (callbackSet.size === 0) {
        this.callbacks.delete(type);
      }

      this.notifySubscriptionChange(type, callbackSet.size);
    };
  }

  /**
   * Executes all registered callbacks for a specific event type
   * @param type - Event type
   * @param payload - Event payload
   * @param metricsCallback - Optional callback to record metrics
   */
  execute(
    type: string,
    payload: object,
    metricsCallback?: () => () => void
  ): void {
    const callbackSet = this.callbacks.get(type);

    // No callbacks for this topic - message ignored
    if (!callbackSet) return;

    callbackSet.forEach((callback) => {
      setTimeout(() => {
        const endTimer = metricsCallback?.();
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error in callback for ${type}:`, error);
        }
        endTimer?.();
      }, EVENT_PROCESSING.CALLBACK_EXECUTION_DELAY_MS);
    });
  }

  /**
   * Gets the number of callbacks registered for a specific event type
   * @param type - Event type
   * @returns Number of registered callbacks
   */
  getCallbackCount(type: string): number {
    return this.callbacks.get(type)?.size ?? 0;
  }

  /**
   * Checks if there are any callbacks registered for a specific event type
   * @param type - Event type
   * @returns true if callbacks are registered
   */
  hasCallbacks(type: string): boolean {
    return this.getCallbackCount(type) > 0;
  }

  /**
   * Clears all registered callbacks
   */
  clear(): void {
    this.callbacks.clear();
  }

  /**
   * Gets all event types with registered callbacks
   * @returns Array of event types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.callbacks.keys());
  }

  /**
   * Notifies the subscription change callback
   * @param type - Event type
   * @param count - New subscription count
   */
  private notifySubscriptionChange(type: string, count: number): void {
    this.onSubscriptionChange?.(type, count);
  }
}

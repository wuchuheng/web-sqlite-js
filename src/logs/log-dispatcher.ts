import type { LogEntry } from "../types/DB";

/**
 * Log callback type
 * Receives structured log entries with level and data
 */
export type LogCallback = (log: LogEntry) => void;

/**
 * Cancel function type
 * Idempotent function to unregister a log callback
 */
export type CancelFn = () => void;

/**
 * Log Dispatcher interface
 * Returned by createLogDispatcher factory function
 */
export interface LogDispatcher {
  /**
   * Register a log callback
   * @returns Cancel function to unregister the callback
   */
  register: (callback: LogCallback) => CancelFn;

  /**
   * Dispatch a log entry to all registered callbacks
   */
  dispatch: (log: LogEntry) => void;

  /**
   * Get the number of registered callbacks
   * @internal
   */
  _getCallbackCount: () => number;

  /**
   * Clear all callbacks
   * @internal
   */
  _clear: () => void;
}

/**
 * Create a log dispatcher for managing log callbacks
 *
 * Functional implementation using closures for private state.
 * Each dispatcher instance has isolated callback tracking.
 *
 * Responsibilities:
 * - Register/unregister log callbacks
 * - Dispatch log entries to all registered callbacks
 * - Handle callback errors with isolation (errors don't break dispatching)
 * - Provide idempotent cancel functions
 *
 * Thread-safety: Main-thread only (JavaScript is single-threaded)
 *
 * @example
 * const dispatcher = createLogDispatcher();
 * const cancel = dispatcher.register((log) => console.log(log));
 * dispatcher.dispatch({level: "debug", data: {sql: "SELECT..."}});
 * cancel(); // Remove callback (idempotent)
 */
export function createLogDispatcher(): LogDispatcher {
  // Private state via closure
  const callbacks = new Set<LogCallback>();
  const cancelFns = new Set<CancelFn>();

  /**
   * Register a log callback
   */
  const register = (callback: LogCallback): CancelFn => {
    // Remove from canceled set if this callback was previously canceled
    // This allows re-registration of the same callback function
    for (const fn of cancelFns) {
      if ((fn as { _callback?: LogCallback })._callback === callback) {
        cancelFns.delete(fn);
        break;
      }
    }

    callbacks.add(callback);

    // Create cancel function with callback reference for idempotent cancellation
    const cancelFn: CancelFn & { _callback?: LogCallback } = () => {
      callbacks.delete(callback);
      cancelFns.add(cancelFn);
    };
    cancelFn._callback = callback;

    return cancelFn;
  };

  /**
   * Dispatch a log entry to all registered callbacks
   *
   * Callback errors are isolated - one callback throwing doesn't
   * prevent other callbacks from receiving the log entry.
   */
  const dispatch = (log: LogEntry): void => {
    for (const callback of callbacks) {
      try {
        callback(log);
      } catch (error) {
        // Error isolation: log callback errors but continue dispatching
        console.error("[LogDispatcher] Callback error:", error);
      }
    }
  };

  /**
   * Get the number of registered callbacks
   * @internal
   */
  const _getCallbackCount = (): number => callbacks.size;

  /**
   * Clear all callbacks
   * @internal
   */
  const _clear = (): void => {
    callbacks.clear();
    cancelFns.clear();
  };

  return { register, dispatch, _getCallbackCount, _clear };
}

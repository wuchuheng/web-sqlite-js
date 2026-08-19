import Sqlite3Worker from "./worker?worker&inline";
import {
  PrepareRequest,
  PrepareResponse,
  type SqliteReqMsg,
  type SqliteResMsg,
  SqliteEvent,
} from "./types/message";
import type { LogDispatcher } from "./logs/log-dispatcher";

/**
 * Default timeout for a single worker round-trip. If the worker never
 * responds (e.g. its main thread is blocked on the SharedArrayBuffer OPFS
 * protocol), the call rejects with this message instead of hanging forever.
 * Must be larger than the sqlite3.mjs opRun watchdog wait (3000ms) so a
 * wedged proxy fails loudly at the library boundary, and smaller than the
 * extension-level request timeout (5000ms in the Dianzhi extension).
 */
export const DEFAULT_BRIDGE_TIMEOUT_MS = 5_000;

export type WorkerBridgeOptions = {
  /**
   * Per-message timeout in milliseconds. Defaults to DEFAULT_BRIDGE_TIMEOUT_MS.
   */
  timeoutMs?: number;
  /**
   * Worker factory for tests and embedders. Defaults to the inline SQLite worker.
   */
  workerFactory?: () => Worker;
};

type Task<T> = {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

/**
 * Type definition for the worker bridge interface.
 * Provides methods for communicating with the SQLite worker.
 */
export type WorkerBridge = {
  /**
   * Sends a message to the worker and returns a promise that resolves with the response.
   *
   * @template TRes - The type of the expected response.
   * @template TReq - The type of the request payload. Defaults to unknown.
   * @param event - The event type to send.
   * @param payload - The optional payload to send with the event.
   * @returns A promise that resolves with the response of type TRes.
   */
  sendMsg: <TRes, TReq = unknown>(
    event: SqliteEvent,
    payload?: TReq,
  ) => Promise<TRes>;

  /**
   * Normalizes SQL using SQLite prepare (F-003).
   * Convenience method for sending PREPARE events to the worker.
   *
   * @param sql - The SQL string to normalize.
   * @returns A promise that resolves with the normalized SQL.
   *
   * @example
   * ```typescript
   * const result = await workerBridge.sendPrepareMsg("CREATE  TABLE  test ( id  INTEGER );");
   * console.log(result.normalizedSQL); // "CREATE TABLE test(id INTEGER);"
   * ```
   */
  sendPrepareMsg: (sql: string) => Promise<PrepareResponse>;

  /**
   * Terminates the worker and rejects all pending promises.
   */
  terminate: () => void;
};

export const createWorkerBridge = (
  logDispatcher: LogDispatcher,
  options: WorkerBridgeOptions = {},
): WorkerBridge => {
  const worker = (options.workerFactory ?? (() => new Sqlite3Worker()))();
  const idMapPromise: Map<number, Task<unknown>> = new Map();
  const timeoutMs = options.timeoutMs ?? DEFAULT_BRIDGE_TIMEOUT_MS;

  worker.onmessage = (event: MessageEvent<SqliteResMsg<unknown>>) => {
    const { id, success, error, payload, logs } = event.data;
    const task = idMapPromise.get(id);

    if (!task) {
      // A response for a request we no longer track (already timed out or
      // cancelled): drop it, but log it so silent losses stay observable.
      const log = {
        level: "error" as const,
        data: { message: "SQLite worker responded for an unknown request id.", id },
      };
      logDispatcher.dispatch(log);
      console.warn("[web-sqlite-js] worker response for unknown request id:", id);
      return;
    }

    // Dispatch logs to registered callbacks
    if (logs && logs.length > 0) {
      for (const log of logs) {
        logDispatcher.dispatch(log);
      }
    }

    if (!success) {
      const newError = new Error(error!.message);
      newError.name = error!.name;
      newError.stack = error!.stack;

      task.reject(newError);
    }

    task.resolve(payload);

    idMapPromise.delete(id);
  };

  /**
   * Generates a unique message ID for each request.
   */
  const getLatestMsgId = (() => {
    let latestId = 0;
    return () => ++latestId;
  })();

  /**
   * Sends a message to the worker and returns a promise that resolves with the response.
   *
   * @template TRes - The type of the expected response.
   * @template TReq - The type of the request payload. Defaults to unknown.
   * @param event - The event type to send.
   * @param payload - The optional payload to send with the event.
   * @returns A promise that resolves with the response of type TRes.
   */
  const sendMsg = <TRes, TReq = unknown>(
    event: SqliteEvent,
    payload?: TReq,
  ): Promise<TRes> => {
    const id = getLatestMsgId();
    const msg: SqliteReqMsg<TReq> = {
      id,
      event,
      payload,
    };

    return new Promise<TRes>((resolve, reject) => {
      const timer = setTimeout(() => {
        const task = idMapPromise.get(id);
        if (!task) return;
        idMapPromise.delete(id);
        const reason = new Error(
          `SQLite worker did not respond within ${timeoutMs}ms (event: ${event}). ` +
            "The worker may be wedged; treat the database as unavailable.",
        );
        task.reject(reason);
        logDispatcher.dispatch({
          level: "error" as const,
          data: { message: reason.message, event, id },
        });
      }, timeoutMs);

      // Wrap resolve/reject so a successful response clears the watchdog timer.
      idMapPromise.set(id, {
        resolve: (value: unknown) => {
          clearTimeout(timer);
          resolve(value as TRes);
        },
        reject: (reason) => {
          clearTimeout(timer);
          reject(reason);
        },
      });
      worker.postMessage(msg);
    });
  };

  /**
   * Normalizes SQL using SQLite prepare (F-003).
   * Convenience method for sending PREPARE events to the worker.
   *
   * @param sql - The SQL string to normalize.
   * @returns A promise that resolves with the normalized SQL.
   *
   * @example
   * ```typescript
   * const result = await sendPrepareMsg("CREATE  TABLE  test ( id  INTEGER );");
   * console.log(result.normalizedSQL); // "CREATE TABLE test(id INTEGER);"
   * ```
   */
  const sendPrepareMsg = (sql: string): Promise<PrepareResponse> => {
    return sendMsg<PrepareResponse, PrepareRequest>(SqliteEvent.PREPARE, {
      sql,
    });
  };

  /**
   * Terminate the worker.
   */
  const terminate = () => {
    worker.terminate();
    idMapPromise.forEach((task) => {
      task.reject(new Error("Worker terminated"));
    });
    idMapPromise.clear();
  };

  return {
    sendMsg,
    sendPrepareMsg,
    terminate,
  };
};

/**
 * Normalizes SQL using custom normalization (F-003).
 * Public API for SQL normalization in two-tier validation.
 *
 * This function normalizes a SQL string using a custom normalization function
 * (since SQLite WASM build doesn't expose sqlite3_normalized_sql). The normalization
 * removes extra whitespace, removes comments, and standardizes SQL structure.
 * Used in Tier 2 validation when hash mismatch occurs.
 *
 * @example
 * ```typescript
 * import { normalizeSQL } from "web-sqlite-js";
 *
 * // Normalize SQL for comparison
 * const normalized = await normalizeSQL("CREATE  TABLE  test ( id  INTEGER );");
 * console.log(normalized); // "CREATE TABLE test(id INTEGER);"
 *
 * // Two-tier validation pattern (F-003)
 * // Tier 1: Fast trim + hash compare
 * const trimmedOriginal = originalSQL.trim();
 * const trimmedCurrent = currentSQL.trim();
 * const hashOriginal = await hashSQL(trimmedOriginal);
 * const hashCurrent = await hashSQL(trimmedCurrent);
 *
 * if (hashCurrent === storedHash) {
 *   // Fast pass - validation succeeds
 * } else {
 *   // Tier 2: Slow normalization
 *   const normalizedOriginal = await normalizeSQL(trimmedOriginal);
 *   const normalizedCurrent = await normalizeSQL(trimmedCurrent);
 *
 *   if (normalizedOriginal === normalizedCurrent) {
 *     // Whitespace-only difference - auto-update hash
 *     await updateHash(version, hashCurrent, sqlType);
 *   } else {
 *     // Actual SQL change - throw error
 *     throw new HashMismatchError({
 *       version,
 *       sqlType,
 *       originalSQL: truncate(currentSQL, 200),
 *       currentSQL: truncate(originalSQL, 200),
 *     });
 *   }
 * }
 * ```
 *
 * @param sql - The SQL string to normalize.
 * @param workerBridge - The worker bridge instance for communication.
 * @returns A promise that resolves with the normalized SQL string.
 * @throws {Error} If SQL is invalid.
 *
 * @remarks
 * **Performance**: <0.1ms (faster than original SQLite prepare approach)
 *
 * **Normalization Rules** (custom implementation):
 * - Removes extra whitespace (collapses multiple spaces to single space)
 * - Removes SQL comments (both -- and slash-star style)
 * - Removes spaces around parentheses, commas, and semicolons
 * - Trims leading/trailing whitespace
 *
 * **Usage**: Only call in Tier 2 validation when Tier 1 hash mismatch occurs.
 *
 * **F-003 Context**: This is part of the two-tier SQL validation system for
 * enhanced hash mismatch detection. See F-003 feature documentation for details.
 *
 * **Implementation Note**: SQLite WASM build doesn't expose sqlite3_normalized_sql
 * or sqlite3_expanded_sql functions (SQLITE_ENABLE_NORMALIZE is disabled), so we
 * implement our own normalization function instead.
 */
export const normalizeSQL = async (
  sql: string,
  workerBridge: WorkerBridge,
): Promise<string> => {
  // 1. Input validation
  if (typeof sql !== "string") {
    throw new Error("SQL must be a string");
  }

  // 2. Core processing: Send PREPARE message to worker
  const response = await workerBridge.sendPrepareMsg(sql);

  // 3. Output: Return normalized SQL string
  return response.normalizedSQL;
};

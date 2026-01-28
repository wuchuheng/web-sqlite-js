// sqlite3.worker.ts
import sqlite3InitModule, { Sqlite3, Sqlite3DB } from "./jswasm/sqlite3";
import { ExecParams } from "./types/DB";
import {
  OpenDBArgs,
  PrepareRequest,
  PrepareResponse,
  SqliteEvent,
  type SqliteReqMsg,
  type SqliteResMsg,
  type WorkerLogEntry,
} from "./types/message";

import { configureLogger, SqlLogInfo } from "./utils/logger";

let activeDb: Sqlite3DB | null = null;
let metaDb: Sqlite3DB | null = null;
let sqlite3: Sqlite3 | null = null;
let isDebug = false;

// Log collection for structured logging
let workerLogs: WorkerLogEntry[] = [];

/**
 * Normalize SQL string by removing extra whitespace and comments.
 * This is a simple normalization that handles common SQL formatting differences.
 *
 * @param sql - The SQL string to normalize
 * @returns Normalized SQL string
 */
const normalizeSQLString = (sql: string): string => {
  // Remove single-line comments (-- style)
  let normalized = sql.replace(/--[^\n]*/g, "");

  // Remove multi-line comments (/* */ style)
  normalized = normalized.replace(/\/\*[\s\S]*?\*\//g, "");

  // Collapse multiple whitespace to single space
  normalized = normalized.replace(/\s+/g, " ");

  // Remove spaces around parentheses and operators
  normalized = normalized.replace(/\s*\(\s*/g, "(");
  normalized = normalized.replace(/\s*\)\s*/g, ")");
  normalized = normalized.replace(/\s*,\s*/g, ",");
  normalized = normalized.replace(/\s*;\s*/g, ";");

  // Trim leading/trailing whitespace
  normalized = normalized.trim();

  return normalized;
};

/**
 * Add a log entry to be sent with the next response
 */
const addLog = (level: WorkerLogEntry["level"], data: unknown) => {
  workerLogs.push({ level, data });
};

// Initial call to set up the logger state (starts disabled)
configureLogger(isDebug);

const handleOpen = async (payload: OpenDBArgs) => {
  if (typeof payload.filename !== "string") {
    throw new Error("Invalid payload for OPEN event: expected filename string");
  }

  if (!sqlite3) {
    sqlite3 = await sqlite3InitModule();
    console.debug(`Initialized sqlite3 module in worker.`);
  }

  let { filename } = payload;
  if (!filename.endsWith(".sqlite3")) {
    filename += ".sqlite3";
  }

  if (payload.options) {
    isDebug = payload.options.debug === true;
    // Re-configure logger based on the new isDebug state from user options
    configureLogger(isDebug);
  }

  const target = payload.target ?? "active";
  const replace = payload.replace === true;

  if (target === "meta") {
    if (metaDb && replace) {
      metaDb.close();
      metaDb = null;
    }
    if (!metaDb) {
      metaDb = new sqlite3!.oo1!.OpfsDb!(filename, "c");
      console.debug(`Opened metadata database: ${filename}`);
    }
    return;
  }

  const hadActiveDb = Boolean(activeDb);
  if (activeDb && replace) {
    activeDb.close();
    activeDb = null;
  }
  if (!activeDb) {
    activeDb = new sqlite3!.oo1!.OpfsDb!(filename, "c");
    if (replace && hadActiveDb) {
      console.debug(`Switched active database to: ${filename}`);
    } else {
      console.debug(`Opened active database: ${filename}`);
    }
  }
};

const handleExecute = (payload: unknown) => {
  const start = performance.now();
  const { sql, bind, target } = payload as ExecParams;
  if (typeof sql !== "string") {
    throw new Error(
      "Invalid payload for EXECUTE event: expected SQL string or { sql, bind }",
    );
  }

  const db = target === "meta" ? metaDb : activeDb;
  if (!db) {
    throw new Error("Database is not open");
  }

  try {
    db.exec({ sql, bind });
    const end = performance.now();
    const duration = end - start;

    // Generate debug log for SQL execution
    addLog("debug", { sql, duration, bind });

    if (isDebug) {
      console.debug({ sql, duration, bind } as SqlLogInfo);
    }

    return {
      changes: db.changes(),
      lastInsertRowid: db.selectValue("SELECT last_insert_rowid()"),
    };
  } catch (error) {
    // Generate error log
    const errorMessage = error instanceof Error ? error.message : String(error);
    addLog("error", { sql, error: errorMessage });
    throw error;
  }
};

const handleQuery = (payload: ExecParams) => {
  // 1. Input validation.
  const { sql, bind, target } = payload;

  // 2. Handle query.
  // 2.1 Convert the sql and bind into a proper format. then execute the query.
  if (typeof sql !== "string") {
    throw new Error(
      "Invalid payload for QUERY event: expected { sql: string, bind?: any[] }",
    );
  }

  const db = target === "meta" ? metaDb : activeDb;
  if (!db) {
    throw new Error("Database is not open");
  }

  const start = performance.now();
  const rows = db.selectObjects(sql, bind);
  const end = performance.now();
  const duration = end - start;

  // Generate debug log for query
  addLog("debug", { sql, duration, bind });

  if (isDebug) {
    console.debug({
      sql,
      duration,
      bind,
    } as SqlLogInfo);
  }

  return rows;
};

/**
 * Handles PREPARE event (F-003).
 * Normalizes SQL using custom normalization for two-tier validation.
 *
 * Note: SQLite WASM build doesn't expose sqlite3_normalized_sql or sqlite3_expanded_sql,
 * so we implement our own SQL normalization.
 *
 * @example
 * ```typescript
 * const result = handlePrepare({ sql: "CREATE  TABLE  test ( id  INTEGER );" });
 * // Returns: { normalizedSQL: "CREATE TABLE test(id INTEGER);" }
 * ```
 *
 * @param payload - The prepare request payload containing SQL string.
 * @returns Normalized SQL string.
 * @throws {Error} If SQL is not a string.
 */
const handlePrepare = (payload: unknown): PrepareResponse => {
  // 1. Input validation.
  const { sql } = payload as PrepareRequest;
  if (typeof sql !== "string") {
    throw new Error("Invalid payload for PREPARE event: expected sql string");
  }

  // 2. Normalize SQL using custom function
  const normalizedSQL = normalizeSQLString(sql);

  // 3. Output: Return normalized SQL.
  return { normalizedSQL };
};

const handleClose = () => {
  if (activeDb) {
    activeDb.close();
    activeDb = null;
  }
  if (metaDb) {
    metaDb.close();
    metaDb = null;
  }
  sqlite3 = null;
};

self.onmessage = async (msg: MessageEvent<SqliteReqMsg<unknown>>) => {
  const { id, event, payload } = msg.data;

  // Clear logs for this request
  workerLogs = [];

  try {
    if (sqlite3 === null && event !== SqliteEvent.OPEN) {
      throw new Error("Database is not open");
    }

    let result: unknown = undefined;

    switch (event) {
      case SqliteEvent.OPEN:
        await handleOpen(payload as OpenDBArgs);
        break;

      case SqliteEvent.EXECUTE:
        result = handleExecute(payload);
        break;

      case SqliteEvent.QUERY:
        result = handleQuery(payload as ExecParams);
        break;

      case SqliteEvent.CLOSE:
        handleClose();
        break;

      case SqliteEvent.PREPARE:
        result = handlePrepare(payload);
        break;

      default:
        throw new Error(`Unknown event: ${event}`);
    }

    // Include logs in response
    const res: SqliteResMsg<unknown> = {
      id,
      success: true,
      payload: result,
      logs: workerLogs.length > 0 ? [...workerLogs] : undefined,
    };
    self.postMessage(res);
  } catch (err) {
    const errorObj = err instanceof Error ? err : new Error(String(err));

    // Include logs in error response
    const res: SqliteResMsg<void> = {
      id,
      success: false,
      error: {
        name: errorObj.name,
        message: errorObj.message,
        stack: errorObj.stack,
      } as Error,
      logs: workerLogs.length > 0 ? [...workerLogs] : undefined,
    };
    self.postMessage(res);
  }
};

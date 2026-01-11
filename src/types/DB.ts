/**
 * A value which can be bound to a SQLite parameter.
 */
export type SqlValue =
  | null
  | number
  | string
  | boolean
  | bigint
  | Uint8Array
  | ArrayBuffer;

/** A bindable parameter collection: positional or named. */
export type SQLParams = SqlValue[] | Record<string, SqlValue>;

/**
 * Log entry with level and structured data
 */
export type LogEntry = {
  /**
   * Log level: 'info' | 'debug' | 'error'
   */
  level: "info" | "debug" | "error";

  /**
   * Log data (SQL, timing, errors, events, etc.)
   */
  data: unknown;
};

export type DbTarget = "active" | "meta";

export type ExecParams = { sql: string; bind?: SQLParams; target?: DbTarget };

/**
 * Release configuration entry for versioned migrations.
 */
export type ReleaseConfig = {
  /** Semantic version string "x.x.x" (no leading zeros). */
  version: string;
  /** Migration SQL to apply for this version. */
  migrationSQL: string;
  /** Optional seed SQL to apply after migration. */
  seedSQL?: string | null;
};

/**
 * Options for opening a database.
 */
export type OpenDBOptions = {
  /** Immutable release history configuration. */
  releases?: ReleaseConfig[];
  /** Enable SQL timing logs in the worker. */
  debug?: boolean;
};

/**
 * Metadata returned for non-query statements.
 * @property changes Number of rows changed by last operation (may be bigint on some builds).
 * @property lastInsertRowid Last inserted row id when applicable.
 */
export type ExecResult = {
  changes?: number | bigint;
  lastInsertRowid?: number | bigint;
};

/**
 * A prepared statement client wrapper.
 * @remarks The `stmtId` is optional and intended for debugging only; callers should not depend on it.
 */
export interface PreparedStatement {
  /**
   * Execute a SQL script (one or more statements) without returning rows.
   * Intended for migrations, schema setup, or bulk SQL execution.
   * @param sql - SQL string to execute.
   * @param params - Optional bind parameters for the statement.
   */
  exec(sql: string, params?: SQLParams): Promise<ExecResult>;

  /**
   * Execute a query and return all result rows as an array of objects.
   * @param sql - SELECT SQL to execute.
   * @param params - Optional bind parameters for the query.
   */
  query<T = unknown>(sql: string, params?: SQLParams): Promise<T[]>;

  /** Reset the statement cursor to allow re-execution with different parameters. */
  reset(): Promise<void>;

  /** Finalize the statement and release worker-side resources. Idempotent. */
  finalize(): Promise<void>;

  /** Optional debug-only statement id returned by the worker when the statement was prepared. */
  readonly stmtId?: number;
}

/** Primary DB interface used by client code. */
export interface DBInterface {
  /**
   * Execute a SQL script (one or more statements) without returning rows.
   * Intended for migrations, schema setup, or bulk SQL execution.
   * @param sql - SQL string to execute.
   * @param params - Optional bind parameters for the statement.
   */
  exec(sql: string, params?: SQLParams): Promise<ExecResult>;

  /**
   * Execute a query and return all result rows as an array of objects.
   * @param sql - SELECT SQL to execute.
   * @param params - Optional bind parameters for the query.
   */
  query<T = unknown>(sql: string, params?: SQLParams): Promise<T[]>;

  /**
   * Run a callback inside a transaction. The implementation should BEGIN before calling `fn`
   * and COMMIT on success or ROLLBACK on error.
   * @param fn - Callback that receives a DBInterface and performs transactional work.
   */
  transaction<T>(fn: transactionCallback<T>): Promise<T>;

  /** Close the database and release resources. */
  close(): Promise<void>;

  /**
   * Subscribe to log events
   * Logs include SQL execution, timing, errors, and application events
   *
   * @param callback - Called for each log entry
   * @returns Unsubscribe function
   *
   * @example
   * const unsubscribe = db.onLog((log) => {
   *     console.log(`[${log.level}]`, log.data);
   * });
   * // Later: unsubscribe();
   */
  onLog(callback: (log: LogEntry) => void): () => void;

  /** Dev tooling APIs for release testing. */
  devTool: DevTool;
}

export type transactionCallback<T> = (
  db: Pick<DBInterface, "exec" | "query">,
) => Promise<T>;

export type DevTool = {
  /**
   * Create a new dev version using migration and seed SQL.
   */
  release(input: ReleaseConfig): Promise<void>;

  /**
   * Roll back to a target version and remove dev versions above it.
   */
  rollback(version: string): Promise<void>;
};

/**
 * Record containing database instance and its release SQL mappings.
 * Used in global namespace for v2.1.0+ to provide access to migration SQL.
 *
 * @example
 * ```typescript
 * const record: DatabaseRecord = {
 *   migrationSQL: new Map([["1.0.0", "CREATE TABLE..."]]),
 *   seedSQL: new Map([["1.0.0", "INSERT INTO..."]]),
 *   db: databaseInstance,
 * };
 *
 * // Access database
 * await record.db.query("SELECT * FROM users");
 *
 * // Access migration SQL
 * const migration = record.migrationSQL.get("1.0.0");
 * ```
 */
export interface DatabaseRecord {
  /**
   * Map of version → migration SQL
   * Key: semantic version (e.g., "1.0.0")
   * Value: migration SQL string
   */
  migrationSQL: Map<string, string>;

  /**
   * Map of version → seed SQL
   * Key: semantic version (e.g., "1.0.0")
   * Value: seed SQL string (empty string if no seed)
   */
  seedSQL: Map<string, string>;

  /**
   * Database interface instance
   */
  db: DBInterface;
}

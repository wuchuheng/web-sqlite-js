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
   *
   * @param sql - SQL string to execute.
   * @param params - Optional bind parameters for the statement.
   * @returns Result metadata (changes, lastInsertRowid).
   *
   * @example
   * ```ts
   * await db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");
   * await db.exec("INSERT INTO users (name) VALUES (?)", ["Alice"]);
   * ```
   */
  exec(sql: string, params?: SQLParams): Promise<ExecResult>;

  /**
   * Execute a query and return all result rows as an array of objects.
   *
   * @param sql - SELECT SQL to execute.
   * @param params - Optional bind parameters for the query.
   * @returns Array of result rows.
   *
   * @example
   * ```ts
   * const users = await db.query<{ id: number; name: string }>(
   *   "SELECT id, name FROM users WHERE id = ?",
   *   [1]
   * );
   * ```
   */
  query<T = unknown>(sql: string, params?: SQLParams): Promise<T[]>;

  /**
   * Execute a transaction with automatic rollback on error.
   *
   * @param fn - Transaction callback receiving transaction interface.
   * @returns Result of the transaction callback.
   *
   * @example
   * ```ts
   * await db.transaction(async (tx) => {
   *   await tx.exec("INSERT INTO users (name) VALUES (?)", ["Bob"]);
   *   await tx.exec("INSERT INTO posts (title) VALUES (?)", ["Hello"]);
   * });
   * ```
   */
  transaction<T>(fn: transactionCallback<T>): Promise<T>;

  /**
   * Close the database and release worker resources.
   *
   * @example
   * ```ts
   * await db.close();
   * ```
   */
  close(): Promise<void>;

  /**
   * Register a callback for database logs (worker SQL execution logs).
   *
   * @param callback - Function to receive log entries.
   * @returns Unregister function.
   *
   * @example
   * ```ts
   * const unregister = db.onLog((log) => {
   *   console.log(`[${log.level}]`, log.data);
   * });
   * // Later: unregister();
   * ```
   */
  onLog(callback: (log: LogEntry) => void): () => void;

  /**
   * Dev tooling for creating and managing dev versions.
   */
  devTool: DevTool;
}

/**
 * Transaction callback interface.
 * Provides exec and query methods scoped to the transaction.
 */
export type transactionCallback<T> = (tx: Transaction) => Promise<T>;

/**
 * Transaction interface passed to transaction callbacks.
 * All operations execute within the same transaction.
 */
export interface Transaction {
  /**
   * Execute a SQL statement within the transaction.
   */
  exec(sql: string, params?: SQLParams): Promise<ExecResult>;

  /**
   * Execute a query within the transaction.
   */
  query<T = unknown>(sql: string, params?: SQLParams): Promise<T[]>;
}

/**
 * Dev tooling interface for creating and rolling back dev versions.
 */
export type DevTool = {
  /**
   * Create a new dev version with migration and seed SQL.
   *
   * @param input - Release config with version, migration SQL, and optional seed SQL.
   *
   * @example
   * ```ts
   * await db.devTool.release({
   *   version: "1.0.1",
   *   migrationSQL: "ALTER TABLE users ADD COLUMN email TEXT",
   *   seedSQL: "UPDATE users SET email = 'test@example.com' WHERE email IS NULL",
   * });
   * ```
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
 *   originalMigrationSQL: new Map([["1.0.0", "CREATE TABLE..."]]), // F-003
 *   originalSeedSQL: new Map([["1.0.0", "INSERT INTO..."]]), // F-003
 *   db: databaseInstance,
 * };
 *
 * // Access database
 * await record.db.query("SELECT * FROM users");
 *
 * // Access migration SQL
 * const migration = record.migrationSQL.get("1.0.0");
 *
 * // Access original SQL (F-003)
 * const originalMigration = record.originalMigrationSQL.get("1.0.0");
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
   * Map of version → original migration SQL (F-003)
   * Key: semantic version (e.g., "1.0.0")
   * Value: original migration SQL string at release time
   * Used for two-tier validation (Tier 2: prepare normalization)
   */
  originalMigrationSQL: Map<string, string>;

  /**
   * Map of version → original seed SQL (F-003)
   * Key: semantic version (e.g., "1.0.0")
   * Value: original seed SQL string at release time (null if no seed)
   * Used for two-tier validation (Tier 2: prepare normalization)
   */
  originalSeedSQL: Map<string, string | null>;

  /**
   * Database interface instance
   */
  db: DBInterface;
}

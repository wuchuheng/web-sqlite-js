import type { DatabaseRecord } from "../types/DB";
import { globalNamespace } from "../global/namespace";

/**
 * Normalizes a database filename to ensure consistent registry keys.
 * - Appends `.sqlite3` suffix if not present
 * - Trims whitespace
 *
 * @param filename - The database filename to normalize
 * @returns Normalized database name
 *
 * @example
 * normalizeDatabaseName("myapp") // "myapp.sqlite3"
 * normalizeDatabaseName("myapp.sqlite3") // "myapp.sqlite3"
 * normalizeDatabaseName("  myapp  ") // "myapp.sqlite3"
 */
export function normalizeDatabaseName(filename: string): string {
  const trimmed = filename.trim();
  if (!trimmed.endsWith(".sqlite3")) {
    return `${trimmed}.sqlite3`;
  }
  return trimmed;
}

/**
 * Database registry error types.
 */
export class DatabaseAlreadyOpenError extends Error {
  constructor(filename: string) {
    super(`Database '${filename}' is already open`);
    this.name = "DatabaseAlreadyOpenError";
  }
}

export class DatabaseNotFoundError extends Error {
  constructor(filename: string) {
    super(`Database '${filename}' is not registered`);
    this.name = "DatabaseNotFoundError";
  }
}

/**
 * Database Registry - Singleton pattern for tracking opened database instances.
 *
 * v2.1.0: Now stores DatabaseRecord (with SQL Maps) instead of just DBInterface.
 *
 * Responsibilities:
 * - Track all opened database records by normalized filename
 * - Prevent opening the same database name twice
 * - Provide lookup and list operations
 *
 * Thread-safety: Main-thread only (JavaScript is single-threaded)
 * Lock state is maintained in-memory and cleared on page unload
 *
 * @example
 * // Register a database record
 * registry.register("myapp.sqlite3", {
 *   migrationSQL: new Map(),
 *   seedSQL: new Map(),
 *   db: dbInstance,
 * });
 *
 * // Check if available
 * registry.checkLock("myapp.sqlite3"); // throws if already open
 *
 * // Get database record
 * const record = registry.get("myapp.sqlite3");
 *
 * // Unregister on close
 * registry.unregister("myapp.sqlite3");
 */
class DatabaseRegistryImpl {
  // v2.1.0: Store DatabaseRecord instead of DBInterface
  private databases: Map<string, DatabaseRecord> = new Map();
  private locks: Set<string> = new Set();

  /**
   * Register a database record.
   *
   * @param filename - Normalized database filename
   * @param record - Database record with SQL mappings and DB interface
   * @throws {Error} If database is already registered
   */
  register(filename: string, record: DatabaseRecord): void {
    const normalized = normalizeDatabaseName(filename);
    if (this.databases.has(normalized)) {
      throw new DatabaseAlreadyOpenError(normalized);
    }
    this.databases.set(normalized, record);
    this.locks.add(normalized);

    // Sync namespace databases
    const databasesRecord: Record<string, DatabaseRecord> = {};
    for (const [name, dbRecord] of this.databases) {
      databasesRecord[name] = dbRecord;
    }
    globalNamespace._updateDatabases(databasesRecord);
  }

  /**
   * Unregister a database record.
   *
   * @param filename - Normalized database filename
   */
  unregister(filename: string): void {
    const normalized = normalizeDatabaseName(filename);
    this.databases.delete(normalized);
    this.locks.delete(normalized);

    // Sync namespace databases
    const databasesRecord: Record<string, DatabaseRecord> = {};
    for (const [name, dbRecord] of this.databases) {
      databasesRecord[name] = dbRecord;
    }
    globalNamespace._updateDatabases(databasesRecord);
  }

  /**
   * Get a registered database record.
   *
   * @param filename - Normalized database filename
   * @returns Database record or undefined if not found
   */
  get(filename: string): DatabaseRecord | undefined {
    const normalized = normalizeDatabaseName(filename);
    return this.databases.get(normalized);
  }

  /**
   * Check if a database is registered.
   *
   * @param filename - Normalized database filename
   * @returns true if database is registered
   */
  has(filename: string): boolean {
    const normalized = normalizeDatabaseName(filename);
    return this.databases.has(normalized);
  }

  /**
   * List all registered database names.
   *
   * @returns Array of normalized database filenames
   */
  list(): string[] {
    return Array.from(this.databases.keys());
  }

  /**
   * Check if a database lock is available (not already open).
   *
   * @param filename - Normalized database filename
   * @throws {DatabaseAlreadyOpenError} If database is already open
   */
  checkLock(filename: string): void {
    const normalized = normalizeDatabaseName(filename);
    if (this.locks.has(normalized)) {
      throw new DatabaseAlreadyOpenError(normalized);
    }
  }

  /**
   * Acquire a database lock.
   *
   * @param filename - Normalized database filename
   * @throws {DatabaseAlreadyOpenError} If lock is already held
   */
  acquireLock(filename: string): void {
    const normalized = normalizeDatabaseName(filename);
    if (this.locks.has(normalized)) {
      throw new DatabaseAlreadyOpenError(normalized);
    }
    this.locks.add(normalized);
  }

  /**
   * Release a database lock.
   *
   * @param filename - Normalized database filename
   */
  releaseLock(filename: string): void {
    const normalized = normalizeDatabaseName(filename);
    this.locks.delete(normalized);
  }

  /**
   * Clear all databases and locks.
   * Used for testing or cleanup.
   *
   * @internal
   */
  _clear(): void {
    this.databases.clear();
    this.locks.clear();
  }
}

/**
 * Singleton database registry instance.
 */
export const DatabaseRegistry = new DatabaseRegistryImpl();

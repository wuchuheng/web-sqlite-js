import type { DBInterface } from "../types/DB";
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
 * Responsibilities:
 * - Track all opened database instances by normalized filename
 * - Prevent opening the same database name twice
 * - Provide lookup and list operations
 *
 * Thread-safety: Main-thread only (JavaScript is single-threaded)
 * Lock state is maintained in-memory and cleared on page unload
 *
 * @example
 * // Register a database
 * registry.register("myapp.sqlite3", dbInstance);
 *
 * // Check if available
 * registry.checkLock("myapp.sqlite3"); // throws if already open
 *
 * // Get database instance
 * const db = registry.get("myapp.sqlite3");
 *
 * // Unregister on close
 * registry.unregister("myapp.sqlite3");
 */
class DatabaseRegistryImpl {
  private databases: Map<string, DBInterface> = new Map();
  private locks: Set<string> = new Set();

  /**
   * Register a database instance.
   *
   * @param filename - Normalized database filename
   * @param db - Database interface instance
   * @throws {Error} If database is already registered
   */
  register(filename: string, db: DBInterface): void {
    const normalized = normalizeDatabaseName(filename);
    if (this.databases.has(normalized)) {
      throw new DatabaseAlreadyOpenError(normalized);
    }
    this.databases.set(normalized, db);
    this.locks.add(normalized);

    // Sync namespace databases
    const databasesRecord: Record<string, DBInterface> = {};
    for (const [name, dbInstance] of this.databases) {
      databasesRecord[name] = dbInstance;
    }
    globalNamespace._updateDatabases(databasesRecord);
  }

  /**
   * Unregister a database instance.
   *
   * @param filename - Normalized database filename
   */
  unregister(filename: string): void {
    const normalized = normalizeDatabaseName(filename);
    this.databases.delete(normalized);
    this.locks.delete(normalized);

    // Sync namespace databases
    const databasesRecord: Record<string, DBInterface> = {};
    for (const [name, dbInstance] of this.databases) {
      databasesRecord[name] = dbInstance;
    }
    globalNamespace._updateDatabases(databasesRecord);
  }

  /**
   * Get a registered database instance.
   *
   * @param filename - Normalized database filename
   * @returns Database instance or undefined if not found
   */
  get(filename: string): DBInterface | undefined {
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

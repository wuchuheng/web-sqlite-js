import type { DatabaseRecord } from "./DB";

/**
 * Event emitted when a database is opened or closed
 */
export interface DatabaseChangeEvent {
  /**
   * What happened: 'opened' | 'closed'
   */
  action: "opened" | "closed";

  /**
   * Which database changed (normalized name, e.g., "myapp.sqlite3")
   */
  dbName: string;

  /**
   * All currently opened database names
   */
  databases: string[];
}

/**
 * Global namespace for web-sqlite-js
 * Provides direct access to opened database instances and event subscription
 *
 * @example
 * ```typescript
 * // Access database directly (v2.1.0+)
 * const record = window.__web_sqlite.databases["myapp.sqlite3"];
 * await record.db.query("SELECT * FROM users");
 * const migration = record.migrationSQL.get("1.0.0");
 *
 * // Subscribe to database changes
 * const unsubscribe = window.__web_sqlite.onDatabaseChange((event) => {
 *   console.log(`Database ${event.action}: ${event.dbName}`);
 * });
 * ```
 */
export interface WebSqliteNamespace {
  /**
   * Map of currently opened database records
   * Key: normalized database name (e.g., "myapp.sqlite3")
   * Value: Database record with SQL mappings and DB interface (v2.1.0+)
   * @readonly
   */
  readonly databases: Record<string, DatabaseRecord>;

  /**
   * Subscribe to database open/close events
   * @param callback - Called when a database is opened or closed
   * @returns Unsubscribe function
   * @example
   * ```typescript
   * const unsubscribe = window.__web_sqlite.onDatabaseChange((event) => {
   *   if (event.action === "opened") {
   *     console.log("New database:", event.dbName);
   *   }
   * });
   * // Later: unsubscribe();
   * ```
   */
  onDatabaseChange(callback: (event: DatabaseChangeEvent) => void): () => void;
}

/**
 * Extend the global Window interface with web-sqlite-js namespace
 * This allows TypeScript to recognize `window.__web_sqlite` property
 */
declare global {
  interface Window {
    /**
     * web-sqlite-js global namespace
     * Provides direct access to opened database instances and event subscription
     */
    readonly __web_sqlite: WebSqliteNamespace;
  }
}

/**
 * Export empty object to make this a module
 * Required for `declare global` augmentation to work
 */
export {};

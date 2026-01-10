import type { DBInterface } from "./DB";

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
 * Extend the Window interface with the global namespace
 */
declare global {
  interface Window {
    /**
     * web-sqlite-js global namespace
     * Provides direct access to opened database instances
     */
    __web_sqlite: {
      /**
       * Map of currently opened database instances
       * Key: normalized database name (e.g., "myapp.sqlite3")
       * Value: Database interface instance
       * @readonly
       */
      readonly databases: Record<string, DBInterface>;

      /**
       * Subscribe to database open/close events
       * @param callback - Called when a database is opened or closed
       * @returns Unsubscribe function
       */
      onDatabaseChange(
        callback: (event: DatabaseChangeEvent) => void,
      ): () => void;
    };
  }
}

export {};

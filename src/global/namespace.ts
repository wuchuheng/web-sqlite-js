import type { DBInterface } from "../types/DB";
import type { DatabaseChangeEvent } from "../types/global";

/**
 * Global namespace for web-sqlite-js
 * Provides direct access to opened database instances and event subscription
 *
 * Properties:
 * - databases: Record<string, DBInterface> - Map of opened database instances
 * - onDatabaseChange: (callback) => () => void - Subscribe to database lifecycle events
 */
export interface WebSqliteNamespace {
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
  onDatabaseChange(callback: (event: DatabaseChangeEvent) => void): () => void;

  /**
   * Internal method to update databases from registry
   * Called by DatabaseRegistry on register/unregister
   * @internal
   */
  _updateDatabases(databases: Record<string, DBInterface>): void;

  /**
   * Internal method to emit database change events
   * @internal
   */
  _emitEvent(event: DatabaseChangeEvent): void;
}

/**
 * Global namespace property name
 */
const NAMESPACE_PROPERTY = "__web_sqlite";

/**
 * Event emitter for database change events
 */
class DatabaseEventEmitter {
  private subscribers: Set<(event: DatabaseChangeEvent) => void> = new Set();

  subscribe(callback: (event: DatabaseChangeEvent) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  emit(event: DatabaseChangeEvent): void {
    for (const callback of this.subscribers) {
      try {
        callback(event);
      } catch (error) {
        // Error isolation: callback errors don't break other subscribers
        console.error("[__web_sqlite] Event callback error:", error);
      }
    }
  }
}

/**
 * Initialize the global namespace object
 */
function createNamespace(): WebSqliteNamespace {
  const eventEmitter = new DatabaseEventEmitter();

  const namespace: WebSqliteNamespace = {
    // Initialize with empty databases object
    databases: {},

    onDatabaseChange(
      callback: (event: DatabaseChangeEvent) => void,
    ): () => void {
      return eventEmitter.subscribe(callback);
    },

    _updateDatabases(databases: Record<string, DBInterface>): void {
      // Clear existing keys first
      for (const key of Object.keys(this.databases)) {
        delete this.databases[key];
      }
      // Then add new keys
      Object.assign(this.databases, databases);
    },

    _emitEvent(event: DatabaseChangeEvent): void {
      eventEmitter.emit(event);
    },
  };

  return namespace;
}

/**
 * Initialize or get the existing global namespace
 */
function getOrCreateNamespace(): WebSqliteNamespace {
  const existing = (window as unknown as Record<string, unknown>)[
    NAMESPACE_PROPERTY
  ] as WebSqliteNamespace | undefined;

  if (existing) {
    return existing;
  }

  const namespace = createNamespace();

  // Define as non-enumerable property on window
  Object.defineProperty(window, NAMESPACE_PROPERTY, {
    value: namespace,
    writable: false,
    enumerable: false, // Key: Don't appear in Object.keys(window)
    configurable: false,
  });

  return namespace;
}

/**
 * Global namespace instance
 * Exported for registry integration
 */
export const globalNamespace = getOrCreateNamespace();

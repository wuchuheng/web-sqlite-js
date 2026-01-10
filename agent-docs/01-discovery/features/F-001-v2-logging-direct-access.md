# F-001: v2.0.0 - Enhanced Logging and Direct Database Access

> **Feature ID**: F-001
> **Target Version**: 2.0.0
> **Status**: Discovery
> **Created**: 2026-01-10
> **Author**: Iteration Lead (S1)

---

## 1) Feature Summary

**Purpose**: Add enhanced observability and direct global access to opened database instances for simplified cross-module communication.

**Core Features**:

1. **Structured Logging API** (`db.onLog`) - Callback-based logging with log levels and cancel function
2. **Database Lock Registry** - Prevent opening the same database name twice (multiple DIFFERENT databases allowed)
3. **Global Database Registry** - Direct access to opened DB instances via `window.__web_sqlite.databases`
4. **Database Change Events** - Subscribe to open/close events via `onDatabaseChange()`

---

## 2) User Stories

### Story 1: Enhanced Logging with Unsubscribe

**As an application developer**, I want to receive structured logs with levels and be able to unsubscribe so that I can:

- Monitor database operations dynamically
- Stop logging when no longer needed
- Build custom logging integrations with cleanup

**Acceptance Criteria**:

- `db.onLog(callback)` returns a cancel function
- Callback receives `{level, data}` signature
- Calling `cancel()` removes the listener
- Log levels: `'info' | 'debug' | 'error'`
- Independent from `debug` mode console logging

### Story 2: Prevent Duplicate Database Opens

**As an application developer**, I want to prevent accidentally opening the same database twice so that:

- Multiple different databases can be opened (e.g., "app", "users", "cache")
- The same database name cannot be opened twice (e.g., two "app" databases)
- Resource conflicts from duplicate connections are avoided

**Acceptance Criteria**:

- Opening `openDB("app")` twice throws an error
- Opening `openDB("app")` and `openDB("users")` works fine
- Error message: `"Database 'app.sqlite3' is already open"`

### Story 3: Direct Global Database Access

**As a developer**, I want to access opened databases from anywhere in the same page without imports so that:

- Different modules can share the same database instance
- No need to pass DB references around
- Browser DevTools can inspect active databases

**Acceptance Criteria**:

- `window.__web_sqlite.databases` contains direct DB instance references
- Access is direct (no RPC, no message passing overhead)
- Database instances are actual `DBInterface` objects

### Story 4: Database Change Events

**As a developer**, I want to subscribe to database open/close events so that:

- I can react when databases are opened or closed
- I can synchronize UI with database state
- DevTools can show real-time database status

**Acceptance Criteria**:

- `window.__web_sqlite.onDatabaseChange(callback)` subscribes to events
- Callback receives `{action, dbName, databases}` event
- Returns cancel function to unsubscribe

---

## 3) Functional Requirements

### FR-001: Structured Logging API with Cancel

```typescript
/**
 * Log entry with level and structured data
 */
interface LogEntry {
  /**
   * Log level: 'info' | 'debug' | 'error'
   */
  level: "info" | "debug" | "error";

  /**
   * Log data (SQL, timing, errors, events, etc.)
   */
  data: unknown;
}

interface DBInterface {
  // ... existing methods

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
}
```

**Requirements**:

- FR-001.1: `onLog(callback)` registers a callback for log events
- FR-001.2: Returns a cancel function: `() => void`
- FR-001.3: Calling `cancel()` removes the listener
- FR-001.4: Callback receives `{level, data}` object
- FR-001.5: Level values: `'info'`, `'debug'`, `'error'`
- FR-001.6: Independent from `debug` mode - both can work simultaneously
- FR-001.7: Logs include worker-level events (SQL execution, timing, errors)
- FR-001.8: Logs include application-level events (open, close, transaction results)
- FR-001.9: Multiple callbacks can be registered (each gets its own cancel function)

**Usage Example**:

```typescript
const db = await openDB("myapp");

// Register log listener
const cancelLog = db.onLog((log) => {
  console.log(`[${log.level}]`, log.data);
});

// Later: stop listening
cancelLog();

// Register another listener (multiple allowed)
const cancelLog2 = db.onLog((log) => {
  if (log.level === "error") {
    sendToErrorTracking(log.data);
  }
});
```

### FR-002: Database Lock Registry (Same Name, Not Multiple DBs)

**Requirements**:

- FR-002.1: Opening the same database name twice throws an error
- FR-002.2: Multiple DIFFERENT database names can be opened simultaneously
- FR-002.3: Error message format: `"Database '{filename}' is already open"`
- FR-002.4: Registry tracks database by normalized filename
- FR-002.5: Registry removes database on `close()`

**Examples**:

```typescript
// ✅ Allowed: Multiple different databases
const db1 = await openDB("app");
const db2 = await openDB("users");
const db3 = await openDB("cache");
console.log(Object.keys(window.__web_sqlite.databases));
// ["app.sqlite3", "users.sqlite3", "cache.sqlite3"]

// ❌ Not Allowed: Same database name twice
const db1 = await openDB("myapp");
const db2 = await openDB("myapp");
// Throws: "Database 'myapp.sqlite3' is already open"

// After closing, can open again
await db1.close();
const db3 = await openDB("myapp"); // ✅ Now works
```

### FR-003: Global Database Registry (Direct Access)

**Requirements**:

- FR-003.1: `window.__web_sqlite` is the global namespace
- FR-003.2: `window.__web_sqlite.databases` is a record of DB instances
- FR-003.3: Keys are normalized database names (e.g., `"myapp.sqlite3"`)
- FR-003.4: Values are actual `DBInterface` instances (direct references)
- FR-003.5: Registry updates on `openDB()` (adds instance)
- FR-003.6: Registry updates on `close()` (removes instance)

**Type Definition**:

```typescript
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
```

**Usage Example**:

```typescript
// Access database from anywhere (no imports needed!)
const db = window.__web_sqlite.databases["myapp.sqlite3"];
const users = await db.query("SELECT * FROM users");

// In module A:
await openDB("app");

// In module B (completely separate file, no import):
const db = window.__web_sqlite.databases["app.sqlite3"];
await db.exec("INSERT INTO users (name) VALUES (?)", ["Alice"]);

// In module C:
const db2 = window.__web_sqlite.databases["app.sqlite3"];
const users = await db2.query("SELECT * FROM users");
```

### FR-004: Database Change Events

**Requirements**:

- FR-004.1: `window.__web_sqlite.onDatabaseChange(callback)` subscribes to events
- FR-004.2: Event fires on `openDB()` success (action: `'opened'`)
- FR-004.3: Event fires on `close()` success (action: `'closed'`)
- FR-004.4: Returns cancel function to unsubscribe

**Type Definition**:

```typescript
/**
 * Event emitted when a database is opened or closed
 */
interface DatabaseChangeEvent {
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
```

**Usage Example**:

```typescript
const unsubscribe = window.__web_sqlite.onDatabaseChange((event) => {
  if (event.action === "opened") {
    console.log(`✅ Database opened: ${event.dbName}`);
    // Access the newly opened database directly
    const db = window.__web_sqlite.databases[event.dbName];
  } else {
    console.log(`❌ Database closed: ${event.dbName}`);
  }
  console.log("Current databases:", event.databases);
});

// Unsubscribe when done
// unsubscribe();
```

---

## 4) Non-Functional Requirements

### NFR-001: Performance

- NFR-001.1: `onLog` callback overhead < 0.01ms per log entry
- NFR-001.2: Registry lookup < 0.001ms per `openDB` call
- NFR-001.3: Direct DB access has zero overhead (no serialization, no message passing)
- NFR-001.4: Event dispatch overhead < 0.001ms per open/close

### NFR-002: Compatibility

- NFR-002.1: Existing v1.x API remains unchanged (backward compatible)
- NFR-002.2: New features are opt-in (no breaking changes)
- NFR-002.3: `onLog` works independently from `debug` mode
- NFR-002.4: Registry cleanup on page unload/refresh

### NFR-003: Security

- NFR-003.1: `window.__web_sqlite` namespace is non-enumerable
- NFR-003.2: No sensitive data exposed in registry (only DB instances)

### NFR-004: Reliability

- NFR-004.1: Registry survives worker termination
- NFR-004.2: `onLog` callback errors don't break database operations
- NFR-004.3: Cancel function can be called multiple times safely (idempotent)
- NFR-004.4: Database references remain valid until `close()` is called

---

## 5) Architecture Impact

### Changes to Existing Architecture

**API Contracts** (Agent Docs: `05-design/01-contracts/01-api.md`):

- **Impact**: High - New `onLog` method on `DBInterface`, new global namespace
- **New Export**: `window.__web_sqlite` global namespace
- **Changes**:
  - Add `onLog(callback: (log: LogEntry) => void): () => void` to `DBInterface`
  - Export global `__web_sqlite` interface on `window`
  - Add `LogEntry`, `DatabaseChangeEvent` types

**Worker Message Protocol** (Agent Docs: `05-design/01-contracts/02-events.md`):

- **Impact**: Moderate - Add log event streaming from worker
- **Changes**:
  - Add log data to worker responses for EXECUTE/QUERY events
  - Main thread dispatches logs to registered callbacks

**HLD - System Architecture** (Agent Docs: `03-architecture/01-hld.md`):

- **Impact**: Low - New features are additive
- **Changes**:
  - Add database registry as singleton
  - Add global namespace initialization

**Data Flow** (Agent Docs: `03-architecture/02-dataflow.md`):

- **Impact**: Moderate - New flow for log streaming and event dispatch
- **Changes**: Add sequence diagrams for log dispatch and database events

### New Components

1. **Database Registry**: Singleton tracking opened database instances
2. **Log Dispatcher**: Central logging hub that forwards logs to registered callbacks
3. **Event Emitter**: Dispatches database open/close events to subscribers
4. **Global Namespace**: Initializes `window.__web_sqlite` on library load

---

## 6) Dependencies

### Internal Dependencies

- **Worker Bridge** (`src/worker-bridge.ts`): Needs log event forwarding
- **Main Thread** (`src/main.ts`): Registry and event dispatch
- **Type Definitions** (`src/types/`): New types for `LogEntry`, `DatabaseChangeEvent`

### External Dependencies

- **None** - All features use standard Web APIs

### Cross-Feature Dependencies

- **onLog** → **Worker Bridge**: Logs must be forwarded from worker
- **Database Lock** → **Registry**: Lock implementation uses registry
- **Global Access** → **Registry**: Direct access reads from registry

---

## 7) Risks and Mitigations

| Risk                                    | Impact | Likelihood | Mitigation                                   |
| --------------------------------------- | ------ | ---------- | -------------------------------------------- |
| `onLog` callback performance overhead   | Medium | Low        | Use async dispatch, avoid blocking           |
| Registry cleanup on worker crash        | Medium | Medium     | Add cleanup handler in worker bridge         |
| Global namespace collision              | Low    | Low        | Use unique `__web_sqlite` namespace          |
| Breaking existing `debug` mode behavior | Medium | Low        | Keep features independent, add tests         |
| Database reference leak                 | Medium | Low        | Explicit cleanup on `close()`, documentation |
| Cancel function called multiple times   | Low    | Low        | Make idempotent, track subscription state    |

---

## 8) Complete Type Definitions

```typescript
/**
 * web-sqlite-js v2.0.0 Global Namespace
 * Provides direct access to opened database instances
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

/**
 * Event emitted when a database is opened or closed
 */
interface DatabaseChangeEvent {
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
 * Log entry with level and structured data
 */
interface LogEntry {
  /**
   * Log level: 'info' | 'debug' | 'error'
   */
  level: "info" | "debug" | "error";

  /**
   * Log data (SQL, timing, errors, events, etc.)
   */
  data: unknown;
}

/**
 * Database interface with all operations
 * Extends the v1.x API with onLog support
 */
interface DBInterface {
  /**
   * Execute SQL without returning rows
   * Used for DDL (CREATE, DROP, ALTER) and DML (INSERT, UPDATE, DELETE)
   *
   * @param sql - SQL string to execute
   * @param params - Optional bind parameters (positional ? or named $param)
   * @returns Promise with execution result (changes count, lastInsertRowid)
   */
  exec(sql: string, params?: SQLParams): Promise<ExecResult>;

  /**
   * Execute SELECT query and return results
   *
   * @template T - Type of result rows (inferred from usage)
   * @param sql - SELECT SQL to execute
   * @param params - Optional bind parameters (positional ? or named $param)
   * @returns Promise with array of result rows
   */
  query<T = unknown>(sql: string, params?: SQLParams): Promise<T[]>;

  /**
   * Run operations in a transaction
   * Automatically COMMIT on success, ROLLBACK on error
   *
   * @template T - Return type of transaction callback
   * @param fn - Transaction callback with exec and query methods
   * @returns Promise with callback result
   */
  transaction<T>(
    fn: (tx: Pick<DBInterface, "exec" | "query">) => Promise<T>,
  ): Promise<T>;

  /**
   * Close the database and release resources
   * Removes database from global registry
   *
   * @returns Promise that resolves when database is closed
   */
  close(): Promise<void>;

  /**
   * Subscribe to log events
   * Logs include SQL execution, timing, errors, and application events
   *
   * @param callback - Called for each log entry
   * @returns Unsubscribe function
   */
  onLog(callback: (log: LogEntry) => void): () => void;

  /**
   * Dev tooling for release management
   */
  devTool: DevTool;
}

/**
 * Result of SQL execution (INSERT, UPDATE, DELETE, CREATE, etc.)
 */
interface ExecResult {
  /**
   * Number of rows affected by the operation
   */
  changes?: number | bigint;

  /**
   * Last inserted row ID (for INSERT operations)
   */
  lastInsertRowid?: number | bigint;
}

/**
 * SQL bind parameters (positional or named)
 */
type SQLParams = SqlValue[] | Record<string, SqlValue>;

/**
 * Supported SQL value types for bind parameters
 */
type SqlValue =
  | null
  | number
  | string
  | boolean
  | bigint
  | Uint8Array
  | ArrayBuffer;

/**
 * Dev tooling interface for release management
 */
interface DevTool {
  /**
   * Create a new dev version for testing
   *
   * @param input - Release configuration with version, migration, and seed SQL
   */
  release(input: ReleaseConfig): Promise<void>;

  /**
   * Rollback to a target version
   *
   * @param version - Target version to rollback to
   */
  rollback(version: string): Promise<void>;
}

/**
 * Release configuration for migrations
 */
interface ReleaseConfig {
  /**
   * Semantic version string (e.g., "1.0.0")
   */
  version: string;

  /**
   * Migration SQL to apply for this version
   */
  migrationSQL: string;

  /**
   * Optional seed SQL to apply after migration
   */
  seedSQL?: string | null;
}
```

---

## 9) Success Criteria

### Functional Acceptance

- **SC1**: `db.onLog(callback)` returns a cancel function
- **SC2**: Calling `cancel()` removes the listener
- **SC3**: Multiple different databases can be opened simultaneously
- **SC4**: Opening same database name twice throws error
- **SC5**: `window.__web_sqlite.databases` contains direct DB instances
- **SC6**: `window.__web_sqlite.onDatabaseChange()` receives events
- **SC7**: Database instances are accessible from anywhere (no imports)
- **SC8**: Direct DB calls work without any overhead

### Technical Acceptance

- **SC9**: E2E tests pass for all new features
- **SC10**: Existing v1.x tests pass (backward compatibility)
- **SC11**: TypeScript types compile without errors
- **SC12**: Performance benchmarks meet NFR requirements

### Documentation Acceptance

- **SC13**: API documentation updated with JSDoc comments
- **SC14**: Usage examples provided for all new features
- **SC15**: Migration guide from v1.x to v2.0 provided

---

## 10) Implementation Notes

### Suggested Implementation Order

1. **Phase 1**: Database Registry and Lock (foundational)
   - Add singleton registry for tracking opened databases
   - Implement lock check in `openDB()`
   - Initialize `window.__web_sqlite` namespace
   - Update `databases` record on `openDB()` and `close()`

2. **Phase 2**: Structured Logging API
   - Add `onLog` method to `DBInterface`
   - Implement log dispatcher in main thread
   - Add log event generation to worker responses
   - Implement cancel function

3. **Phase 3**: Database Change Events
   - Implement `onDatabaseChange()` subscription
   - Dispatch events on `openDB()` and `close()`

### Files to Modify

**New Files**:

- `src/registry/database-registry.ts` - Database instance registry singleton
- `src/events/database-event-emitter.ts` - Event emitter for open/close events
- `src/logs/log-dispatcher.ts` - Log dispatcher for callbacks
- `src/global/initialize-namespace.ts` - Initialize `window.__web_sqlite`

**Modified Files**:

- `src/types/DB.ts` - Add `onLog` method, `LogEntry` type
- `src/types/global.ts` - Add global type definitions
- `src/main.ts` - Add registry initialization, event dispatch
- `src/worker-bridge.ts` - Add log forwarding
- `src/worker.ts` - Add log data to responses

**Test Files**:

- `tests/e2e/on-log.e2e.test.ts` - Log callback tests
- `tests/e2e/database-lock.e2e.test.ts` - Registry and lock tests
- `tests/e2e/global-access.e2e.test.ts` - Global namespace tests
- `tests/e2e/database-events.e2e.test.ts` - Event subscription tests

---

## Navigation

**Back to**: [Discovery Index](../) - All discovery documents

**Related Documents**:

- [02 Requirements](../02-requirements.md) - MVP requirements and backlog
- [01 API Contracts](../../05-design/01-contracts/01-api.md) - Public API specifications
- [02 Event Catalog](../../05-design/01-contracts/02-events.md) - Worker message protocol

**Next Steps**:

1. **S3 (System Architect)**: Review and validate architecture impact
2. **S5 (Contract Designer)**: Define detailed API contracts for new features
3. **S7 (Task Manager)**: Break down into implementation tasks

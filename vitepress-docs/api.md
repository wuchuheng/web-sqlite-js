---
outline: deep
---

# API Reference

## `openDB(filename, options?)`

Opens a database connection (stored in OPFS) and returns a Promise resolving to a `DBInterface`.

```ts
import openDB from "web-sqlite-js";

const db = await openDB("my-database", { debug: false });
```

### `filename: string`

If the filename does not end with `.sqlite3`, the extension is appended automatically.

### `options?: { releases?: ReleaseConfig[]; debug?: boolean }`

- `releases`: Immutable release history used for versioned migrations.
- `debug`: Enables worker-side SQL timing logs via `console.debug`.

### `ReleaseConfig`

```ts
type ReleaseConfig = {
  version: string;
  migrationSQL: string;
  seedSQL?: string | null;
};
```

- `version` must match `x.x.x` with no leading zeros.
- `default` is reserved and cannot be used.

## `DBInterface`

The object returned by `openDB()`:

### `db.exec(sql, params?)`

Executes a SQL statement (or script) without returning rows.

```ts
const result = await db.exec("INSERT INTO users (name) VALUES (?)", ["Alice"]);
// result: { changes?: number | bigint; lastInsertRowid?: number | bigint }
```

### `db.query<T>(sql, params?)`

Executes a `SELECT` query and returns all rows as an array of objects.

```ts
type User = { id: number; name: string };
const users = await db.query<User>("SELECT id, name FROM users");
```

### `db.transaction(fn)`

Runs `fn` inside a transaction (`BEGIN` / `COMMIT`), and rolls back on error.

```ts
await db.transaction(async (tx) => {
  await tx.exec("INSERT INTO users (name) VALUES (?)", ["Alice"]);
  const rows = await tx.query<{ count: number }>(
    "SELECT COUNT(*) as count FROM users",
  );
  return rows[0]?.count ?? 0;
});
```

### `db.close()`

Closes the database connection.

```ts
await db.close();
```

### `db.onLog(callback)`

Subscribe to structured log events from database operations. Returns an unsubscribe function.

```ts
const unsubscribe = db.onLog((log) => {
  console.log(`[${log.level}]`, log.data);
});

// Later: unsubscribe();
```

**Log Entry Format:**

```ts
interface LogEntry {
  level: "info" | "debug" | "error";
  data: unknown;
}
```

**Examples of log data:**

- SQL execution: `{sql: "SELECT * FROM users", duration: 0.28, bind: []}`
- Transaction: `{action: "commit", sql: "COMMIT"}`
- Error: `{error: "SQLITE_CONSTRAINT: UNIQUE constraint failed", sql: "..."}`
- Application: `{action: "open", dbName: "myapp.sqlite3"}`

### `db.devTool`

Dev-only helpers for testing releases locally.

#### `db.devTool.release(config)`

Creates a new dev version and switches the active DB to it.

```ts
await db.devTool.release({
  version: "0.0.2",
  migrationSQL: "ALTER TABLE users ADD COLUMN role TEXT;",
});
```

#### `db.devTool.rollback(version)`

Rolls back to a target version by removing dev versions above it.

```ts
await db.devTool.rollback("0.0.1");
```

## SQL parameters

Both `exec()` and `query()` accept:

- Positional parameters: `SqlValue[]`
- Named parameters: `Record<string, SqlValue>`

Supported `SqlValue` types:

- `null`, `number`, `string`, `boolean`, `bigint`
- `Uint8Array`, `ArrayBuffer`

## Errors

All methods reject with an `Error` coming from the worker, including `name`, `message`, and `stack` when available.

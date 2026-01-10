# Observability Guide

**Project**: web-sqlite-js
**Version**: 1.1.2
**Last Updated**: 2025-01-09
**Status**: Production

---

## Overview

This guide defines the **logging, debugging, and monitoring** standards for the web-sqlite-js project. All contributors MUST follow these standards to ensure visibility into system behavior.

### Observability Pillars

1. **Logs**: Structured logging with debug mode
2. **Metrics**: Query timing, operation counts
3. **Traces**: Worker message flow tracking

---

## 1. Debug Mode

### 1.1 Enabling Debug Mode

**API Usage**:

```typescript
import { openDB } from "web-sqlite-js";

const db = await openDB("mydb", {
  releases: [...],
  debug: true  // Enable debug logging
});
```

**What Gets Logged**:

- Database initialization steps
- Release migration application
- SQL queries with syntax highlighting
- Query execution timing
- Worker message protocol
- Dev tool operations (release, rollback)

### 1.2 Debug Output Format

**Console Logging**:

```typescript
// Source: src/utils/logger.ts
export const configureLogger = (isDebug: boolean) => {
  if (isDebug) {
    console.debug = (...args: unknown[]) => {
      const badgeText = "Debug";
      const badgeStyle =
        "background: #1976d2; color: white; padding: 2px 4px; border-radius: 4px; font-weight: bold;";

      // Format SQL queries with syntax highlighting
      if (isSqlLogInfo(firstArg)) {
        const { sql, duration, bind } = firstArg;
        // Highlight SQL keywords
        // ...
      }

      originalInfo.apply(console, [formatString, ...logArgs]);
    };
  } else {
    console.debug = originalDebug;
  }
};
```

**Output Example**:

```
Debug: [openDB] input validation start
Debug: [openDB] normalized filename: mydb
Debug: [openDB] ensured directory: mydb
Debug:sql SELECT name FROM sqlite_master WHERE type='table' (0.25ms)
Debug: [release] apply start 1.0.0 (release)
Debug:sql CREATE TABLE users (id INTEGER PRIMARY KEY) (0.18ms)
Debug: [release] apply end 1.0.0 (release)
```

---

## 2. Logging Standards

### 2.1 Log Levels

| Level     | Purpose                          | Example                                  |
| --------- | -------------------------------- | ---------------------------------------- |
| **debug** | Detailed diagnostic info         | `[openDB] input validation start`        |
| **info**  | General operational info         | `sql SELECT * FROM users (0.25ms)`       |
| **warn**  | Warning messages (not errors)    | `[release] version 1.0.0 already exists` |
| **error** | Error messages with stack traces | `Error: migrationSQL hash mismatch`      |

### 2.2 Log Format

**Structured Logs**:

```typescript
// Database initialization
console.debug(`[openDB] input validation start`);
console.debug(`[openDB] normalized filename: ${normalizedFilename}`);
console.debug(`[openDB] ensured directory: ${normalizedFilename}`);

// Release operations
console.debug(`[release] apply start ${config.version} (${mode})`);
console.debug(`[release] lock acquired`);
console.debug(`[release] apply end ${config.version} (${mode})`);

// Dev tool operations
console.debug(`[devTool.release] start ${input.version}`);
console.debug(`[devTool.rollback] start ${version}`);
```

**SQL Query Logs**:

```typescript
interface SqlLogInfo {
  sql: string;
  duration: number;
  bind?: unknown;
}

// Example:
console.info({
  sql: "SELECT * FROM users WHERE id = ?",
  duration: 0.25,
  bind: [1],
});
```

**Output**:

```
Debug:sql SELECT * FROM users WHERE id = ? [1] (0.25ms)
```

### 2.3 SQL Syntax Highlighting

**Keywords Highlighted**:

```typescript
const sqlKeywords = new Set([
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "FROM",
  "WHERE",
  "AND",
  "OR",
  "LIMIT",
  "ORDER",
  "BY",
  "GROUP",
  "VALUES",
  "SET",
  "INTO",
  "CREATE",
  "TABLE",
  "DROP",
  "ALTER",
  // ... more keywords
]);
```

**Visual Output**:

```
Debug:sql SELECT * FROM users WHERE id = ? (0.25ms)
        ^^^^^^  ^^^    ^^^^^   ^^^   ^^
        Purple  Gray   Purple  Gray Gray
        (Bold)         (Bold)
```

---

## 3. Worker Message Logging

### 3.1 Message Protocol

**Worker Messages** (when debug enabled):

```typescript
// Main thread -> Worker
{
  event: "OPEN",
  filename: "mydb/release.sqlite3",
  target: "meta"
}

// Worker -> Main thread
{
  event: "OPEN_SUCCESS",
  result: undefined
}
```

### 3.2 Worker-Side Logging

**Query Timing**:

```typescript
// Source: src/worker.ts
const startTime = performance.now();
const result = db.exec(sql);
const duration = performance.now() - startTime;

if (options?.debug) {
  console.info({
    sql,
    duration,
    bind: params,
  } as SqlLogInfo);
}
```

**Example Output**:

```
Debug:sql CREATE TABLE users (id INTEGER PRIMARY KEY) (0.18ms)
Debug:sql INSERT INTO users VALUES (1, 'Alice') (0.22ms)
Debug:sql SELECT * FROM users (0.15ms)
```

---

## 4. Metrics

### 4.1 Operation Timing

**Measured Operations**:

| Operation       | Metric     | Target           |
| --------------- | ---------- | ---------------- |
| Database Load   | Time       | <100ms (50MB DB) |
| Query Execution | Time       | 0.2-0.5ms        |
| Transaction     | Throughput | 1000+/sec        |
| Worker Message  | Roundtrip  | <1ms             |

### 4.2 Performance Tracking

**Query Timing**:

```typescript
const startTime = performance.now();
const result = await db.query(sql, params);
const duration = performance.now() - startTime;

if (debug) {
  console.info({ sql, duration, bind: params });
}
```

**Transaction Timing**:

```typescript
const txStart = performance.now();
await db.transaction(async (tx) => {
  // ... transaction logic
});
const txDuration = performance.now() - txStart;

console.debug(`Transaction completed in ${txDuration.toFixed(2)}ms`);
```

### 4.3 Performance Benchmarks

**Database Load**:

```typescript
console.time("dbLoad");
const db = await openDB("mydb", { releases: [...] });
console.timeEnd("dbLoad");
// Output: dbLoad: 87.45ms
```

**Query Performance**:

```typescript
console.time("query");
const result = await db.query("SELECT * FROM users");
console.timeEnd("query");
// Output: query: 0.25ms
```

---

## 5. Error Tracking

### 5.1 Error Categories

| Category           | Example                              | Log Level |
| ------------------ | ------------------------------------ | --------- |
| **Initialization** | Invalid filename, missing releases   | error     |
| **SQL Execution**  | Syntax errors, constraint violations | error     |
| **Release**        | Hash mismatch, version conflicts     | error     |
| **OPFS**           | Quota exceeded, file not found       | error     |
| **Transaction**    | Lock timeout, deadlock               | error     |
| **Worker**         | Message timeout, worker crash        | error     |

### 5.2 Error Logging

**Stack Trace Preservation**:

```typescript
// Source: src/worker-bridge.ts
try {
  const result = await sendMsg(...);
  return result;
} catch (error) {
  // Reconstruct error with stack trace
  const newError = new Error(error.message);
  newError.stack = error.stack;
  throw newError;
}
```

**Error Output**:

```
Error: migrationSQL hash mismatch for 1.0.0
    at openReleaseDB (src/release/release-manager.ts:169)
    at openDB (src/main.ts:26)
    at main (src/index.ts:10)
```

### 5.3 Error Context

**Structured Error Data**:

```typescript
interface ErrorContext {
  code: string;
  message: string;
  details?: unknown;
  stack?: string;
}

throw new Error(
  JSON.stringify({
    code: "MIGRATION_HASH_MISMATCH",
    message: "migrationSQL hash mismatch for 1.0.0",
    details: {
      version: "1.0.0",
      expected: "abc123",
      actual: "def456",
    },
  } as ErrorContext),
);
```

---

## 6. Debugging Tools

### 6.1 Browser DevTools

**Access**: Press F12 or Right-click -> Inspect

**Useful Tabs**:

- **Console**: View debug logs
- **Network**: Monitor worker messages
- **Application**: Inspect OPFS storage
- **Performance**: Profile query execution

### 6.2 OPFS Inspector

**View OPFS Contents**:

```typescript
const root = await navigator.storage.getDirectory();
const dirHandle = await root.getDirectoryHandle("mydb");

for await (const entry of dirHandle.values()) {
  console.log(entry.name, entry.kind);
}
```

**Output**:

```
release.sqlite3 file
default.sqlite3 file
1.0.0 directory
1.1.0 directory
```

### 6.3 Database Inspector

**SQLite Console** (in worker):

```typescript
// Add temporary debugging
db.exec("SELECT * FROM release");
db.exec("PRAGMA database_list");
db.exec("PRAGMA table_list");
```

---

## 7. Production Monitoring

### 7.1 Log Aggregation

**Recommended**: External service (Sentry, LogRocket)

**Integration Example**:

```typescript
import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "YOUR_DSN",
  environment: process.env.NODE_ENV,
});

// Capture errors
try {
  await db.query(sql);
} catch (error) {
  Sentry.captureException(error);
  throw error;
}
```

### 7.2 Performance Monitoring

**Web Vitals**:

```typescript
import { getCLS, getFID, getFCP, getLCP, getTTFB } from "web-vitals";

getCLS(console.log);
getFID(console.log);
getFCP(console.log);
getLCP(console.log);
getTTFB(console.log);
```

**Custom Metrics**:

```typescript
// Track query performance
const queryTimings: number[] = [];

const originalQuery = db.query.bind(db);
db.query = async (sql, params) => {
  const start = performance.now();
  const result = await originalQuery(sql, params);
  const duration = performance.now() - start;

  queryTimings.push(duration);
  return result;
};

// Report metrics
const avgQueryTime = queryTimings.reduce((a, b) => a + b) / queryTimings.length;
console.log(`Average query time: ${avgQueryTime.toFixed(2)}ms`);
```

---

## 8. Troubleshooting

### 8.1 Common Issues

**Issue**: Debug logs not appearing

**Solution**:

```typescript
// Ensure debug mode is enabled
const db = await openDB("mydb", {
  releases: [...],
  debug: true,  // Check this is true
});
```

**Issue**: Worker messages not logged

**Solution**:

```typescript
// Check worker console (separate context)
// Open DevTools -> Worker -> Console
```

**Issue**: OPFS not accessible

**Solution**:

```typescript
// Check OPFS availability
if (!navigator.storage?.getDirectory) {
  console.error("OPFS not supported in this browser");
}
```

### 8.2 Debug Checklist

Before reporting issues, verify:

- [ ] Debug mode enabled
- [ ] Console logs reviewed
- [ ] Worker console checked
- [ ] OPFS contents inspected
- [ ] Browser compatibility verified
- [ ] COOP/COEP headers set

---

## 9. Best Practices

### 9.1 Logging Guidelines

**DO**:

- Log at appropriate levels (debug, info, warn, error)
- Include context in error messages
- Use structured log formats
- Log timing for performance-critical operations

**DON'T**:

- Log sensitive data (passwords, tokens)
- Log excessive output in production
- Use `console.log` (use `console.debug` for debug info)
- Log in tight loops (avoid performance impact)

### 9.2 Performance Considerations

**Debug Mode Overhead**:

- Query timing: ~0.01ms overhead
- Log formatting: ~0.05ms per log
- SQL syntax highlighting: ~0.1ms per query

**Recommendation**: Disable debug mode in production

```typescript
const db = await openDB("mydb", {
  releases: [...],
  debug: process.env.NODE_ENV === "development",
});
```

---

## 10. References

### Internal Documentation

- [Build and Run Guide](./01-build-and-run.md) - Development workflow
- [Test Plan](./02-test-plan.md) - Testing strategy
- [Error Standards](../05-design/01-contracts/03-errors.md) - Error handling

### External Resources

- [Chrome DevTools](https://developer.chrome.com/agent-docs/devtools/)
- [OPFS Specification](https://fs.spec.whatwg.org/)
- [Web Workers API](https://developer.mozilla.org/en-US/agent-docs/Web/API/Web_Workers_API)

---

## Navigation

**Previous**: [Test Plan](./02-test-plan.md)

**Next**: [Release and Rollback Guide](./04-release-and-rollback.md)

**Up**: [Specification Index](../00-control/00-spec.md)

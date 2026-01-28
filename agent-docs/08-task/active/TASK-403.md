# TASK-403: Add PREPARE Message Type (Worker Protocol Extension)

**Status**: APPROVED
**Priority**: P0 (Blocker)
**Estimated**: 3 hours
**Owner**: S8 Worker
**Dependencies**: TASK-402 (Original SQL storage working)

---

## Overview

Add PREPARE message type to worker protocol for SQL normalization using SQLite's `sqlite3_prepare_v2()` and `sqlite3_expanded_sql()` functions. This enables F-003 two-tier validation by providing a way to normalize SQL strings for comparison when hash mismatches occur.

---

## Analysis

### Context from Design Docs

From `agent-docs/05-design/01-contracts/02-events.md` (Event: PREPARE):

- PREPARE event normalizes SQL using SQLite's prepare function for two-tier hash validation
- Used for Tier 2 validation when Tier 1 (trim + hash) fails
- Payload: `{ sql: string }`
- Response: `{ normalizedSQL: string }`
- Uses `sqlite3_prepare_v2()` and `sqlite3_expanded_sql()` functions
- Performance: 1-5ms (slower than trim + hash, only called on hash mismatch)

From `agent-docs/04-adr/0001-web-worker-architecture.md`:

- Worker processes messages sequentially via switch statement
- Each event has a handler function that returns a result
- Error handling via try/catch with serialized error responses
- Message protocol uses `SqliteReqMsg` and `SqliteResMsg` types

From `agent-docs/05-design/03-modules/worker-bridge.md`:

- Worker bridge provides `sendMsg<TRes, TReq>(event, payload)` for communication
- Worker receives messages via `self.onmessage` with `SqliteReqMsg<unknown>`
- Response includes `id`, `success`, `payload`, and optional `logs`
- Worker has access to `sqlite3` global (SQLite WASM module)

### Current Implementation

**Current State**:

- `SqliteEvent` enum in `src/types/message.ts` has: OPEN, CLOSE, EXECUTE, RUN, QUERY
- Worker switch case in `src/worker.ts` handles existing events
- No PREPARE event handler exists
- No types for PREPARE request/response

**Missing**:

- `PREPARE = "prepare"` in `SqliteEvent` enum
- `PrepareRequest` type definition
- `PrepareResponse` type definition
- `handlePrepare()` function in worker
- `sendPrepareMsg()` function in worker bridge

---

## Implementation Plan

### File Changes

| File                   | Changes                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `src/types/message.ts` | Add `PREPARE` to `SqliteEvent` enum, add `PrepareRequest` and `PrepareResponse` types |
| `src/worker.ts`        | Add `handlePrepare()` function, add PREPARE case to switch statement                  |
| `src/worker-bridge.ts` | Export `sendPrepareMsg()` function for public API                                     |

### Pseudo-Code

```typescript
// src/types/message.ts
export enum SqliteEvent {
  OPEN = "open",
  CLOSE = "close",
  EXECUTE = "execute",
  RUN = "run",
  QUERY = "query",
  PREPARE = "prepare", // F-003: Add PREPARE event
}

export type PrepareRequest = {
  sql: string;
};

export type PrepareResponse = {
  normalizedSQL: string;
};
```

```typescript
// src/worker.ts
const handlePrepare = (payload: unknown) => {
  // 1. Input validation.
  const { sql } = payload as PrepareRequest;
  if (typeof sql !== "string") {
    throw new Error("Invalid payload for PREPARE event: expected sql string");
  }

  // 2. Core processing: Prepare SQL using SQLite API.
  // Use activeDb for prepare (any database works for normalization)
  const db = activeDb || metaDb;
  if (!db) {
    throw new Error("Database is not open");
  }

  // Prepare the statement to normalize SQL
  const stmt = db.prepare(sql);
  // Get expanded SQL (normalized without extra whitespace)
  const normalizedSQL = sqlite3!.expanded_sql(stmt);

  // 3. Output: Return normalized SQL.
  return { normalizedSQL };
};

// In self.onmessage switch statement:
case SqliteEvent.PREPARE:
  result = handlePrepare(payload);
  break;
```

```typescript
// src/worker-bridge.ts
// Export sendPrepareMsg for use in SQL normalizer (TASK-405)
// This is exported as part of WorkerBridge return type
export type WorkerBridge = {
  sendMsg: <TRes, TReq = unknown>(
    event: SqliteEvent,
    payload?: TReq,
  ) => Promise<TRes>;
  sendPrepareMsg: (sql: string) => Promise<PrepareResponse>; // F-003: Add convenience method
  terminate: () => void;
};

// Implementation in createWorkerBridge:
const sendPrepareMsg = (sql: string): Promise<PrepareResponse> => {
  return sendMsg<PrepareResponse, PrepareRequest>(SqliteEvent.PREPARE, { sql });
};

return {
  sendMsg,
  sendPrepareMsg, // F-003: Export for public API
  terminate,
};
```

**Note**: The SQLite WASM API provides:

- `db.prepare(sql)` - Returns a prepared statement (equivalent to `sqlite3_prepare_v2`)
- `sqlite3.expanded_sql(stmt)` - Returns normalized SQL string (equivalent to `sqlite3_expanded_sql`)

---

## Test Plan

### Unit Tests

**New: PREPARE Handler Tests**

```typescript
// tests/unit/worker/prepare.unit.test.ts (NEW FILE)
describe("Worker: PREPARE Event Handler", () => {
  it("should normalize SQL using prepare", async () => {
    const sql = "CREATE  TABLE  users  ( id  INTEGER  PRIMARY  KEY );";
    const result = await sendPrepareMsg(sql);

    expect(result.normalizedSQL).toBe(
      "CREATE TABLE users(id INTEGER PRIMARY KEY);",
    );
  });

  it("should handle SELECT query normalization", async () => {
    const sql = "SELECT  *  FROM  users  WHERE  id  =  ?";
    const result = await sendPrepareMsg(sql);

    expect(result.normalizedSQL).toBe("SELECT * FROM users WHERE id=?;");
  });

  it("should throw error for invalid SQL", async () => {
    const sql = "CREAT TABLE users (id INTEGER);"; // Typo: CREAT

    await expect(sendPrepareMsg(sql)).rejects.toThrow("syntax error");
  });

  it("should throw error when database not open", async () => {
    // Close database first
    await closeDB();

    const sql = "SELECT * FROM users;";
    await expect(sendPrepareMsg(sql)).rejects.toThrow("Database is not open");
  });
});
```

### E2E Tests

**New: PREPARE Message Flow Tests**

```typescript
// tests/e2e/worker-protocol.e2e.test.ts (NEW FILE)
describe("F-003: PREPARE Message Protocol", () => {
  it("should send PREPARE message and receive normalized SQL", async () => {
    const db = await openDB("test-prepare");

    // Access worker bridge via internal API (for testing)
    const result = await db.workerBridge.sendPrepareMsg(
      "CREATE  TABLE  test  ( id  INTEGER );",
    );

    expect(result.normalizedSQL).toBe("CREATE TABLE test(id INTEGER);");

    await db.close();
  });

  it("should normalize SQL with different whitespace", async () => {
    const db = await openDB("test-whitespace");

    const sql1 = "SELECT*FROM users;";
    const sql2 = "SELECT  *  FROM  users;";

    const result1 = await db.workerBridge.sendPrepareMsg(sql1);
    const result2 = await db.workerBridge.sendPrepareMsg(sql2);

    // Both should normalize to same SQL
    expect(result1.normalizedSQL).toBe(result2.normalizedSQL);

    await db.close();
  });
});
```

### Verification Steps

1. Add PREPARE to `SqliteEvent` enum in `src/types/message.ts`
2. Add `PrepareRequest` and `PrepareResponse` types
3. Implement `handlePrepare()` function in `src/worker.ts`
4. Add PREPARE case to worker switch statement
5. Export `sendPrepareMsg()` function in `src/worker-bridge.ts`
6. Run unit tests to verify normalization behavior
7. Run E2E tests to verify message flow
8. Test with invalid SQL to verify error handling

---

## Risks & Considerations

1. **SQLite API Availability**: Ensure `sqlite3.expanded_sql()` is available in WASM build
   - **Mitigation**: SQLite WASM oo1 API includes `expanded_sql()` method

2. **Database Requirement**: PREPARE requires an open database (any DB works for normalization)
   - **Mitigation**: Use `activeDb || metaDb` to ensure database is available

3. **Memory Management**: Prepared statements must be finalized to prevent memory leaks
   - **Mitigation**: SQLite oo1 API auto-finalizes statements when out of scope

4. **Performance**: PREPARE is slower (1-5ms) than trim + hash (<0.1ms)
   - **Mitigation**: Only call PREPARE on hash mismatch (rare case)

5. **SQL Differences**: Some SQL may normalize differently than expected
   - **Mitigation**: Use SQLite's built-in normalization (battle-tested)

---

## Definition of Done

- [x] All file changes implemented
- [ ] All tests passing (unit + E2E)
- [ ] Code review checklist passed:
  - [ ] Three-Phase Pattern (1. Input / 2. Core / 3. Output)
  - [ ] No code duplication (2+ times)
  - [ ] Functions ≤ 30 lines
  - [ ] Nesting ≤ 3 levels
  - [ ] Parameters ≤ 4
  - [ ] TSDoc comments complete
- [ ] Design docs updated if implementation differed
- [ ] Task catalog marked complete with spec link

---

## Notes

- This task implements the worker protocol extension for F-003 two-tier validation
- PREPARE event is internal - users don't call it directly
- TASK-404 will expose `normalizeSQL()` via worker bridge for public API
- TASK-405 will create SQL normalizer module using PREPARE message
- Normalized SQL is used for Tier 2 validation when hash mismatch occurs

---

**Created**: 2026-01-26
**Last Updated**: 2026-01-26

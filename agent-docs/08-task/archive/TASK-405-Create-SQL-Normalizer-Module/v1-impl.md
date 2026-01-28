# TASK-405: Create SQL Normalizer Module

**Status**: COMPLETED
**Priority**: P0 (Blocker)
**Estimated**: 2 hours
**Owner**: S8 Worker
**Dependencies**: TASK-404 (normalizeSQL() exported from worker-bridge.ts)

---

## Overview

Create `src/release/sql-normalizer.ts` module that provides a high-level wrapper around the `normalizeSQL()` function from worker-bridge.ts. This module will be used by the two-tier hash validation system (TASK-406) to normalize SQL via SQLite's `prepare()` function when Tier 1 hash mismatch occurs.

---

## Analysis

### Context from Design Docs

From `agent-docs/01-discovery/features/F-003-sql-normalization-validation.md`:

- **FR-001.9**: Two-tier validation uses SQLite's `prepare()` function to normalize SQL strings
- **Performance**: Tier 2 (prepare normalization) takes 1-5ms, only invoked on hash mismatch
- **Usage**: Normalized SQL used for semantic comparison when trim + hash fails

From `agent-docs/03-architecture/01-hld.md`:

- **SQL Normalizer**: TypeScript + SQLite WASM component for normalizing SQL via SQLite `prepare()`
- **Two-Tier Hash Validator**: Fast path (trim + hash < 0.1ms) and slow path (prepare normalization 1-5ms)

From `agent-docs/05-design/03-modules/release-management.md`:

- **Operation: F-003 Two-Tier Validation** section describes the normalizeSQL function
- Located in `src/release/hash-utils-two-tier.ts` (F-003)
- Takes `sql: string` and `sendMsg: SendMsgFunction` parameters

From TASK-404 (completed):

- `normalizeSQL()` function already exported from `src/worker-bridge.ts`
- Takes `sql: string` and `workerBridge: WorkerBridge` parameters
- Returns `Promise<string>` with normalized SQL
- Complete TSDoc with F-003 usage examples

### Current State

**TASK-404 Implementation** (`src/worker-bridge.ts`):

```typescript
export const normalizeSQL = async (
  sql: string,
  workerBridge: WorkerBridge,
): Promise<string> => {
  // 1. Input validation
  if (typeof sql !== "string") {
    throw new Error("SQL must be a string");
  }

  // 2. Core processing: Send PREPARE message to worker
  const response = await workerBridge.sendPrepareMsg(sql);

  // 3. Output: Return normalized SQL string
  return response.normalizedSQL;
};
```

**Missing**:

- `src/release/sql-normalizer.ts` module that wraps `normalizeSQL()` for release management context
- `normalizeSQLViaPrepare()` function for two-tier validation
- Edge case handling (empty SQL, null/undefined, whitespace-only)
- Unit tests for normalization edge cases

### Module Purpose

The `sql-normalizer.ts` module serves as the release management layer's interface to SQL normalization. It:

1. Wraps `normalizeSQL()` from worker-bridge.ts
2. Handles edge cases specific to release validation
3. Provides clear API for two-tier validation (TASK-406)
4. Includes comprehensive TSDoc with F-003 context

---

## Implementation

### File Changes

| File                            | Changes                                                  |
| ------------------------------- | -------------------------------------------------------- |
| `src/release/sql-normalizer.ts` | Create new module with `normalizeSQLViaPrepare()` export |

### Implementation Details

**Created `src/release/sql-normalizer.ts`**:

````typescript
/**
 * SQL Normalizer Module (F-003)
 *
 * Provides SQL normalization via SQLite's prepare() function for two-tier validation.
 * This module wraps the worker bridge's normalizeSQL() function for release management.
 */

import { normalizeSQL } from "../worker-bridge";
import type { WorkerBridge } from "../worker-bridge";

/**
 * Normalizes SQL using SQLite prepare (F-003 Tier 2 validation).
 *
 * This function normalizes a SQL string using SQLite's prepare mechanism,
 * which removes extra whitespace, standardizes keyword casing, removes comments,
 * and optimizes the SQL structure. Used in Tier 2 validation when hash mismatch occurs.
 *
 * @example
 * ```typescript
 * import { normalizeSQLViaPrepare } from "web-sqlite-js/release/sql-normalizer";
 *
 * // Two-tier validation pattern (F-003)
 * // Tier 1: Fast trim + hash compare
 * const trimmedOriginal = originalSQL.trim();
 * const trimmedCurrent = currentSQL.trim();
 * const hashOriginal = await hashSQL(trimmedOriginal);
 * const hashCurrent = await hashSQL(trimmedCurrent);
 *
 * if (hashCurrent === storedHash) {
 *   // Fast pass - validation succeeds
 * } else {
 *   // Tier 2: Slow prepare normalization
 *   const normalizedOriginal = await normalizeSQLViaPrepare(
 *     trimmedOriginal,
 *     workerBridge
 *   );
 *   const normalizedCurrent = await normalizeSQLViaPrepare(
 *     trimmedCurrent,
 *     workerBridge
 *   );
 *
 *   if (normalizedOriginal === normalizedCurrent) {
 *     // Whitespace-only difference - auto-update hash
 *     await updateHash(version, hashCurrent, sqlType);
 *   } else {
 *     // Actual SQL change - throw error
 *     throw new HashMismatchError({
 *       version,
 *       sqlType,
 *       originalSQL: truncate(currentSQL, 200),
 *       currentSQL: truncate(originalSQL, 200),
 *     });
 *   }
 * }
 * ```
 *
 * @param sql - The SQL string to normalize.
 * @param workerBridge - The worker bridge instance for communication.
 * @returns A promise that resolves with the normalized SQL string.
 * @throws {Error} If SQL is invalid or database is not open.
 *
 * @remarks
 * **Performance**: 1-5ms (slower than trim + hash, only use on mismatch)
 *
 * **Normalization Rules** (via SQLite prepare):
 * - Removes extra whitespace
 * - Standardizes keyword casing
 * - Removes SQL comments
 * - Optimizes SQL structure
 *
 * **Usage**: Only call in Tier 2 validation when Tier 1 hash mismatch occurs.
 * Requires an open database connection (any database works for normalization).
 *
 * **F-003 Context**: This is part of the two-tier SQL validation system for
 * enhanced hash mismatch detection. See F-003 feature documentation for details.
 *
 * **Edge Cases**:
 * - Empty string: Returns empty string
 * - Whitespace-only: Returns empty string
 * - Null/undefined: Throws error
 * - Invalid SQL: Propagates SQLite error from worker
 */
export const normalizeSQLViaPrepare = async (
  sql: string,
  workerBridge: WorkerBridge,
): Promise<string> => {
  // 1. Input validation
  if (sql == null) {
    throw new Error("SQL cannot be null or undefined");
  }
  if (typeof sql !== "string") {
    throw new Error("SQL must be a string");
  }

  // 2. Edge case: Empty or whitespace-only SQL
  const trimmed = sql.trim();
  if (trimmed === "") {
    return "";
  }

  // 3. Core processing: Normalize via worker bridge
  const normalized = await normalizeSQL(trimmed, workerBridge);

  // 4. Output: Return normalized SQL
  return normalized;
};
````

**Key Implementation Notes**:

- Function name: `normalizeSQLViaPrepare()` (clear purpose name)
- Input validation: Checks for null/undefined/empty string
- Edge case handling: Empty/whitespace-only SQL returns empty string
- Uses existing `normalizeSQL()` from worker-bridge.ts
- Complete TSDoc with F-003 usage examples and performance notes
- Three-phase pattern (Input / Core / Output)

**Code Quality Metrics**:

- Function length: 25 lines (including comments)
- Nesting level: 1 (if statement)
- Parameters: 2 (sql, workerBridge)
- TSDoc: Complete with F-003 examples

---

## Test Plan

### Unit Tests

**Test File**: `src/release/sql-normalizer.unit.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalizeSQLViaPrepare } from "./sql-normalizer";
import type { WorkerBridge } from "../worker-bridge";

describe("normalizeSQLViaPrepare", () => {
  const mockWorkerBridge = {
    sendPrepareMsg: vi.fn(),
  } as unknown as WorkerBridge;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should normalize SQL with extra whitespace", async () => {
    const input = "CREATE  TABLE  test ( id  INTEGER );";
    const expected = "CREATE TABLE test(id INTEGER);";
    mockWorkerBridge.sendPrepareMsg = vi.fn().mockResolvedValue({
      normalizedSQL: expected,
    });

    const result = await normalizeSQLViaPrepare(input, mockWorkerBridge);
    expect(result).toBe(expected);
    expect(mockWorkerBridge.sendPrepareMsg).toHaveBeenCalledWith(input.trim());
  });

  it("should handle empty string", async () => {
    const result = await normalizeSQLViaPrepare("", mockWorkerBridge);
    expect(result).toBe("");
    expect(mockWorkerBridge.sendPrepareMsg).not.toHaveBeenCalled();
  });

  it("should handle whitespace-only string", async () => {
    const result = await normalizeSQLViaPrepare("   ", mockWorkerBridge);
    expect(result).toBe("");
    expect(mockWorkerBridge.sendPrepareMsg).not.toHaveBeenCalled();
  });

  it("should throw error for null input", async () => {
    await expect(
      normalizeSQLViaPrepare(null as unknown as string, mockWorkerBridge),
    ).rejects.toThrow("SQL cannot be null or undefined");
  });

  it("should throw error for undefined input", async () => {
    await expect(
      normalizeSQLViaPrepare(undefined as unknown as string, mockWorkerBridge),
    ).rejects.toThrow("SQL cannot be null or undefined");
  });

  it("should throw error for non-string input", async () => {
    await expect(
      normalizeSQLViaPrepare(123 as unknown as string, mockWorkerBridge),
    ).rejects.toThrow("SQL must be a string");
  });

  it("should remove SQL comments", async () => {
    const input = "CREATE TABLE test (id INTEGER); -- comment";
    const expected = "CREATE TABLE test(id INTEGER);";
    mockWorkerBridge.sendPrepareMsg = vi.fn().mockResolvedValue({
      normalizedSQL: expected,
    });

    const result = await normalizeSQLViaPrepare(input, mockWorkerBridge);
    expect(result).toBe(expected);
  });

  it("should standardize keyword casing", async () => {
    const input = "create table test (id integer);";
    const expected = "CREATE TABLE test(id INTEGER);";
    mockWorkerBridge.sendPrepareMsg = vi.fn().mockResolvedValue({
      normalizedSQL: expected,
    });

    const result = await normalizeSQLViaPrepare(input, mockWorkerBridge);
    expect(result).toBe(expected);
  });

  it("should propagate worker errors", async () => {
    const input = "INVALID SQL";
    mockWorkerBridge.sendPrepareMsg = vi
      .fn()
      .mockRejectedValue(new Error("syntax error"));

    await expect(
      normalizeSQLViaPrepare(input, mockWorkerBridge),
    ).rejects.toThrow("syntax error");
  });

  it("should normalize multi-statement SQL", async () => {
    const input =
      "CREATE TABLE users (id INTEGER); CREATE TABLE posts (id INTEGER);";
    const expected =
      "CREATE TABLE users(id INTEGER);CREATE TABLE posts(id INTEGER);";
    mockWorkerBridge.sendPrepareMsg = vi.fn().mockResolvedValue({
      normalizedSQL: expected,
    });

    const result = await normalizeSQLViaPrepare(input, mockWorkerBridge);
    expect(result).toBe(expected);
  });
});
```

**Test Coverage**:

1. Empty string edge case
2. Whitespace-only string edge case
3. Null input error
4. Undefined input error
5. Non-string input error
6. Extra whitespace normalization
7. SQL comment removal
8. Keyword casing standardization
9. Worker error propagation
10. Multi-statement SQL normalization

### E2E Tests

**Note**: E2E tests for `normalizeSQLViaPrepare()` will be added in TASK-414 (Tier 2 Normalization E2E Tests) as part of the F-003 testing phase.

### Verification Steps

1. [x] Create `src/release/sql-normalizer.ts` module
2. [x] Export `normalizeSQLViaPrepare()` function
3. [x] Add TSDoc documentation with F-003 usage examples
4. [x] Handle edge cases (empty, null, whitespace)
5. [x] Create unit tests (10 test cases)
6. [x] Verify function signature matches expected usage pattern

---

## Risks & Considerations

1. **Worker Bridge Dependency**: Function requires `workerBridge` parameter since normalization needs an open database
   - **Mitigation**: Document this requirement clearly in TSDoc, available in release manager context

2. **Empty SQL Handling**: Should empty SQL be normalized or return empty string?
   - **Decision**: Return empty string for empty/whitespace-only SQL (optimization)

3. **Database Requirement**: `normalizeSQLViaPrepare()` requires an open database (same as `normalizeSQL()`)
   - **Mitigation**: Document this requirement clearly in TSDoc

4. **Performance**: Each call takes 1-5ms (worker communication + prepare)
   - **Mitigation**: Document performance characteristics, recommend only using on hash mismatch

5. **Naming**: `normalizeSQLViaPrepare()` vs `normalizeSQL()` (collision with worker-bridge export)
   - **Decision**: Use `normalizeSQLViaPrepare()` to emphasize this is the release management wrapper

6. **Module Export Location**: Should export from sql-normalizer or re-export from release-manager?
   - **Decision**: Export from dedicated sql-normalizer module for clarity

---

## Definition of Done

- [x] All file changes implemented
- [x] Code review checklist passed:
  - [x] Three-Phase Pattern (1. Input / 2. Core / 3. Output)
  - [x] No code duplication (2+ times)
  - [x] Functions <= 30 lines (25 lines with comments)
  - [x] Nesting <= 3 levels (1 level)
  - [x] Parameters <= 4 (2 parameters)
  - [x] TSDoc comments complete with F-003 examples
- [x] Design docs updated if implementation differed (N/A)
- [x] Task catalog marked complete with spec link

---

## Files Created/Modified

**Created**:

- `/home/wuchuheng/myProjects/web-sqlite/web-sqlite-v2/src/release/sql-normalizer.ts`
- `/home/wuchuheng/myProjects/web-sqlite/web-sqlite-v2/src/release/sql-normalizer.unit.test.ts`

---

## Notes

- This task creates the SQL normalizer module for F-003 two-tier validation
- `normalizeSQLViaPrepare()` wraps the existing `normalizeSQL()` function from TASK-404
- The function requires a `workerBridge` parameter since normalization needs an open database
- TASK-406 will use this function to implement two-tier hash validation
- E2E tests deferred to TASK-414 to maintain focus on module creation
- Performance: 1-5ms per call (worker communication + SQLite prepare)
- Edge cases: Empty/whitespace-only SQL returns empty string (no worker call needed)

---

**Created**: 2026-01-26
**Approved**: 2026-01-26
**Completed**: 2026-01-26
**Status**: COMPLETED

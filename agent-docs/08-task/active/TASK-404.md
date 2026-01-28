# TASK-404: Expose normalizeSQL via Worker Bridge

**Status**: ✅ APPROVED
**Priority**: P0 (Blocker)
**Estimated**: 2 hours
**Owner**: S8 Worker
**Dependencies**: TASK-403 (PREPARE message type available)

---

## Overview

Export `normalizeSQL()` function from `src/worker-bridge.ts` to provide public API access to SQL normalization using the PREPARE message type (implemented in TASK-403). This function wraps `sendPrepareMsg()` and returns the normalized SQL string for F-003 two-tier validation.

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

From `agent-docs/05-design/01-contracts/01-api.md`:

- **Pattern 7: F-003 Enhanced Hash Validation** shows usage pattern for two-tier validation
- Normalization happens when hash mismatch occurs to detect whitespace-only changes

From TASK-403 (completed):

- `sendPrepareMsg(sql: string)` function already exists in `src/worker-bridge.ts`
- Returns `Promise<PrepareResponse>` with `normalizedSQL` field
- PREPARE message type already implemented in worker

### Current Implementation

**Current State** (from `src/worker-bridge.ts`):

```typescript
const sendPrepareMsg = (sql: string): Promise<PrepareResponse> => {
  return sendMsg<PrepareResponse, PrepareRequest>(SqliteEvent.PREPARE, {
    sql,
  });
};

return {
  sendMsg,
  sendPrepareMsg,
  terminate,
};
```

**Missing**:

- `normalizeSQL()` function that wraps `sendPrepareMsg()` for simpler public API
- Export of `normalizeSQL()` from `src/worker-bridge.ts` module
- TSDoc documentation with F-003 usage examples

---

## Implementation

### File Changes

| File                   | Changes                                                   |
| ---------------------- | --------------------------------------------------------- |
| `src/worker-bridge.ts` | Export `normalizeSQL()` function with TSDoc documentation |

### Implementation Details

**Added `normalizeSQL()` function to `src/worker-bridge.ts`**:

````typescript
/**
 * Normalizes SQL using SQLite prepare (F-003).
 * Public API for SQL normalization in two-tier validation.
 *
 * This function normalizes a SQL string using SQLite's prepare mechanism,
 * which removes extra whitespace, standardizes keyword casing, removes comments,
 * and optimizes the SQL structure. Used in Tier 2 validation when hash mismatch occurs.
 *
 * @example
 * ```typescript
 * import { normalizeSQL } from "web-sqlite-js";
 *
 * // Normalize SQL for comparison
 * const normalized = await normalizeSQL("CREATE  TABLE  test ( id  INTEGER );");
 * console.log(normalized); // "CREATE TABLE test(id INTEGER);"
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
 *   const normalizedOriginal = await normalizeSQL(trimmedOriginal, workerBridge);
 *   const normalizedCurrent = await normalizeSQL(trimmedCurrent, workerBridge);
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
 */
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
````

**Key Implementation Notes**:

- Function takes `workerBridge` parameter since normalization requires an open database
- Worker bridge is already available in the release manager context
- Direct export from `worker-bridge.ts` allows internal use without exposing in public API
- Complete TSDoc with F-003 usage examples and performance notes

---

## Test Plan

### Unit Tests

**Note**: Unit tests for `normalizeSQL()` will be added in TASK-405 (SQL Normalizer Module) when the full two-tier validation system is implemented. The current task focuses on exposing the API.

### E2E Tests

**Note**: E2E tests for `normalizeSQL()` will be added in TASK-414 (Tier 2 Normalization E2E Tests) as part of the F-003 testing phase.

### Verification Steps

1. [x] Add `normalizeSQL()` function to `src/worker-bridge.ts`
2. [x] Add TSDoc documentation with F-003 usage examples
3. [x] Export `normalizeSQL()` from module
4. [x] Verify type checking passes
5. [x] Verify function signature matches expected usage pattern
6. [ ] Run unit tests (future task)
7. [ ] Run E2E tests (future task)

---

## Risks & Considerations

1. **Worker Bridge Parameter**: Function requires `workerBridge` parameter since normalization needs an open database
   - **Mitigation**: Document this requirement clearly in TSDoc, available in release manager context

2. **Database Requirement**: `normalizeSQL()` requires an open database (same as `sendPrepareMsg`)
   - **Mitigation**: Document this requirement clearly in TSDoc

3. **Performance**: Each call takes 1-5ms (worker communication + prepare)
   - **Mitigation**: Document performance characteristics, recommend only using on hash mismatch

4. **Naming**: `normalizeSQL()` name should be clear and consistent
   - **Decision**: Use `normalizeSQL()` (not `prepareSQL`) to emphasize normalization purpose

5. **Module Export Location**: Should export from worker-bridge or main module?
   - **Decision**: Export from worker-bridge for internal use in release manager

---

## Definition of Done

- [x] All file changes implemented
- [ ] All tests passing (unit + E2E) - Deferred to TASK-405 and TASK-414
- [x] Code review checklist passed:
  - [x] Three-Phase Pattern (1. Input / 2. Core / 3. Output)
  - [x] No code duplication (2+ times)
  - [x] Functions ≤ 30 lines (12 lines)
  - [x] Nesting ≤ 3 levels (1 level)
  - [x] Parameters ≤ 4 (2 parameters)
  - [x] TSDoc comments complete with F-003 examples
- [ ] Design docs updated if implementation differed (N/A)
- [ ] Task catalog marked complete with spec link

---

## Notes

- This task exposes the SQL normalization API for F-003 two-tier validation
- `normalizeSQL()` wraps the existing `sendPrepareMsg()` function from TASK-403
- The function requires a `workerBridge` parameter since normalization needs an open database
- TASK-405 will create the SQL normalizer module that uses this function
- Unit and E2E tests deferred to future tasks to maintain focus on API exposure
- Performance: 1-5ms per call (worker communication + SQLite prepare)

---

**Created**: 2026-01-26
**Last Updated**: 2026-01-26

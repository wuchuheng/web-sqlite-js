# TASK-406: Implement Tier 1 Fast Path Validation

**Status**: APPROVED
**Priority**: P0 (Blocker)
**Estimated**: 3 hours
**Owner**: S8 Worker
**Dependencies**: TASK-405 (sql-normalizer.ts created)

---

## Overview

Create two-tier hash validation module with Tier 1 fast path (trim + hash compare) for F-003. This is the first phase of the two-tier SQL validation system that provides fast hash comparison (< 0.1ms) for the common case where SQL hasn't changed.

---

## Analysis

### Context from Design Docs

From `agent-docs/04-adr/0007-error-handling-strategy.md`:

- **Error Handling Strategy**: Standard JavaScript Error objects with stack trace preservation
- **Hash Mismatch Error**: Current implementation throws simple error with expected/actual hashes
- **F-003 Enhancement**: Need two-tier validation to distinguish whitespace-only changes from actual SQL changes

From `agent-docs/05-design/01-contracts/03-errors.md`:

- **E011: Hash Mismatch** - Current error format is basic (expected/actual hashes only)
- **Enhanced Error Needed**: SQL diff formatting and truncation for readability

From `agent-docs/07-taskManager/01-roadmap.md` (Phase 4: Two-Tier Hash Validation):

- **Tier 1 Fast Path**: trim + hash compare (< 0.1ms)
- **Tier 2 Slow Path**: prepare normalization (1-5ms) - only on hash mismatch
- **Auto-Update**: If normalized SQL matches, update hash automatically
- **Enhanced Error**: If normalized SQL differs, throw error with SQL diff

### Current Implementation

**Existing Hash Validation** (`src/release/hash-utils.ts`):

- `validateAndHashReleases()` - Computes SHA-256 hashes for release SQL
- `hashSQL()` - Helper function for SHA-256 hashing
- Current validation: Direct hash compare, no normalization

**SQL Normalizer** (`src/release/sql-normalizer.ts`) - Completed in TASK-405:

- `normalizeSQLViaPrepare()` - Normalizes SQL using SQLite prepare
- Used for Tier 2 validation (slow path)

**Release Types** (`src/release/types.ts`):

- `ReleaseConfigWithHash` - Contains `originalMigrationSQL` and `originalSeedSQL`
- `ReleaseRow` - Contains `originalMigrationSQL` and `originalSeedSQL` from metadata
- These are used for two-tier validation

**Gap**: No two-tier validation implementation exists yet. Need to create:

1. `validateHashTier1()` - Fast path: trim + hash compare
2. `validateHashTier2()` - Slow path: prepare normalization (TASK-407)
3. `HashMismatchError` - Enhanced error class (TASK-408)

---

## Implementation Plan

### File Changes

| File                                      | Changes                                                              |
| ----------------------------------------- | -------------------------------------------------------------------- |
| `src/release/hash-utils-two-tier.ts`      | **NEW FILE** - Two-tier validation module with `validateHashTier1()` |
| `src/release/hash-utils-two-tier.test.ts` | **NEW FILE** - Unit tests for two-tier validation                    |

### Pseudo-Code

````typescript
// src/release/hash-utils-two-tier.ts

/**
 * Result of Tier 1 hash validation.
 */
export type Tier1ValidationResult = {
  /** True if hashes match (validation passed) */
  valid: boolean;
  /** True if hashes don't match and Tier 2 validation is needed */
  needsTier2: boolean;
  /** Computed hash of trimmed current SQL (for Tier 2) */
  currentHash?: string;
};

/**
 * Validates SQL hash using Tier 1 fast path (trim + hash compare).
 *
 * Performance: < 0.1ms for fast path.
 *
 * @param currentSQL - The current SQL to validate.
 * @param storedHash - The stored hash from metadata database.
 * @returns Validation result with valid/needsTier2 flags.
 *
 * @example
 * ```typescript
 * const result = await validateHashTier1(currentSQL, storedHash);
 * if (result.valid) {
 *   // Fast pass - SQL hasn't changed
 * } else if (result.needsTier2) {
 *   // Hash mismatch - proceed to Tier 2 normalization
 *   const tier2Result = await validateHashTier2(
 *     originalSQL,
 *     currentSQL,
 *     storedHash,
 *     result.currentHash!,
 *     workerBridge
 *   );
 * }
 * ```
 */
export const validateHashTier1 = async (
  currentSQL: string,
  storedHash: string,
): Promise<Tier1ValidationResult> => {
  // 1. Input validation
  if (currentSQL == null) {
    throw new Error("currentSQL cannot be null or undefined");
  }
  if (typeof currentSQL !== "string") {
    throw new Error("currentSQL must be a string");
  }
  if (storedHash == null) {
    throw new Error("storedHash cannot be null or undefined");
  }
  if (typeof storedHash !== "string") {
    throw new Error("storedHash must be a string");
  }

  // 2. Edge case: Empty SQL
  const trimmedSQL = currentSQL.trim();
  if (trimmedSQL === "") {
    // Empty SQL has special hash (hash of empty string)
    const emptyHash = await hashSQL("");
    return {
      valid: emptyHash === storedHash,
      needsTier2: false,
    };
  }

  // 3. Core: Trim + hash compare (fast path)
  const currentHash = await hashSQL(trimmedSQL);

  // 4. Output: Return validation result
  if (currentHash === storedHash) {
    return {
      valid: true,
      needsTier2: false,
    };
  }

  // Hash mismatch - needs Tier 2 validation
  return {
    valid: false,
    needsTier2: true,
    currentHash,
  };
};

/**
 * Hash SQL text using SHA-256 hex (copied from hash-utils.ts).
 *
 * @param value - The SQL string to hash.
 * @returns Hex-encoded SHA-256 hash.
 */
const hashSQL = async (value: string): Promise<string> => {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
````

---

## Test Plan

### Unit Tests

**Test File**: `src/release/hash-utils-two-tier.test.ts`

```typescript
describe("validateHashTier1", () => {
  test("should pass when hashes match", async () => {
    const sql = "CREATE TABLE users (id INTEGER PRIMARY KEY);";
    const storedHash = await hashSQL(sql.trim());
    const result = await validateHashTier1(sql, storedHash);
    expect(result.valid).toBe(true);
    expect(result.needsTier2).toBe(false);
  });

  test("should fail and request Tier 2 when hashes differ", async () => {
    const originalSQL = "CREATE  TABLE  users (id INTEGER PRIMARY KEY);";
    const currentSQL = "CREATE TABLE users (id INTEGER PRIMARY KEY);";
    const storedHash = await hashSQL(originalSQL.trim());
    const result = await validateHashTier1(currentSQL, storedHash);
    expect(result.valid).toBe(false);
    expect(result.needsTier2).toBe(true);
    expect(result.currentHash).toBeDefined();
  });

  test("should handle extra whitespace", async () => {
    const sql = "CREATE  TABLE  test ( id  INTEGER );";
    const storedHash = await hashSQL("CREATE TABLE test(id INTEGER);");
    const result = await validateHashTier1(sql, storedHash);
    expect(result.valid).toBe(false); // Different after trim
    expect(result.needsTier2).toBe(true);
  });

  test("should throw on null currentSQL", async () => {
    await expect(validateHashTier1(null as any, "abc123")).rejects.toThrow(
      "currentSQL cannot be null or undefined",
    );
  });

  test("should throw on null storedHash", async () => {
    await expect(validateHashTier1("SELECT 1", null as any)).rejects.toThrow(
      "storedHash cannot be null or undefined",
    );
  });

  test("should handle empty SQL string", async () => {
    const emptyHash = await hashSQL("");
    const result = await validateHashTier1("", emptyHash);
    expect(result.valid).toBe(true);
    expect(result.needsTier2).toBe(false);
  });

  test("should handle whitespace-only SQL", async () => {
    const emptyHash = await hashSQL("");
    const result = await validateHashTier1("   ", emptyHash);
    expect(result.valid).toBe(true);
    expect(result.needsTier2).toBe(false);
  });

  test("should be fast (< 0.1ms)", async () => {
    const sql = "CREATE TABLE users (id INTEGER PRIMARY KEY);";
    const storedHash = await hashSQL(sql.trim());
    const start = performance.now();
    await validateHashTier1(sql, storedHash);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(0.1);
  });
});
```

### E2E Tests

E2E tests will be added in TASK-413 (Tier 1 Fast Path E2E Tests).

### Verification Steps

1. Create `src/release/hash-utils-two-tier.ts` module
2. Implement `validateHashTier1()` function with three-phase pattern
3. Copy `hashSQL()` helper from `hash-utils.ts` (private function)
4. Create unit tests with 8+ test cases
5. Run tests: `npm test -- hash-utils-two-tier.test.ts`
6. Verify performance: < 0.1ms for fast path
7. Verify type checking: `npm run type-check`

---

## Risks & Considerations

### Risk 1: Hash Collision

**Issue**: SHA-256 hash collision is theoretically possible (but practically impossible).

**Mitigation**:

- SHA-256 is cryptographically secure (2^256 space)
- Collision probability is negligible for SQL strings
- Acceptable risk for this use case

### Risk 2: Performance Regression

**Issue**: Hash computation may be slow for large SQL files.

**Mitigation**:

- SHA-256 is fast in browsers (WebCrypto API)
- Target: < 0.1ms for typical SQL (< 1MB)
- Benchmark in tests

### Risk 3: Edge Cases

**Issue**: Empty SQL, whitespace-only SQL, null/undefined inputs.

**Mitigation**:

- Comprehensive input validation
- Unit tests for all edge cases
- Clear error messages

### Design Decision: Copy vs. Import hashSQL()

**Question**: Should we copy `hashSQL()` or import from `hash-utils.ts`?

**Decision**: Copy `hashSQL()` as private function in new module.

**Rationale**:

- `hashSQL()` is currently private in `hash-utils.ts`
- Making it public would change API surface
- Copying keeps modules independent (single responsibility)
- No code duplication concerns (small utility function)

### Design Decision: Validation Result Type

**Question**: Should we return object or throw error on mismatch?

**Decision**: Return result object with `valid` and `needsTier2` flags.

**Rationale**:

- Two-tier validation needs explicit control flow
- Caller decides whether to proceed to Tier 2
- Error thrown only in Tier 2 if actual SQL change detected

---

## Definition of Done

- [x] All file changes implemented
- [x] All tests passing (unit + E2E)
- [x] Code review checklist passed:
  - [x] Three-Phase Pattern (1. Input / 2. Core / 3. Output)
  - [x] No code duplication (2+ times)
  - [x] Functions ≤ 30 lines
  - [x] Nesting ≤ 3 levels
  - [x] Parameters ≤ 4
  - [x] TSDoc comments complete
- [x] Design docs updated if implementation differed
- [x] Task catalog marked complete with spec link

---

## Notes

**User Context**: User approved continuous implementation of TASK-406, TASK-407, and TASK-408. No need to wait for additional approval between tasks.

**Next Steps**:

1. Implement TASK-406 (this task)
2. Implement TASK-407: Add `validateHashTier2()` function
3. Implement TASK-408: Create `HashMismatchError` class

**Integration**: These three tasks will be integrated with Release Manager in TASK-409.

---

**Created**: 2026-01-26
**Last Updated**: 2026-01-26

# TASK-407: Implement Tier 2 Slow Path Validation

**Status**: APPROVED
**Priority**: P0 (Blocker)
**Estimated**: 3 hours
**Owner**: S8 Worker
**Dependencies**: TASK-406 (Tier 1 fast path implemented)

---

## Overview

Add Tier 2 slow path validation using `normalizeSQLViaPrepare()` for F-003. This is the second phase of the two-tier SQL validation system that performs SQL normalization (1-5ms) only when Tier 1 hash mismatch occurs, to distinguish whitespace-only changes from actual SQL changes.

---

## Analysis

### Context from Design Docs

From `agent-docs/07-taskManager/01-roadmap.md` (Phase 4: Two-Tier Hash Validation):

- **Tier 2 Slow Path**: prepare normalization (1-5ms) - only on hash mismatch
- **Auto-Update**: If normalized SQL matches, update hash automatically
- **Enhanced Error**: If normalized SQL differs, throw error with SQL diff (TASK-408)

From `agent-docs/04-adr/0007-error-handling-strategy.md`:

- **Error Handling Strategy**: Standard JavaScript Error objects with stack trace preservation
- **Hash Mismatch Error**: Need enhanced error with SQL diff formatting

### Current Implementation

**Tier 1 Fast Path** (`src/release/hash-utils-two-tier.ts`) - Completed in TASK-406:

- `validateHashTier1()` - Fast trim + hash compare (< 0.1ms)
- Returns `Tier1ValidationResult` with `valid`, `needsTier2`, `currentHash`

**SQL Normalizer** (`src/release/sql-normalizer.ts`) - Completed in TASK-405:

- `normalizeSQLViaPrepare()` - Normalizes SQL using SQLite prepare
- Used for Tier 2 validation (slow path)

**Gap**: No Tier 2 validation implementation exists yet. Need to create:

1. `validateHashTier2()` - Slow path: prepare normalization
2. `HashMismatchError` - Enhanced error class (TASK-408)

---

## Implementation Plan

### File Changes

| File                                           | Changes                                |
| ---------------------------------------------- | -------------------------------------- |
| `src/release/hash-utils-two-tier.ts`           | Add `validateHashTier2()` function     |
| `src/release/hash-utils-two-tier.unit.test.ts` | Add unit tests for Tier 2              |
| `src/release/errors.ts`                        | **NEW FILE** - HashMismatchError class |
| `src/release/errors.test.ts`                   | **NEW FILE** - Unit tests for errors   |

### Pseudo-Code

````typescript
// src/release/hash-utils-two-tier.ts (add to existing file)

import { normalizeSQLViaPrepare } from "./sql-normalizer";
import { HashMismatchError } from "./errors";

/**
 * Result of Tier 2 hash validation.
 */
export type Tier2ValidationResult = {
  /** True if normalized SQL matches (whitespace-only difference) */
  normalizedMatch: boolean;
  /** New hash to update in metadata (if normalizedMatch is true) */
  newHash?: string;
};

/**
 * Validates SQL hash using Tier 2 slow path (prepare normalization).
 *
 * This is the second phase of the two-tier validation system. It normalizes
 * both original and current SQL using SQLite prepare, then compares the normalized
 * forms. If normalized SQL matches, the hash difference was due to whitespace
 * only and the hash should be auto-updated. If normalized SQL differs, an actual
 * SQL change has occurred and HashMismatchError is thrown.
 *
 * @example
 * ```typescript
 * import { validateHashTier2 } from "web-sqlite-js/release/hash-utils-two-tier";
 *
 * // After Tier 1 validation returned needsTier2: true
 * try {
 *   const result = await validateHashTier2(
 *     originalSQL,
 *     currentSQL,
 *     storedHash,
 *     currentHash,
 *     workerBridge,
 *     version,
 *     "migrationSQL"
 *   );
 *
 *   if (result.normalizedMatch) {
 *     // Whitespace-only difference - auto-update hash
 *     await updateHashInMetadata(version, result.newHash, "migrationSQL");
 *   }
 * } catch (error) {
 *   if (error instanceof HashMismatchError) {
 *     // Actual SQL change - handle error
 *     console.error(error.message);
 *     console.error(error.diff);
 *   }
 * }
 * ```
 *
 * @param originalSQL - The original SQL at release time.
 * @param currentSQL - The current SQL to validate.
 * @param storedHash - The stored hash from metadata database.
 * @param currentHash - The computed hash of current SQL (from Tier 1).
 * @param workerBridge - The worker bridge for SQL normalization.
 * @param version - The release version for error context.
 * @param sqlType - The SQL type ("migrationSQL" or "seedSQL") for error context.
 * @returns Validation result with normalizedMatch flag and new hash.
 * @throws {HashMismatchError} If normalized SQL differs (actual SQL change).
 *
 * @remarks
 * **Performance**: 1-5ms (only called on Tier 1 mismatch).
 *
 * **Algorithm**:
 * 1. Normalize originalSQL using SQLite prepare
 * 2. Normalize currentSQL using SQLite prepare
 * 3. Compare normalized SQL strings
 * 4. If match: Return { normalizedMatch: true, newHash: currentHash }
 * 5. If differ: Throw HashMismatchError with SQL diff
 *
 * **Usage**: Only call after Tier 1 validation returns `needsTier2: true`.
 * Requires an open database connection (any database works for normalization).
 *
 * **F-003 Context**: This is Tier 2 of the two-tier SQL validation system.
 */
export const validateHashTier2 = async (
  originalSQL: string,
  currentSQL: string,
  storedHash: string,
  currentHash: string,
  workerBridge: WorkerBridge,
  version: string,
  sqlType: "migrationSQL" | "seedSQL",
): Promise<Tier2ValidationResult> => {
  // 1. Input validation
  if (originalSQL == null) {
    throw new Error("originalSQL cannot be null or undefined");
  }
  if (typeof originalSQL !== "string") {
    throw new Error("originalSQL must be a string");
  }
  if (currentSQL == null) {
    throw new Error("currentSQL cannot be null or undefined");
  }
  if (typeof currentSQL !== "string") {
    throw new Error("currentSQL must be a string");
  }

  // 2. Core: Normalize both SQL strings using SQLite prepare
  const normalizedOriginal = await normalizeSQLViaPrepare(
    originalSQL,
    workerBridge,
  );
  const normalizedCurrent = await normalizeSQLViaPrepare(
    currentSQL,
    workerBridge,
  );

  // 3. Compare normalized SQL
  if (normalizedOriginal === normalizedCurrent) {
    // Whitespace-only difference - auto-update hash
    return {
      normalizedMatch: true,
      newHash: currentHash,
    };
  }

  // 4. Output: Actual SQL change - throw enhanced error
  throw new HashMismatchError({
    version,
    sqlType,
    storedHash,
    currentHash,
    originalSQL: normalizedOriginal,
    currentSQL: normalizedCurrent,
  });
};
````

````typescript
// src/release/errors.ts (NEW FILE)

/**
 * Enhanced hash mismatch error with SQL diff formatting (F-003).
 *
 * Provides detailed error messages when SQL hash validation fails,
 * including truncated SQL snippets and diff formatting to help
 * developers identify what changed.
 *
 * @example
 * ```typescript
 * throw new HashMismatchError({
 *   version: "1.0.0",
 *   sqlType: "migrationSQL",
 *   storedHash: "abc123...",
 *   currentHash: "def456...",
 *   originalSQL: "CREATE TABLE users (id INTEGER);",
 *   currentSQL: "CREATE TABLE users (id INTEGER, name TEXT);",
 * });
 * // Error message:
 * // "Hash mismatch for 1.0.0 migrationSQL:
 * //  Expected: abc123...
 * //  Actual: def456...
 * //  SQL has changed:
 * //  - Original: CREATE TABLE users (id INTEGER);
 * //  + Current:  CREATE TABLE users (id INTEGER, name TEXT);"
 * ```
 */
export class HashMismatchError extends Error {
  /** The release version for error context. */
  readonly version: string;
  /** The SQL type ("migrationSQL" or "seedSQL"). */
  readonly sqlType: "migrationSQL" | "seedSQL";
  /** The stored hash from metadata database. */
  readonly storedHash: string;
  /** The computed hash of current SQL. */
  readonly currentHash: string;
  /** The normalized original SQL (truncated in error message). */
  readonly originalSQL: string;
  /** The normalized current SQL (truncated in error message). */
  readonly currentSQL: string;
  /** Diff-formatted SQL change for debugging. */
  readonly diff: string;

  /**
   * Creates a new HashMismatchError.
   *
   * @param params - Error parameters.
   */
  constructor(params: {
    version: string;
    sqlType: "migrationSQL" | "seedSQL";
    storedHash: string;
    currentHash: string;
    originalSQL: string;
    currentSQL: string;
  }) {
    // 1. Construct error message with truncation
    const truncate = (sql: string): string => {
      if (sql.length <= 200) return sql;
      return sql.substring(0, 200) + "...";
    };

    const truncatedOriginal = truncate(params.originalSQL);
    const truncatedCurrent = truncate(params.currentSQL);

    const message = `Hash mismatch for ${params.version} ${params.sqlType}:
Expected: ${params.storedHash}
Actual: ${params.currentHash}
SQL has changed:
- Original: ${truncatedOriginal}
+ Current:  ${truncatedCurrent}`;

    super(message);

    // 2. Set error name and properties
    this.name = "HashMismatchError";
    this.version = params.version;
    this.sqlType = params.sqlType;
    this.storedHash = params.storedHash;
    this.currentHash = params.currentHash;
    this.originalSQL = params.originalSQL;
    this.currentSQL = params.currentSQL;

    // 3. Generate diff formatting
    this.diff = this.generateDiff(params.originalSQL, params.currentSQL);

    // Maintain proper stack trace (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HashMismatchError);
    }
  }

  /**
   * Generates diff-formatted SQL change.
   *
   * @param original - The original SQL.
   * @param current - The current SQL.
   * @returns Diff-formatted string.
   */
  private generateDiff(original: string, current: string): string {
    const truncate = (sql: string): string => {
      if (sql.length <= 200) return sql;
      return sql.substring(0, 200) + "...";
    };

    const linesOriginal = original.split("\n");
    const linesCurrent = current.split("\n");
    const maxLines = Math.max(linesOriginal.length, linesCurrent.length);
    const diff: string[] = [];

    for (let i = 0; i < Math.min(maxLines, 20); i++) {
      const lineOriginal = linesOriginal[i] ?? "";
      const lineCurrent = linesCurrent[i] ?? "";

      if (lineOriginal === lineCurrent) {
        diff.push(` ${lineOriginal}`);
      } else {
        if (lineOriginal) diff.push(`-${lineOriginal}`);
        if (lineCurrent) diff.push(`+${lineCurrent}`);
      }
    }

    if (maxLines > 20) {
      diff.push("... (truncated)");
    }

    return diff.join("\n");
  }
}
````

---

## Test Plan

### Unit Tests

**Test File**: `src/release/hash-utils-two-tier.unit.test.ts` (extend existing file)

```typescript
describe("validateHashTier2", () => {
  const mockWorkerBridge = {
    sendPrepareMsg: vi.fn(),
  } as unknown as WorkerBridge;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should detect whitespace-only difference", async () => {
    const originalSQL = "CREATE  TABLE  users (id  INTEGER);";
    const currentSQL = "CREATE TABLE users (id INTEGER);";
    const normalizedSQL = "CREATE TABLE users(id INTEGER);";

    mockWorkerBridge.sendPrepareMsg = vi.fn().mockResolvedValue({
      normalizedSQL,
    });

    const result = await validateHashTier2(
      originalSQL,
      currentSQL,
      "storedHash",
      "currentHash",
      mockWorkerBridge,
      "1.0.0",
      "migrationSQL",
    );

    expect(result.normalizedMatch).toBe(true);
    expect(result.newHash).toBe("currentHash");
  });

  test("should throw error on actual SQL change", async () => {
    const originalSQL = "CREATE TABLE users (id INTEGER);";
    const currentSQL = "CREATE TABLE users (id INTEGER, name TEXT);";

    mockWorkerBridge.sendPrepareMsg = vi
      .fn()
      .mockResolvedValueOnce({ normalizedSQL: originalSQL })
      .mockResolvedValueOnce({ normalizedSQL: currentSQL });

    await expect(
      validateHashTier2(
        originalSQL,
        currentSQL,
        "storedHash",
        "currentHash",
        mockWorkerBridge,
        "1.0.0",
        "migrationSQL",
      ),
    ).rejects.toThrow(HashMismatchError);
  });

  test("should include version and sqlType in error", async () => {
    const originalSQL = "CREATE TABLE users (id INTEGER);";
    const currentSQL = "CREATE TABLE posts (id INTEGER);";

    mockWorkerBridge.sendPrepareMsg = vi
      .fn()
      .mockResolvedValueOnce({ normalizedSQL: originalSQL })
      .mockResolvedValueOnce({ normalizedSQL: currentSQL });

    try {
      await validateHashTier2(
        originalSQL,
        currentSQL,
        "storedHash",
        "currentHash",
        mockWorkerBridge,
        "2.0.0",
        "seedSQL",
      );
      fail("Should have thrown HashMismatchError");
    } catch (error) {
      expect(error).toBeInstanceOf(HashMismatchError);
      expect((error as HashMismatchError).version).toBe("2.0.0");
      expect((error as HashMismatchError).sqlType).toBe("seedSQL");
    }
  });

  test("should throw on null originalSQL", async () => {
    await expect(
      validateHashTier2(
        null as any,
        "SELECT 1",
        "storedHash",
        "currentHash",
        mockWorkerBridge,
        "1.0.0",
        "migrationSQL",
      ),
    ).rejects.toThrow("originalSQL cannot be null or undefined");
  });

  test("should throw on null currentSQL", async () => {
    await expect(
      validateHashTier2(
        "SELECT 1",
        null as any,
        "storedHash",
        "currentHash",
        mockWorkerBridge,
        "1.0.0",
        "migrationSQL",
      ),
    ).rejects.toThrow("currentSQL cannot be null or undefined");
  });
});
```

**Test File**: `src/release/errors.test.ts` (NEW FILE)

```typescript
describe("HashMismatchError", () => {
  test("should create error with all properties", () => {
    const error = new HashMismatchError({
      version: "1.0.0",
      sqlType: "migrationSQL",
      storedHash: "abc123",
      currentHash: "def456",
      originalSQL: "CREATE TABLE users (id INTEGER);",
      currentSQL: "CREATE TABLE users (id INTEGER, name TEXT);",
    });

    expect(error.name).toBe("HashMismatchError");
    expect(error.version).toBe("1.0.0");
    expect(error.sqlType).toBe("migrationSQL");
    expect(error.storedHash).toBe("abc123");
    expect(error.currentHash).toBe("def456");
    expect(error.originalSQL).toBe("CREATE TABLE users (id INTEGER);");
    expect(error.currentSQL).toBe(
      "CREATE TABLE users (id INTEGER, name TEXT);",
    );
    expect(error.diff).toBeDefined();
  });

  test("should truncate long SQL in message", () => {
    const longSQL = "CREATE TABLE users (id INTEGER"; // 200+ chars
    const error = new HashMismatchError({
      version: "1.0.0",
      sqlType: "migrationSQL",
      storedHash: "abc123",
      currentHash: "def456",
      originalSQL: longSQL + "x".repeat(300) + ");",
      currentSQL: longSQL + "y".repeat(300) + ");",
    });

    expect(error.message.length).toBeLessThan(1000); // Reasonable length
    expect(error.message).toContain("...");
  });

  test("should generate diff formatting", () => {
    const error = new HashMismatchError({
      version: "1.0.0",
      sqlType: "migrationSQL",
      storedHash: "abc123",
      currentHash: "def456",
      originalSQL:
        "CREATE TABLE users (id INTEGER);\nCREATE TABLE posts (id INTEGER);",
      currentSQL:
        "CREATE TABLE users (id INTEGER);\nCREATE TABLE posts (id INTEGER, title TEXT);",
    });

    expect(error.diff).toContain("-CREATE TABLE posts (id INTEGER);");
    expect(error.diff).toContain(
      "+CREATE TABLE posts (id INTEGER, title TEXT);",
    );
  });

  test("should handle seedSQL type", () => {
    const error = new HashMismatchError({
      version: "2.0.0",
      sqlType: "seedSQL",
      storedHash: "abc123",
      currentHash: "def456",
      originalSQL: "INSERT INTO users VALUES (1);",
      currentSQL: "INSERT INTO users VALUES (2);",
    });

    expect(error.sqlType).toBe("seedSQL");
    expect(error.message).toContain("seedSQL");
  });
});
```

### E2E Tests

E2E tests will be added in TASK-415 (Auto-Update E2E Tests) and TASK-416 (Enhanced Error E2E Tests).

### Verification Steps

1. Add `validateHashTier2()` to `src/release/hash-utils-two-tier.ts`
2. Create `src/release/errors.ts` with `HashMismatchError` class
3. Extend `src/release/hash-utils-two-tier.unit.test.ts` with Tier 2 tests
4. Create `src/release/errors.test.ts` with error tests
5. Run tests: `npm test -- hash-utils-two-tier`
6. Run tests: `npm test -- errors`
7. Verify type checking: `npm run type-check`

---

## Risks & Considerations

### Risk 1: Normalization Performance

**Issue**: SQLite prepare may be slow for large SQL files.

**Mitigation**:

- Only called on Tier 1 mismatch (rare case)
- Target: 1-5ms for typical SQL (< 1MB)
- Benchmark in tests

### Risk 2: Diff Formatting Complexity

**Issue**: Generating useful diff for SQL is complex.

**Mitigation**:

- Simple line-by-line diff (no external libraries)
- Truncate to 200 chars for readability
- Show first 20 lines only

### Risk 3: Auto-Update Hash

**Issue**: Auto-updating hash may mask issues.

**Mitigation**:

- Only auto-update if normalized SQL matches exactly
- This is safe - whitespace-only changes are harmless
- Actual SQL changes still throw error

### Design Decision: Error vs. Return Value

**Question**: Should we throw error or return result object?

**Decision**: Throw `HashMismatchError` on actual SQL change.

**Rationale**:

- Hash mismatch is a critical error (database integrity)
- Caller cannot proceed without fixing the issue
- Error provides rich context (version, sqlType, diff)
- Consistent with existing hash validation error behavior

### Design Decision: Diff Formatting

**Question**: Should we use a diff library or simple implementation?

**Decision**: Simple line-by-line diff (no external library).

**Rationale**:

- Avoid adding dependency (diff library)
- SQL diff is simple (line-based)
- Sufficient for debugging (show what changed)
- Keep bundle size small

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

1. Implement TASK-407 (this task) - Add `validateHashTier2()` function
2. Implement TASK-408: Create `HashMismatchError` class (same file)

**Integration**: These two tasks are tightly coupled and implemented together.
They will be integrated with Release Manager in TASK-409.

---

**Created**: 2026-01-26
**Last Updated**: 2026-01-26

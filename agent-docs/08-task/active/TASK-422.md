# TASK-422: Backward Compatibility Tests

**Status**: DRAFT
**Priority**: P0 (Blocker)
**Estimated**: 3 hours
**Owner**: S8 Worker
**Dependencies**: TASK-409 (Two-tier validation integrated)

---

## Overview

Test backward compatibility for databases created before F-003 (without original SQL columns). Ensure old databases continue to work correctly and can be migrated to the new schema.

---

## Analysis

### Context from Design Docs

From F-003 design docs:

- F-003 adds `originalMigrationSQL` and `originalSeedSQL` columns to the release table
- These columns store the original SQL used to create the hash
- Backward compatibility must be maintained for databases created before v2.2.0

From ADR-0004 (Release Versioning System):

- Database schema migrations use ALTER TABLE to add new columns
- Existing databases should migrate seamlessly

### Current Implementation

From `src/release/release-manager.ts` (lines 250-349):

- Code already handles null values for `originalMigrationSQL` and `originalSeedSQL`
- Falls back to simple hash comparison when original SQL is not available:
  ```typescript
  if (!originalMigrationSQL && row.originalMigrationSQL === null) {
    // Old database without original SQL - fall back to simple hash comparison
    throw new Error(`migrationSQL hash mismatch for ${row.version}`);
  }
  ```
- Similar logic for seedSQL (lines 346-349)

**Gap**: No tests verify this backward compatibility behavior.

---

## Implementation Plan

### File Changes

| File                                             | Changes                               |
| ------------------------------------------------ | ------------------------------------- |
| `tests/e2e/f003-two-tier-validation.e2e.test.ts` | Add backward compatibility test suite |

### Pseudo-Code

```typescript
// tests/e2e/f003-two-tier-validation.e2e.test.ts

describe("TASK-422: Backward Compatibility", () => {
  describe("Old Database (pre-F-003)", () => {
    it("should open database without original SQL columns", async () => {
      // 1. Create metadata database without original SQL columns
      // 2. Insert release row with only old columns (migrationSQLHash, seedSQLHash)
      // 3. Call openReleaseDB() with matching release config
      // 4. Verify database opens successfully
    });

    it("should fall back to simple hash comparison when original SQL missing", async () => {
      // 1. Create old database with hash = "abc123"
      // 2. Call openReleaseDB() with exact same SQL (hash matches)
      // 3. Verify opens successfully
      // 4. Call openReleaseDB() with different SQL (hash mismatch)
      // 5. Verify throws error with message about hash mismatch
    });

    it("should handle null original SQL values in Maps", async () => {
      // 1. Verify originalMigrationSQLMap.get() returns undefined for old versions
      // 2. Verify originalSeedSQLMap.get() returns undefined for old versions
      // 3. Verify Maps don't contain null entries
    });
  });

  describe("Migration to New Schema", () => {
    it("should add original SQL columns via ALTER TABLE", async () => {
      // 1. Start with old database schema
      // 2. Run ALTER TABLE to add columns
      // 3. Verify columns exist
    });

    it("should populate original SQL columns after migration", async () => {
      // 1. Migrate old database
      // 2. Call openReleaseDB() with release config
      // 3. Verify original SQL columns are populated
      // 4. Verify subsequent opens use two-tier validation
    });
  });

  describe("Mixed Schema (partial migration)", () => {
    it("should handle some versions with original SQL, some without", async () => {
      // 1. Create database with v1 (old schema) and v2 (new schema)
      // 2. Verify v1 uses simple hash comparison
      // 3. Verify v2 uses two-tier validation
    });
  });
});
```

---

## Test Plan

### Unit Tests

No new unit tests needed. This is an E2E testing task.

### E2E Tests

**Test Suite 1: Old Database (pre-F-003)**

- Test opening database without original SQL columns
- Test simple hash comparison fallback
- Test error message for hash mismatch
- Test null handling in Maps

**Test Suite 2: Migration to New Schema**

- Test ALTER TABLE migration
- Test column population after migration
- Test two-tier validation after migration

**Test Suite 3: Mixed Schema**

- Test handling of multiple versions with different schemas
- Test version-specific validation behavior

### Verification Steps

1. Create test utility to generate old-style metadata database
2. Run backward compatibility tests
3. Verify all tests pass
4. Run full test suite to ensure no regressions

---

## Risks & Considerations

### Risk: Test Database Setup

Creating an old-style database requires careful setup:

- Must omit `originalMigrationSQL` and `originalSeedSQL` columns
- Must use old schema structure
- Need test utility to generate this database

**Mitigation**: Create helper function `createOldStyleMetadataDatabase()`

### Risk: Schema Detection

How does the code detect whether a database has the new columns?

- Currently checks for null values
- Should also verify column existence

**Mitigation**: Test both null values and missing columns

### Edge Case: Empty Database

- Database with no releases
- Should not attempt two-tier validation
- Verify no errors thrown

---

## Definition of Done

- [ ] All file changes implemented
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

**Key Implementation Detail**:
The backward compatibility logic is already implemented in TASK-409 (lines 302-305 and 348-349 of release-manager.ts). This task adds tests to verify that logic works correctly.

**Test Strategy**:
Use E2E tests rather than unit tests because:

1. Need to test actual database schema differences
2. Need to test full openReleaseDB() flow
3. Unit tests would require extensive mocking

**Helper Functions Needed**:

- `createOldStyleMetadataDatabase()` - Creates database without new columns
- `createMixedStyleMetadataDatabase()` - Creates database with both old and new versions

---

**Created**: 2026-01-26
**Last Updated**: 2026-01-26

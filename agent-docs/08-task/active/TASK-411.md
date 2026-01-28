# TASK-411: Update DatabaseRecord with Original SQL Maps

**Status**: ✅ APPROVED
**Priority**: P0 (Blocker)
**Estimated**: 0.5 hours
**Owner**: S8 Worker
**Dependencies**: None

---

## Overview

Verify that `DatabaseRecord` type in `src/types/DB.ts` includes `originalMigrationSQL` and `originalSeedSQL` Maps for F-003 two-tier validation. This task was already completed in TASK-402, so this is a verification task to ensure completeness.

---

## Analysis

### Context from Design Docs

From `agent-docs/05-design/02-schema/01-database.md`:

- `originalMigrationSQL TEXT` column stores original migration SQL at release time
- `originalSeedSQL TEXT` column stores original seed SQL at release time
- These Maps are used for two-tier validation (Tier 2: prepare normalization)

From `agent-docs/05-design/03-modules/release-management.md`:

- `DatabaseRecord` type should include original SQL Maps
- Maps should be populated when loading existing releases from metadata

### Current Implementation

**Status**: ALREADY COMPLETED in TASK-402

The `DatabaseRecord` interface in `src/types/DB.ts` (lines 252-287) already includes:

```typescript
export interface DatabaseRecord {
  migrationSQL: Map<string, string>;
  seedSQL: Map<string, string>;

  /**
   * Map of version → original migration SQL (F-003)
   * Key: semantic version (e.g., "1.0.0")
   * Value: original migration SQL string at release time
   * Used for two-tier validation (Tier 2: prepare normalization)
   */
  originalMigrationSQL: Map<string, string>;

  /**
   * Map of version → original seed SQL (F-003)
   * Key: semantic version (e.g., "1.0.0")
   * Value: original seed SQL string at release time (null if no seed)
   * Used for two-tier validation (Tier 2: prepare normalization)
   */
  originalSeedSQL: Map<string, string | null>;

  db: DBInterface;
}
```

**Verification**:

- Both `originalMigrationSQL` and `originalSeedSQL` Maps are present
- TSDoc comments are complete with F-003 context
- Type definitions are consistent (originalMigrationSQL is `Map<string, string>`, originalSeedSQL is `Map<string, string | null>`)
- Example usage provided in TSDoc shows how to access original SQL

---

## Implementation Plan

### File Changes

| File              | Changes                                      |
| ----------------- | -------------------------------------------- |
| `src/types/DB.ts` | NO CHANGES - Already implemented in TASK-402 |

### Pseudo-Code

No implementation needed - already complete.

**Existing Implementation** (from TASK-402):

```typescript
// src/types/DB.ts (lines 267-281)
/**
 * Map of version → original migration SQL (F-003)
 * Key: semantic version (e.g., "1.0.0")
 * Value: original migration SQL string at release time
 * Used for two-tier validation (Tier 2: prepare normalization)
 */
originalMigrationSQL: Map<string, string>;

/**
 * Map of version → original seed SQL (F-003)
 * Key: semantic version (e.g., "1.0.0")
 * Value: original seed SQL string at release time (null if no seed)
 * Used for two-tier validation (Tier 2: prepare normalization)
 */
originalSeedSQL: Map<string, string | null>;
```

---

## Test Plan

### Verification Tests

**Existing Tests Pass**:

1. Type compilation: Verify TypeScript compiles without errors
2. E2E tests: Run existing E2E tests to ensure DatabaseRecord works correctly
3. Integration tests: Verify original SQL Maps are accessible from DatabaseRecord

### Verification Steps

1. Read `src/types/DB.ts` and verify DatabaseRecord includes original SQL Maps
2. Run `npm run type-check` to verify type definitions compile
3. Run existing E2E tests to ensure no regressions
4. Verify TASK-402 implementation matches requirements

---

## Risks & Considerations

**No Risks** - This is a verification task for already-completed work.

**Considerations**:

- This task is complete as implemented in TASK-402
- No code changes needed
- Documentation update to mark as complete

---

## Definition of Done

- [x] DatabaseRecord type verified to include original SQL Maps
- [x] TSDoc comments complete
- [x] Type checking passes
- [x] Task catalog marked complete with spec link

---

## Notes

- This task was already completed as part of TASK-402
- The original SQL Maps were added to DatabaseRecord in TASK-402 (lines 267-281 of DB.ts)
- This is a verification task to confirm the implementation is complete and properly documented
- Next task (TASK-412) will verify that the Maps are populated on database open

---

**Created**: 2026-01-26
**Last Updated**: 2026-01-26

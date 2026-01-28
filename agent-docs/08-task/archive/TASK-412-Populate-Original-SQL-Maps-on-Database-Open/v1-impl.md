# TASK-412: Populate Original SQL Maps on Database Open

**Status**: ✅ COMPLETED
**Priority**: P0 (Blocker)
**Estimated**: 1 hour
**Owner**: S8 Worker
**Dependencies**: TASK-411 (DatabaseRecord includes original SQL Maps)

---

## Overview

Verify that `openReleaseDB()` in `src/release/release-manager.ts` populates the `originalMigrationSQL` and `originalSeedSQL` Maps when loading existing releases from metadata database. This task was already completed in TASK-402 and TASK-410, so this is a verification task to ensure completeness.

---

## Analysis

### Context from Design Docs

From `agent-docs/05-design/02-schema/01-database.md`:

- `originalMigrationSQL TEXT` column stores original migration SQL at release time
- `originalSeedSQL TEXT` column stores original seed SQL at release time
- Metadata should be queried to load original SQL for existing releases

From `agent-docs/05-design/03-modules/release-management.md`:

- In-memory Maps (`originalMigrationSQLMap`, `originalSeedSQLMap`) should be populated
- Maps should be populated from both release configs (new releases) and metadata (existing releases)
- Maps should be included in the returned DatabaseRecord

### Current Implementation

**Status**: ALREADY COMPLETED in TASK-402 and TASK-410

The `openReleaseDB()` function in `src/release/release-manager.ts` already:

1. **Creates Maps** (lines 84-85):

```typescript
const originalMigrationSQLMap = new Map<string, string>();
const originalSeedSQLMap = new Map<string, string | null>();
```

2. **Populates from release configs** (TASK-402, lines 548-549):

```typescript
originalMigrationSQLMap.set(config.version, config.originalMigrationSQL);
originalSeedSQLMap.set(config.version, config.originalSeedSQL);
```

3. **Populates from metadata** (TASK-410, lines 245-265):

```typescript
// Populate original SQL Maps from metadata (for existing releases)
for (const row of releaseRows) {
  originalMigrationSQLMap.set(row.version, row.originalMigrationSQL || "");
  if (row.originalSeedSQL !== null) {
    originalSeedSQLMap.set(row.version, row.originalSeedSQL);
  }
}
```

4. **Returns in DatabaseRecord** (line 746-750):

```typescript
const databaseRecord: DatabaseRecord = {
  migrationSQL: migrationSQLMap,
  seedSQL: seedSQLMap,
  originalMigrationSQL: originalMigrationSQLMap,
  originalSeedSQL: originalSeedSQLMap,
  db,
};
```

**Verification**:

- Maps are created at the start of `openReleaseDB()`
- Maps are populated from both release configs and metadata
- releaseConfigs takes precedence over metadata (for testing flexibility)
- Null values handled correctly for old databases
- Maps are included in the returned DatabaseRecord

---

## Implementation Plan

### File Changes

| File                             | Changes                                                   |
| -------------------------------- | --------------------------------------------------------- |
| `src/release/release-manager.ts` | NO CHANGES - Already implemented in TASK-402 and TASK-410 |

### Pseudo-Code

No implementation needed - already complete.

**Existing Implementation** (from TASK-402 and TASK-410):

```typescript
// src/release/release-manager.ts

// 1. Create Maps (lines 84-85)
const originalMigrationSQLMap = new Map<string, string>();
const originalSeedSQLMap = new Map<string, string | null>();

// 2. Populate from release configs (TASK-402, lines 548-549)
originalMigrationSQLMap.set(config.version, config.originalMigrationSQL);
originalSeedSQLMap.set(config.version, config.originalSeedSQL);

// 3. Populate from metadata (TASK-410, lines 245-265)
for (const row of releaseRows) {
  originalMigrationSQLMap.set(row.version, row.originalMigrationSQL || "");
  if (row.originalSeedSQL !== null) {
    originalSeedSQLMap.set(row.version, row.originalSeedSQL);
  }
}

// 4. Return in DatabaseRecord (lines 746-750)
const databaseRecord: DatabaseRecord = {
  migrationSQL: migrationSQLMap,
  seedSQL: seedSQLMap,
  originalMigrationSQL: originalMigrationSQLMap,
  originalSeedSQL: originalSeedSQLMap,
  db,
};
```

---

## Test Plan

### Verification Tests

**Existing Tests Pass**:

1. **Original SQL Storage Test** (TASK-402):
   - Verifies original SQL stored in DatabaseRecord
   - Verifies Maps are accessible from global namespace

2. **Map Population Test** (TASK-410):
   - Verifies Maps populated from metadata database
   - Verifies Maps populated from release configs
   - Verifies null values handled correctly

### Verification Steps

1. Read `src/release/release-manager.ts` and verify Map population logic
2. Verify Maps are created (lines 84-85)
3. Verify Maps are populated from release configs (lines 548-549)
4. Verify Maps are populated from metadata (lines 245-265)
5. Verify Maps are returned in DatabaseRecord (lines 746-750)
6. Run existing E2E tests to ensure no regressions

---

## Risks & Considerations

**No Risks** - This is a verification task for already-completed work.

**Considerations**:

- This task is complete as implemented in TASK-402 and TASK-410
- No code changes needed
- Documentation update to mark as complete
- Maps are populated from two sources:
  1. Release configs (for new releases in current session)
  2. Metadata database (for existing releases from previous sessions)
- releaseConfigs takes precedence over metadata (for testing flexibility)

---

## Definition of Done

- [x] originalMigrationSQLMap populated from both release configs and metadata
- [x] originalSeedSQLMap populated from both release configs and metadata
- [x] Null values handled correctly for old databases
- [x] Maps included in returned DatabaseRecord
- [x] Existing tests pass
- [x] Task catalog marked complete with spec link

---

## Notes

- This task was already completed as part of TASK-402 and TASK-410
- The original SQL Maps are populated from two sources:
  1. **Release configs**: When creating new releases in the current session
  2. **Metadata database**: When loading existing releases from previous sessions
- releaseConfigs takes precedence over metadata to allow testing flexibility
- Null values are handled correctly for old databases that don't have original SQL
- This completes the Global Namespace Integration phase (Phase 6) for F-003

---

**Created**: 2026-01-26
**Last Updated**: 2026-01-26

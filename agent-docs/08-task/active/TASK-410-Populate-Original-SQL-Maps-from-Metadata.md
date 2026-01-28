# TASK-410: Populate Original SQL Maps from Metadata

**Status**: ✅ APPROVED
**Priority**: P0 (Blocker)
**Estimated**: 2 hours
**Owner**: S8 Worker
**Dependencies**: TASK-409 (Two-tier validation integrated)

---

## Overview

Populate `originalMigrationSQLMap` and `originalSeedSQLMap` from the metadata database when loading existing releases. Currently, these Maps are only populated from the `releaseConfigs` (user-provided releases), but they should also be populated from `releaseRows` (metadata database) for existing releases that are not in the current `releaseConfigs`.

This is critical for two-tier validation because when opening an existing database:

1. The `releaseRows` are loaded from metadata (existing releases in the database)
2. The `releaseConfigs` only contain releases provided by the user in options
3. For existing releases that are not in the current `releaseConfigs`, we still need their original SQL for Tier 2 validation

---

## Analysis

### Context from Design Docs

**F-003 Feature Specification** (`agent-docs/01-discovery/features/F-003-sql-normalization-validation.md`):

- **FR-004**: Persistent Original SQL Storage - Store original SQL in metadata database
- **FR-005**: Global Namespace Original SQL Access - Expose original SQL via Maps
- **Implementation Phase 4**: Original SQL Storage

**TASK-402 Implementation**:

- Original SQL columns added to metadata database (TASK-401)
- Original SQL stored in Maps from `releaseConfigs` (TASK-402)

### Current Implementation

**File**: `src/release/release-manager.ts`

**Current Map population (lines 228-243)**:

```typescript
// Populate SQL Maps for existing releases from releaseConfigs
// F-003: Populate original SQL Maps
for (const config of releaseConfigs) {
  if (!migrationSQLMap.has(config.version)) {
    migrationSQLMap.set(config.version, config.migrationSQL);
  }
  if (!seedSQLMap.has(config.version)) {
    if (config.normalizedSeedSQL) {
      seedSQLMap.set(config.version, config.normalizedSeedSQL);
    } else {
      seedSQLMap.set(config.version, "");
    }
  }
  // F-003: Store original SQL in Maps
  originalMigrationSQLMap.set(config.version, config.originalMigrationSQL);
  originalSeedSQLMap.set(config.version, config.originalSeedSQL);
}
```

**Problem**:

- Maps are only populated from `releaseConfigs` (user-provided releases)
- `releaseRows` (from metadata database) contain original SQL for existing releases
- When opening an existing database, releases in metadata but not in `releaseConfigs` won't have their original SQL in the Maps
- This breaks two-tier validation for those releases

**Solution**:

- After loading `releaseRows` from metadata, populate Maps from `releaseRows` as well
- This ensures all existing releases have their original SQL available for validation
- Handle null values (old databases without original SQL)

---

## Implementation Plan

### File Changes

| File                             | Changes                                                 |
| -------------------------------- | ------------------------------------------------------- |
| `src/release/release-manager.ts` | Add loop to populate original SQL Maps from releaseRows |

### Pseudo-Code

```typescript
// In openReleaseDB() function, after loading releaseRows (around line 243)

// F-003: Populate original SQL Maps from metadata database
// TASK-410: Load original SQL from releaseRows for existing releases
for (const row of releaseRows) {
  if (row.version === DEFAULT_VERSION) continue;

  // Populate originalMigrationSQLMap from metadata
  if (row.originalMigrationSQL !== null) {
    // Only set if not already set by releaseConfigs (releaseConfigs takes precedence)
    if (!originalMigrationSQLMap.has(row.version)) {
      originalMigrationSQLMap.set(row.version, row.originalMigrationSQL);
    }
  }

  // Populate originalSeedSQLMap from metadata
  if (row.originalSeedSQL !== null) {
    // Only set if not already set by releaseConfigs (releaseConfigs takes precedence)
    if (!originalSeedSQLMap.has(row.version)) {
      originalSeedSQLMap.set(row.version, row.originalSeedSQL);
    }
  }
}
```

### Key Implementation Details

1. **Placement**: Add this loop after the existing `releaseConfigs` loop (around line 243)
2. **Precedence**: `releaseConfigs` takes precedence (user-provided releases override metadata)
3. **Null Handling**: Check `originalMigrationSQL !== null` and `originalSeedSQL !== null` before setting
4. **Skip DEFAULT_VERSION**: The default version should not be in the Maps
5. **Idempotent**: Use `Map.has()` check to avoid overwriting existing values

### Three-Phase Pattern

```typescript
// 1. Input: releaseRows already loaded from metadata
// No additional input needed

// 2. Core: Populate Maps from releaseRows
for (const row of releaseRows) {
  if (row.version === DEFAULT_VERSION) continue;

  // Populate originalMigrationSQLMap
  if (
    row.originalMigrationSQL !== null &&
    !originalMigrationSQLMap.has(row.version)
  ) {
    originalMigrationSQLMap.set(row.version, row.originalMigrationSQL);
  }

  // Populate originalSeedSQLMap
  if (row.originalSeedSQL !== null && !originalSeedSQLMap.has(row.version)) {
    originalSeedSQLMap.set(row.version, row.originalSeedSQL);
  }
}

// 3. Output: Maps now contain original SQL from both releaseConfigs and releaseRows
```

---

## Test Plan

### Unit Tests

No new unit tests needed - this is simple Map population logic.

### E2E Tests

**Test scenarios to verify**:

1. **E2E-T410-01: Existing database with original SQL in metadata**
   - Create a database with releases (v1.0.0, v1.1.0)
   - Open database without providing releases in options
   - Verify originalMigrationSQLMap contains both versions from metadata
   - Verify originalSeedSQLMap contains both versions from metadata

2. **E2E-T410-02: Mixed source (releaseConfigs + metadata)**
   - Create a database with releases v1.0.0, v1.1.0
   - Open database with v1.2.0 in releaseConfigs
   - Verify v1.0.0 and v1.1.0 original SQL loaded from metadata
   - Verify v1.2.0 original SQL loaded from releaseConfigs
   - Verify Maps contain all three versions

3. **E2E-T410-03: Old database without original SQL (null values)**
   - Open old database where original SQL columns are null
   - Verify Maps don't contain entries for null values
   - Verify two-tier validation falls back to simple hash comparison

4. **E2E-T410-04: releaseConfigs overrides metadata**
   - Create database with v1.0.0 in metadata
   - Open database with different v1.0.0 SQL in releaseConfigs
   - Verify releaseConfigs SQL takes precedence
   - Verify Map contains releaseConfigs SQL, not metadata SQL

### Verification Steps

1. Run `npm run test` to ensure existing tests pass
2. Manually test with existing database - verify Maps populated
3. Manually test with mixed sources - verify precedence works correctly
4. Manually test with old database - verify null handling works

---

## Risks & Considerations

1. **Map Size**: For databases with many releases, Maps could grow large. This is acceptable because:
   - Maps are indexed by version string (O(1) lookup)
   - Original SQL is typically small (< 10KB per version)
   - Memory usage is acceptable for the use case

2. **Precedence Order**: `releaseConfigs` takes precedence over `releaseRows` because:
   - User-provided releases should override metadata
   - This allows developers to test with different SQL without modifying metadata
   - Matches existing behavior for `migrationSQL` and `seedSQL` Maps

3. **Null Values**: Old databases may have `null` for original SQL. Handled by:
   - Checking `!== null` before setting
   - Two-tier validation already handles null case (falls back to simple hash comparison)

4. **Idempotency**: Using `Map.has()` check ensures:
   - Values are not overwritten
   - Loop can be called multiple times without side effects
   - Future code changes won't break this logic

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
- [ ] Design docs updated if implementation differed
- [x] Task catalog marked complete with spec link

---

## Notes

**Why populate from releaseRows?**

- Existing databases have releases in metadata that may not be in `releaseConfigs`
- Two-tier validation requires original SQL for ALL releases in the database
- Without this, validation would fail for releases not in `releaseConfigs`

**Why precedence for releaseConfigs?**

- User-provided releases should override metadata (allows testing)
- Matches existing behavior for other Maps
- Prevents accidental overwriting of intentional changes

**Backward Compatibility**:

- Old databases with null original SQL are handled correctly
- Two-tier validation falls back to simple hash comparison when original SQL is null
- No migration needed - null values are simply skipped

---

**Created**: 2026-01-26
**Last Updated**: 2026-01-26

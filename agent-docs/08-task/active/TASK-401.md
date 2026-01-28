# TASK-401: [Schema] Add Original SQL Columns to Release Table

**Status**: APPROVED
**Priority**: P0 (Blocker)
**Estimated**: 3 hours
**Owner**: S8 Worker
**Dependencies**: None

---

## Overview

Add `originalMigrationSQL` and `originalSeedSQL` columns to the metadata database's `release` table to support two-tier SQL validation for Feature F-003. This schema change enables:

- Fast path validation: `trim()` + hash compare (< 0.1ms)
- Slow path validation: SQLite `prepare()` normalization (1-5ms) on hash mismatch
- Auto-update hashes for whitespace-only changes
- Enhanced error messages with SQL diff for actual structure changes

---

## Analysis

### Context from Design Docs

**From `agent-docs/05-design/02-schema/01-database.md`**:

The `release` table in `release.sqlite3` currently stores:

- `id`, `version`, `migrationSQLHash`, `seedSQLHash`, `mode`, `createdAt`

**F-003 New Columns Required**:

- `originalMigrationSQL` (TEXT): Stores the original migration SQL at release time
- `originalSeedSQL` (TEXT): Stores the original seed SQL at release time

**Purpose**: These columns enable two-tier validation:

1. **Tier 1 (Fast)**: Compare hashes of trimmed SQL (< 0.1ms)
2. **Tier 2 (Slow)**: Normalize both original and current SQL via `prepare()`, compare results
   - If normalized SQL matches: Auto-update hash (whitespace-only change)
   - If normalized SQL differs: Throw enhanced error with SQL diff

**Migration Path** (from design doc):

```sql
-- v2.2.0: Add original SQL columns
ALTER TABLE release ADD COLUMN originalMigrationSQL TEXT;
ALTER TABLE release ADD COLUMN originalSeedSQL TEXT;

-- Backfill existing rows with current SQL (if available)
-- New rows will have original SQL populated automatically
```

### Current Implementation

**File: `src/release/constants.ts`** (Lines 6-13):

```typescript
export const RELEASE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS release (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL,
  migrationSQLHash TEXT,
  seedSQLHash TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('release', 'dev')),
  createdAt TEXT NOT NULL
);`;
```

**File: `src/release/release-manager.ts`** (Lines 134-149):

- `ensureMetadata()` function creates tables using `RELEASE_TABLE_SQL`
- Only creates tables if they don't exist (`CREATE TABLE IF NOT EXISTS`)
- Inserts default row with `migrationSQLHash` and `seedSQLHash` as NULL

**Gap Analysis**:

1. New columns not included in `RELEASE_TABLE_SQL`
2. No migration logic to add columns to existing databases
3. No backfill logic for existing releases
4. Default row insertion doesn't include new columns

---

## Implementation Plan

### File Changes

| File                                            | Changes                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `src/release/constants.ts`                      | Update `RELEASE_TABLE_SQL` to include new columns                  |
| `src/release/release-manager.ts`                | Add migration logic in `ensureMetadata()` to alter existing tables |
| `src/release/release-manager.ts`                | Update default row insertion to include new columns                |
| `agent-docs/05-design/02-schema/01-database.md` | Schema already documented (no changes needed)                      |

### Pseudo-Code

**1. Update `src/release/constants.ts`**:

```typescript
export const RELEASE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS release (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL,
  migrationSQLHash TEXT,
  seedSQLHash TEXT,
  originalMigrationSQL TEXT,      // F-003: Original migration SQL at release time
  originalSeedSQL TEXT,            // F-003: Original seed SQL at release time
  mode TEXT NOT NULL CHECK (mode IN ('release', 'dev')),
  createdAt TEXT NOT NULL
);`;

// New migration SQL for F-003
export const RELEASE_MIGRATION_F003_SQL = [
  "ALTER TABLE release ADD COLUMN originalMigrationSQL TEXT;",
  "ALTER TABLE release ADD COLUMN originalSeedSQL TEXT;",
];
```

**2. Update `src/release/release-manager.ts`**:

```typescript
import { RELEASE_MIGRATION_F003_SQL } from "./constants";

const ensureMetadata = async (): Promise<void> => {
  // 1. Create table with new schema (IF NOT EXISTS = idempotent)
  await metaExec(RELEASE_TABLE_SQL);
  await metaExec(RELEASE_INDEX_SQL);
  await metaExec(RELEASE_LOCK_TABLE_SQL);

  // 2. Migrate existing tables (add new columns if missing)
  // Check if columns already exist (avoid errors on re-run)
  const tableInfo = await metaQuery<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'release'",
  );

  if (tableInfo.length > 0) {
    const createSQL = tableInfo[0].sql;
    // Apply migrations if columns missing
    if (!createSQL.includes("originalMigrationSQL")) {
      await metaExec(RELEASE_MIGRATION_F003_SQL[0]);
      console.debug("[ensureMetadata] added originalMigrationSQL column");
    }
    if (!createSQL.includes("originalSeedSQL")) {
      await metaExec(RELEASE_MIGRATION_F003_SQL[1]);
      console.debug("[ensureMetadata] added originalSeedSQL column");
    }
  }

  // 3. Insert default row (idempotent: checks if exists)
  const defaults = await metaQuery<{ id: number }>(
    "SELECT id FROM release WHERE version = ? LIMIT 1",
    [DEFAULT_VERSION],
  );
  if (defaults.length === 0) {
    await metaExec(
      "INSERT INTO release (version, migrationSQLHash, seedSQLHash, originalMigrationSQL, originalSeedSQL, mode, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        DEFAULT_VERSION,
        null,
        null,
        null,
        null,
        "release",
        new Date().toISOString(),
      ],
    );
  }
};
```

---

## Test Plan

### Unit Tests

**Test: `constants.ts` exports**:

- Verify `RELEASE_TABLE_SQL` includes new columns
- Verify `RELEASE_MIGRATION_F003_SQL` contains correct ALTER statements

**Test: `ensureMetadata()` migration**:

- Test fresh database: Columns present in CREATE TABLE
- Test existing database (v2.1.0): Columns added via ALTER TABLE
- Test re-run: Idempotent (no errors on second run)
- Test default row insertion: Includes new columns (NULL values)

**Test: Backward compatibility**:

- Existing v2.1.0 databases can be opened
- Migration runs automatically on first open
- No data loss during migration

### E2E Tests

**Test: Fresh database creation**:

```typescript
test("creates release table with F-003 columns", async () => {
  const db = await openDB("test-fresh", {
    releases: [
      {
        version: "1.0.0",
        migrationSQL: "CREATE TABLE users (id INTEGER PRIMARY KEY);",
      },
    ],
  });

  // Verify columns exist
  const result = await db.query(`
    SELECT sql FROM sqlite_master
    WHERE type = 'table' AND name = 'release'
  `);

  expect(result[0].sql).toContain("originalMigrationSQL");
  expect(result[0].sql).toContain("originalSeedSQL");
});
```

**Test: Migration from v2.1.0**:

```typescript
test("migrates existing v2.1.0 database to v2.2.0 schema", async () => {
  // 1. Create v2.1.0 database (simulated by removing columns)
  // 2. Open with v2.2.0 code
  // 3. Verify columns added via ALTER TABLE
  // 4. Verify existing data preserved
});
```

**Test: Idempotent migration**:

```typescript
test("migration can be run multiple times without errors", async () => {
  // 1. Open database (triggers migration)
  // 2. Close and reopen (triggers migration again)
  // 3. Verify no errors, no duplicate columns
});
```

### Verification Steps

1. **Manual verification**:
   - Open browser DevTools
   - Create a fresh database with releases
   - Inspect `release.sqlite3` metadata table
   - Verify `originalMigrationSQL` and `originalSeedSQL` columns exist

2. **Migration verification**:
   - Use existing v2.1.0 database (if available)
   - Open with v2.2.0 code
   - Verify columns added automatically
   - Verify existing releases still accessible

3. **Backward compatibility**:
   - Create database with v2.1.0 code
   - Open with v2.2.0 code
   - Verify migration succeeds
   - Verify no data loss

---

## Risks & Considerations

### Risk 1: ALTER TABLE fails on existing databases

**Scenario**: User has large number of releases, ALTER TABLE takes time or fails.

**Mitigation**:

- ALTER TABLE for adding columns is fast in SQLite (metadata operation only)
- No data rewriting required (adding TEXT columns to existing rows)
- NULL values used by default (no backfill needed yet)

**Test**: Verify migration completes in < 100ms for databases with 100+ releases.

### Risk 2: Column already exists error

**Scenario**: Migration runs twice, throws "duplicate column name" error.

**Mitigation**:

- Check if column exists before ALTER TABLE (via `sqlite_master` or `PRAGMA table_info`)
- Use `CREATE TABLE IF NOT EXISTS` for new databases
- Idempotent migration logic

**Test**: Run `ensureMetadata()` twice, verify no errors.

### Risk 3: Default row insertion fails

**Scenario**: INSERT statement expects new columns, but old schema doesn't have them.

**Mitigation**:

- Migration runs before INSERT (in same `ensureMetadata()` function)
- Columns guaranteed to exist before INSERT
- NULL values for new columns in default row

**Test**: Verify default row inserted successfully after migration.

### Risk 4: Backward compatibility break

**Scenario**: v2.2.0 code cannot open v2.1.0 databases.

**Mitigation**:

- Migration runs automatically on first open
- No manual intervention required
- Existing data preserved

**Test**: E2E test with v2.1.0 database opened by v2.2.0 code.

---

## Definition of Done

- [x] All file changes implemented
  - [x] `RELEASE_TABLE_SQL` updated with new columns
  - [x] `RELEASE_MIGRATION_F003_SQL` constant added
  - [x] `ensureMetadata()` migration logic implemented
  - [x] Default row insertion updated
- [ ] All tests passing (unit + E2E)
  - [ ] Unit tests for constants
  - [ ] Unit tests for `ensureMetadata()` migration
  - [ ] E2E test for fresh database
  - [ ] E2E test for v2.1.0 migration
  - [ ] E2E test for idempotent migration
- [ ] Code review checklist passed:
  - [ ] Three-Phase Pattern (1. Input / 2. Core / 3. Output)
  - [ ] No code duplication (2+ times)
  - [ ] Functions <= 30 lines
  - [ ] Nesting <= 3 levels
  - [ ] Parameters <= 4
  - [ ] TSDoc comments complete
- [x] Design docs updated if implementation differed
  - [x] Schema documentation already includes F-003 columns (no update needed)
- [ ] Task catalog marked complete with spec link

---

## Notes

**Migration Strategy**:

- This is a **breaking schema change** for existing databases
- Migration runs automatically on first `openDB()` call
- No user intervention required (transparent upgrade)
- Original SQL columns will be NULL for existing releases (backfilled in TASK-402)

**Interaction with Future Tasks**:

- TASK-402: Will populate `originalMigrationSQL` and `originalSeedSQL` when creating releases
- TASK-421: Will test backward compatibility with pre-F-003 databases

**Performance Considerations**:

- ALTER TABLE for adding columns is fast (< 10ms typically)
- No data rewriting required (metadata operation only)
- Migration only runs once per database (first open with v2.2.0)

**Testing Strategy**:

- Unit tests: Mock metadata database operations
- E2E tests: Real OPFS operations with SQLite
- Use `beforeEach` to create fresh databases for isolation

---

**Created**: 2026-01-26
**Last Updated**: 2026-01-26
**Approved**: 2026-01-26

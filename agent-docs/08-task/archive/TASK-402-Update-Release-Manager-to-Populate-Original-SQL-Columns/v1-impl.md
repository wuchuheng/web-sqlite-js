# TASK-402: Update Release Manager to Populate Original SQL Columns

**Status**: ✅ COMPLETED
**Priority**: P0 (Blocker)
**Estimated**: 4 hours
**Owner**: S8 Worker
**Dependencies**: TASK-401 (Schema columns added)

---

## Overview

Update the release manager to store original SQL (migration and seed) when creating releases. This enables F-003 two-tier validation: the original SQL is stored at release time and used later for normalized comparison when hash mismatches occur.

---

## Analysis

### Context from Design Docs

From `agent-docs/05-design/02-schema/01-database.md`:

- `originalMigrationSQL TEXT` column stores original migration SQL at release time
- `originalSeedSQL TEXT` column stores original seed SQL at release time
- These columns are used for two-tier validation (fast path: trim+hash, slow path: prepare normalize)

From `agent-docs/05-design/03-modules/release-management.md`:

- `validateAndHashReleases()` should store original SQL in `ReleaseConfigWithHash`
- `applyVersion()` should insert original SQL into metadata database
- In-memory Maps (`originalMigrationSQLMap`, `originalSeedSQLMap`) should be populated
- `DatabaseRecord` type should include original SQL Maps

### Current Implementation

**Current State**:

- `validateAndHashReleases()` in `hash-utils.ts` computes hashes but doesn't store original SQL
- `applyVersion()` in `release-manager.ts` inserts metadata without original SQL columns
- `ReleaseConfigWithHash` type lacks `originalMigrationSQL` and `originalSeedSQL` fields
- `ReleaseRow` type doesn't include original SQL columns from database
- `DatabaseRecord` type only has `migrationSQL` and `seedSQL` Maps

**Missing**:

- Original SQL fields in `ReleaseConfigWithHash` type
- Original SQL fields in `ReleaseRow` type (for reading from metadata)
- Original SQL storage in `validateAndHashReleases()`
- Original SQL insertion in `applyVersion()`
- Original SQL Maps creation and population
- `DatabaseRecord` type updates

---

## Implementation Plan

### File Changes

| File                             | Changes                                                                                                        |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/types/DB.ts`                | Add `originalMigrationSQL` and `originalSeedSQL` to `DatabaseRecord` interface                                 |
| `src/release/types.ts`           | Add `originalMigrationSQL` and `originalSeedSQL` to `ReleaseConfigWithHash` and `ReleaseRow` types             |
| `src/release/hash-utils.ts`      | Store original SQL in `validateAndHashReleases()` result                                                       |
| `src/release/release-manager.ts` | Update `applyVersion()` to insert original SQL, create and populate original SQL Maps, update `DatabaseRecord` |

### Pseudo-Code

```typescript
// src/types/DB.ts
export interface DatabaseRecord {
  migrationSQL: Map<string, string>;
  seedSQL: Map<string, string>;
  originalMigrationSQL: Map<string, string>; // F-003: Add to record
  originalSeedSQL: Map<string, string | null>; // F-003: Add to record
  db: DBInterface;
}
```

```typescript
// src/release/types.ts
export type ReleaseConfigWithHash = ReleaseConfig & {
  migrationSQLHash: string;
  seedSQLHash: string | null;
  normalizedSeedSQL: string | null;
  originalMigrationSQL: string; // F-003: Add original SQL
  originalSeedSQL: string | null; // F-003: Add original SQL
};

export type ReleaseRow = {
  id: number;
  version: string;
  migrationSQLHash: string | null;
  seedSQLHash: string | null;
  originalMigrationSQL: string | null; // F-003: Add from metadata
  originalSeedSQL: string | null; // F-003: Add from metadata
  mode: "release" | "dev";
  createdAt: string;
};
```

```typescript
// src/release/hash-utils.ts
export const validateAndHashReleases = async (
  releases?: ReleaseConfig[],
): Promise<ReleaseConfigWithHash[]> => {
  // ... existing validation logic ...

  result.push({
    ...release,
    seedSQL: normalizedSeedSQL,
    normalizedSeedSQL,
    migrationSQLHash,
    seedSQLHash,
    originalMigrationSQL: migrationSQL, // F-003: Store original
    originalSeedSQL: normalizedSeedSQL, // F-003: Store original
  });

  return result;
};
```

```typescript
// src/release/release-manager.ts
// In openReleaseDB function:

// 1. Create original SQL Maps (after migrationSQLMap declaration)
const originalMigrationSQLMap = new Map<string, string>();
const originalSeedSQLMap = new Map<string, string | null>();

// 2. Query metadata to include original SQL columns
const latestRows = await metaQuery<ReleaseRow>(
  "SELECT id, version, migrationSQLHash, seedSQLHash, originalMigrationSQL, originalSeedSQL, mode, createdAt FROM release ORDER BY id DESC LIMIT 1",
);

// 3. Populate Maps from release configs (existing releases)
for (const config of releaseConfigs) {
  originalMigrationSQLMap.set(config.version, config.originalMigrationSQL);
  originalSeedSQLMap.set(config.version, config.originalSeedSQL);
}

// 4. Update applyVersion to insert original SQL
await metaExec(
  "INSERT INTO release (version, migrationSQLHash, seedSQLHash, originalMigrationSQL, originalSeedSQL, mode, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
  [
    config.version,
    config.migrationSQLHash,
    config.seedSQLHash,
    config.originalMigrationSQL, // F-003: Insert original SQL
    config.originalSeedSQL, // F-003: Insert original SQL
    mode,
    new Date().toISOString(),
  ],
);

// Store original SQL in Maps
originalMigrationSQLMap.set(config.version, config.originalMigrationSQL);
originalSeedSQLMap.set(config.version, config.originalSeedSQL);

// 5. Update DatabaseRecord to include original SQL Maps
const databaseRecord: DatabaseRecord = {
  migrationSQL: migrationSQLMap,
  seedSQL: seedSQLMap,
  originalMigrationSQL: originalMigrationSQLMap, // F-003: Add to record
  originalSeedSQL: originalSeedSQLMap, // F-003: Add to record
  db,
};
```

---

## Test Plan

### Unit Tests

**New: Original SQL Storage Test**

```typescript
// tests/unit/release/original-sql-storage.unit.test.ts (NEW FILE)
describe("validateAndHashReleases - Original SQL Storage", () => {
  it("should store original SQL in ReleaseConfigWithHash", async () => {
    const releases = [
      {
        version: "1.0.0",
        migrationSQL: "CREATE TABLE users (id INTEGER PRIMARY KEY);",
        seedSQL: "INSERT INTO users VALUES (1);",
      },
    ];

    const result = await validateAndHashReleases(releases);

    expect(result[0].originalMigrationSQL).toBe(
      "CREATE TABLE users (id INTEGER PRIMARY KEY);",
    );
    expect(result[0].originalSeedSQL).toBe("INSERT INTO users VALUES (1);");
  });

  it("should handle null seedSQL for original SQL", async () => {
    const releases = [
      {
        version: "1.0.0",
        migrationSQL: "CREATE TABLE users (id INTEGER PRIMARY KEY);",
      },
    ];

    const result = await validateAndHashReleases(releases);

    expect(result[0].originalSeedSQL).toBeNull();
  });
});
```

### E2E Tests

**Extended: Release Application Test**

```typescript
// tests/e2e/release.e2e.test.ts (EXTEND EXISTING)
describe("F-003: Original SQL Storage", () => {
  it("should store original SQL in metadata database", async () => {
    const db = await openDB("test-original-sql", {
      releases: [
        {
          version: "1.0.0",
          migrationSQL: "CREATE TABLE test (id INTEGER);",
          seedSQL: "INSERT INTO test VALUES (1);",
        },
      ],
    });

    // Query metadata directly to verify original SQL stored
    const registry = globalNamespace.databases["test-original-sql"];
    expect(registry.originalMigrationSQL.get("1.0.0")).toBe(
      "CREATE TABLE test (id INTEGER);",
    );
    expect(registry.originalSeedSQL.get("1.0.0")).toBe(
      "INSERT INTO test VALUES (1);",
    );

    await db.close();
  });

  it("should populate original SQL Maps on database open", async () => {
    // First open: create release
    await openDB("test-maps", {
      releases: [
        {
          version: "1.0.0",
          migrationSQL: "CREATE TABLE items (id INTEGER);",
        },
      ],
    });

    // Second open: verify Maps populated from metadata
    const db = await openDB("test-maps");
    const registry = globalNamespace.databases["test-maps"];

    expect(registry.originalMigrationSQL.has("1.0.0")).toBe(true);
    expect(registry.originalMigrationSQL.get("1.0.0")).toBe(
      "CREATE TABLE items (id INTEGER);",
    );

    await db.close();
  });
});
```

### Verification Steps

1. Create a release with migration and seed SQL
2. Query metadata database directly to verify `originalMigrationSQL` and `originalSeedSQL` columns populated
3. Access global namespace to verify original SQL Maps populated
4. Re-open database to verify Maps loaded from metadata
5. Run existing E2E tests to ensure no regressions

---

## Risks & Considerations

1. **Backward Compatibility**: Databases created before F-003 will have NULL values for original SQL columns
   - **Mitigation**: Use NULL-safe queries and Map population logic

2. **Memory Usage**: Storing original SQL in Maps doubles memory for release configs
   - **Mitigation**: Original SQL is reference to same string object (minimal overhead)

3. **Type Consistency**: Ensure all type definitions updated consistently across files
   - **Mitigation**: Compile-time TypeScript verification

4. **Map Population Timing**: Ensure Maps populated before DatabaseRecord created
   - **Mitigation**: Follow existing pattern for `migrationSQLMap` and `seedSQLMap`

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

- This task implements the data storage layer for F-003 two-tier validation
- Original SQL is captured at release time (immutable) to enable later normalization comparison
- Maps are populated from both new releases (from configs) and existing releases (from metadata)
- The next task (TASK-403) will add the PREPARE message type for SQL normalization

---

**Created**: 2026-01-26
**Last Updated**: 2026-01-26

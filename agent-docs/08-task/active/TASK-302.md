# TASK-302: T-002 - In-Memory SQL & Global Namespace

> **Feature**: F-002 - v2.1.0 Flat OPFS Structure
> **Status**: 📋 Spec Created - Pending Approval
> **Created**: 2026-01-12
> **Dependencies**: TASK-301 ✅ COMPLETE

---

## 1. Boundary

### Files to Modify

- `src/types/DB.ts` - Add DatabaseRecord interface
- `src/types/global.ts` - Update WebSqliteNamespace.databases type
- `src/registry/database-registry.ts` - Store DatabaseRecord instead of DBInterface
- `src/release/release-manager.ts` - Populate SQL Maps on openDB()
- `src/main.ts` - Update DatabaseRegistry.register() call

### Files to Read (Context)

- `src/global/namespace.ts` - Global namespace implementation
- `src/release/constants.ts` - DEFAULT_VERSION
- `src/release/types.ts` - ReleaseConfigWithHash

### Out of Scope

- Auto-migration system (Task T-003)
- SQL file reading from v2.0.0 structure (Task T-003)

---

## 2. Acceptance Criteria

- [ ] `DatabaseRecord` interface defined with migrationSQL, seedSQL Maps, and db
- [ ] Global namespace type updated to `Record<string, DatabaseRecord>`
- [ ] Database registry stores and returns DatabaseRecord
- [ ] migrationSQL Map populated with version → migration SQL mapping
- [ ] seedSQL Map populated with version → seed SQL mapping
- [ ] All existing tests pass with new type structure
- [ ] TypeScript compilation passes without errors

---

## 3. Design

### 3.1 DatabaseRecord Interface

**New interface in `src/types/DB.ts`**:

```typescript
/**
 * Record containing database instance and its release SQL mappings.
 * Used in global namespace for v2.1.0+ to provide access to migration SQL.
 */
export interface DatabaseRecord {
  /**
   * Map of version → migration SQL
   * Key: semantic version (e.g., "1.0.0")
   * Value: migration SQL string
   */
  migrationSQL: Map<string, string>;

  /**
   * Map of version → seed SQL
   * Key: semantic version (e.g., "1.0.0")
   * Value: seed SQL string or undefined if no seed
   */
  seedSQL: Map<string, string>;

  /**
   * Database interface instance
   */
  db: DBInterface;
}
```

### 3.2 Global Namespace Type Update

**Update in `src/types/global.ts`**:

```typescript
// Before (v2.0.0)
readonly databases: Record<string, DBInterface>;

// After (v2.1.0)
readonly databases: Record<string, DatabaseRecord>;
```

### 3.3 Database Registry Update

**Update in `src/registry/database-registry.ts`**:

```typescript
// Before (v2.0.0)
import type { DBInterface } from "../types/DB";

class DatabaseRegistryImpl {
  private databases: Map<string, DBInterface> = new Map();

  register(filename: string, db: DBInterface): void {
    // ...
    this.databases.set(normalized, db);
    // ...
  }

  get(filename: string): DBInterface | undefined {
    // ...
    return this.databases.get(normalized);
  }
}

// After (v2.1.0)
import type { DBInterface, DatabaseRecord } from "../types/DB";

class DatabaseRegistryImpl {
  // v2.1.0: Store DatabaseRecord instead of DBInterface
  private databases: Map<string, DatabaseRecord> = new Map();

  // v2.1.0: Accept DatabaseRecord in register()
  register(filename: string, record: DatabaseRecord): void {
    // ...
    this.databases.set(normalized, record);
    // ...
  }

  // v2.1.0: Return DatabaseRecord or undefined
  get(filename: string): DatabaseRecord | undefined {
    // ...
    return this.databases.get(normalized);
  }
}
```

**Update namespace sync**:

```typescript
// Before (v2.0.0)
const databasesRecord: Record<string, DBInterface> = {};
for (const [name, dbInstance] of this.databases) {
  databasesRecord[name] = dbInstance;
}
globalNamespace._updateDatabases(databasesRecord);

// After (v2.1.0)
const databasesRecord: Record<string, DatabaseRecord> = {};
for (const [name, record] of this.databases) {
  databasesRecord[name] = record;
}
globalNamespace._updateDatabases(databasesRecord);
```

### 3.4 Release Manager SQL Map Population

**Update in `src/release/release-manager.ts`**:

```typescript
// In openReleaseDB(), create SQL Maps
const migrationSQLMap = new Map<string, string>();
const seedSQLMap = new Map<string, string>();

// Populate Maps when applying releases
const applyVersion = async (
  config: ReleaseConfigWithHash,
  mode: "release" | "dev",
): Promise<void> => {
  // ... existing code ...

  // v2.1.0: Store SQL in memory Maps
  migrationSQLMap.set(config.version, config.migrationSQL);
  if (config.normalizedSeedSQL) {
    seedSQLMap.set(config.version, config.normalizedSeedSQL);
  }

  // ... rest of function ...
};

// Create DatabaseRecord for registry
const databaseRecord: DatabaseRecord = {
  migrationSQL: migrationSQLMap,
  seedSQL: seedSQLMap,
  db,
};

// Update registry.register() call in src/main.ts
// Before (v2.0.0):
// DatabaseRegistry.register(normalizedFilename, db);
//
// After (v2.1.0):
// DatabaseRegistry.register(normalizedFilename, databaseRecord);
```

**Note**: For databases with existing releases (from metadata), we also need to populate the Maps:

```typescript
// In openReleaseDB(), after reading releaseRows:
for (const config of releaseConfigs) {
  // Populate SQL Maps for existing releases
  migrationSQLMap.set(config.version, config.migrationSQL);
  if (config.normalizedSeedSQL) {
    seedSQLMap.set(config.version, config.normalizedSeedSQL);
  }
}
```

### 3.5 Data Flow Changes

**v2.1.0 Global Namespace Access Pattern**:

```typescript
// Access database via global namespace
const record = window.__web_sqlite.databases["myapp.sqlite3"];

// Access database instance
const db = record.db;
await db.query("SELECT * FROM users");

// Access migration SQL
const migrationSQL = record.migrationSQL.get("1.0.0");

// Access seed SQL
const seedSQL = record.seedSQL.get("1.0.0");
```

---

## 4. Implementation Steps

1. **Add DatabaseRecord interface to `src/types/DB.ts`**
   - Define `DatabaseRecord` interface
   - Export it for use in other modules

2. **Update `src/types/global.ts`**
   - Change `databases` type from `Record<string, DBInterface>` to `Record<string, DatabaseRecord>`
   - Update JSDoc examples to show `record.db.query()` pattern

3. **Update `src/registry/database-registry.ts`**
   - Change `private databases` type to `Map<string, DatabaseRecord>`
   - Update `register()` to accept `DatabaseRecord`
   - Update `get()` to return `DatabaseRecord | undefined`
   - Update namespace sync to use `DatabaseRecord`

4. **Update `src/release/release-manager.ts`**
   - Create `migrationSQLMap` and `seedSQLMap` in `openReleaseDB()`
   - Populate Maps when iterating through `releaseConfigs`
   - Populate Maps in `applyVersion()` after successful application
   - Create `DatabaseRecord` object
   - Return `DatabaseRecord` instead of just `DBInterface`

5. **Update `src/main.ts`**
   - Update `DatabaseRegistry.register()` call to pass `DatabaseRecord`

6. **Run Tests**
   - Unit tests: `npm run test:unit`
   - E2E tests: `npm run test:e2e`
   - Type check: `npm run typecheck`
   - Lint: `npm run lint`

---

## 5. Testing Strategy

### Unit Tests (if any exist)

- Test `DatabaseRecord` type structure
- Test SQL Map population in release manager

### E2E Tests to Verify

- Global namespace contains `DatabaseRecord` with SQL Maps
- `record.db.query()` access pattern works
- `record.migrationSQL.get()` returns correct SQL
- `record.seedSQL.get()` returns correct SQL or undefined
- All existing E2E tests still pass

### Type Checking

- Verify TypeScript compilation passes
- Verify no type errors in `window.__web_sqlite.databases` access

---

## 6. Risk Analysis

| Risk                     | Likelihood | Impact | Mitigation                        |
| ------------------------ | ---------- | ------ | --------------------------------- |
| Breaking existing tests  | Medium     | High   | Run full test suite after changes |
| Type errors in user code | Low        | Medium | Clear migration guide             |
| SQL Map memory growth    | Low        | Low    | Maps only store string references |

---

## 7. Functional-First Design Check

**Status**: ✅ All functions use functional design patterns

- `DatabaseRecord` - Pure interface (type definition)
- `migrationSQLMap.set()` - Built-in Map method
- `seedSQLMap.set()` - Built-in Map method
- `DatabaseRegistry.register()` - Method with side effects (required for registry)

**No classes or OOP constructs** - All changes are functional or type definitions.

---

## 8. Navigation

**Task Catalog**: [F-002 v2.1.0 Tasks](../../07-tasks/f-002-v2.1.0-tasks.md)

**Related Design Docs**:

- [ADR-0004: Release Versioning System](../../04-adr/0004-release-versioning-system.md)
- [Database Schema](../../05-design/02-schema/01-database.md)
- [Release Management Module](../../05-design/03-modules/release-management.md)
- [Global Namespace](../../03-architecture/01-hld.md#global-namespace)

# F-003 Two-Tier Hash Validation Migration Guide

**Feature**: F-003 Two-Tier Hash Validation
**Version**: v2.2.0
**Last Updated**: 2025-01-26
**Status**: Released

---

## Overview

F-003 introduces a two-tier SQL validation system that enhances hash mismatch detection by distinguishing between:

- **Whitespace-only changes**: Automatically corrected (hash auto-updated)
- **Actual SQL changes**: Enhanced error messages with SQL diffs

This guide helps you migrate existing applications to v2.2.0.

---

## What's New?

### 1. Two-Tier Validation System

**Tier 1: Fast Path** (< 0.1ms)

- Trims whitespace from SQL
- Computes SHA-256 hash
- Compares with stored hash
- If hashes match: validation passes immediately

**Tier 2: Slow Path** (1-5ms, only on mismatch)

- Normalizes SQL using SQLite prepare
- Compares normalized SQL strings
- If normalized SQL matches: auto-update hash (whitespace-only change)
- If normalized SQL differs: throw enhanced error (actual SQL change)

### 2. Enhanced Error Messages

Hash mismatch errors now include:

- SQL truncation (first 200 characters)
- Diff formatting (-/+ for changes)
- Version and SQL type context
- Both original and current SQL

### 3. Original SQL Storage

The metadata database now stores:

- `originalMigrationSQL`: The original SQL at release time
- `originalSeedSQL`: The original seed SQL at release time

These are accessible via `window.__web_sqlite.databases`.

---

## Breaking Changes

### None!

F-003 is **fully backward compatible** with existing databases.

- Existing databases without original SQL columns will be auto-migrated
- The two-tier validation falls back to simple hash comparison for old databases
- No manual intervention required

---

## Migration Steps

### Step 1: Update to v2.2.0

```bash
npm install web-sqlite-js@latest
```

### Step 2: Verify Your Application

No code changes required! The two-tier validation works automatically.

```typescript
// Your existing code works exactly the same
import openDB from "web-sqlite-js";

const db = await openDB("myapp", {
  releases: [
    {
      version: "1.0.0",
      migrationSQL: "CREATE TABLE users (id INTEGER PRIMARY KEY);",
    },
  ],
});
```

### Step 3: Test Whitespace Auto-Update

If you've reformatted your SQL, the hash will auto-update:

```typescript
// Before: Single-line SQL
const oldSQL = "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);";

// After: Multi-line SQL (same semantic meaning)
const newSQL = `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT
  );
`;

// Both will work - hash auto-updates on first open
```

### Step 4: Review Enhanced Errors

If you accidentally change SQL semantics, you'll see enhanced errors:

```
Hash mismatch for 1.0.0 migrationSQL:
Expected: abc123...
Actual: def456...
SQL has changed:
- Original: CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
+ Current:  CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT);
```

---

## New Features

### Access Original SQL via Global Namespace

You can now access the original SQL for each release:

```typescript
const db = await openDB("myapp", {
  releases: [
    {
      version: "1.0.0",
      migrationSQL: "CREATE TABLE items (id INTEGER PRIMARY KEY);",
    },
  ],
});

// Access original SQL via global namespace
const record = window.__web_sqlite.databases["myapp.sqlite3"];
const originalSQL = record.originalMigrationSQL.get("1.0.0");

console.log(originalSQL);
// Output: "CREATE TABLE items (id INTEGER PRIMARY KEY);"
```

**Note**: The `DatabaseRecord` type has changed:

```typescript
// v2.1.0 and earlier
interface DatabaseRecord {
  db: DBInterface;
}

// v2.2.0 (F-003)
interface DatabaseRecord {
  db: DBInterface;
  migrationSQL: Map<string, string>;
  seedSQL: Map<string, string>;
  originalMigrationSQL: Map<string, string>; // NEW
  originalSeedSQL: Map<string, string | null>; // NEW
}
```

---

## Database Migration

### Automatic Schema Migration

When you open an existing database with v2.2.0, the metadata database will be automatically updated:

```sql
-- These ALTER TABLE statements run automatically
ALTER TABLE release ADD COLUMN originalMigrationSQL TEXT;
ALTER TABLE release ADD COLUMN originalSeedSQL TEXT;
```

### What Gets Stored

After migration:

- **New databases**: Original SQL is stored from the first open
- **Existing databases**: Original SQL is `NULL` (not available)

For existing databases without original SQL:

- Tier 2 validation falls back to simple hash comparison
- Enhanced errors are not available (shows simple "hash mismatch" message)
- No impact on functionality

---

## Testing Your Migration

### Test 1: Verify Whitespace Auto-Update

```typescript
// 1. Create database with original SQL
const db1 = await openDB("test-whitespace", {
  releases: [
    {
      version: "1.0.0",
      migrationSQL: "CREATE TABLE test (id INTEGER);",
    },
  ],
});
await db1.close();

// 2. Reopen with reformatted SQL (whitespace-only change)
const db2 = await openDB("test-whitespace", {
  releases: [
    {
      version: "1.0.0",
      migrationSQL: "CREATE TABLE test (\n  id INTEGER\n);",
    },
  ],
});

// Should open successfully (hash auto-updated)
console.log("Success!");
```

### Test 2: Verify Error Enhancement

```typescript
// 1. Create database
const db1 = await openDB("test-error", {
  releases: [
    {
      version: "1.0.0",
      migrationSQL: "CREATE TABLE items (id INTEGER);",
    },
  ],
});
await db1.close();

// 2. Try to change SQL semantics (should throw enhanced error)
try {
  await openDB("test-error", {
    releases: [
      {
        version: "1.0.0",
        migrationSQL: "CREATE TABLE items (id INTEGER, name TEXT);",
      },
    ],
  });
} catch (error) {
  // Should see enhanced error message with SQL diff
  console.error(error.message);
}
```

### Test 3: Verify Namespace Access

```typescript
const db = await openDB("test-namespace", {
  releases: [
    {
      version: "1.0.0",
      migrationSQL: "CREATE TABLE ns (id INTEGER);",
    },
  ],
});

// Access original SQL
const record = window.__web_sqlite.databases["test-namespace.sqlite3"];
console.log(record.originalMigrationSQL.get("1.0.0"));
// Output: "CREATE TABLE ns (id INTEGER);"
```

---

## Performance Impact

### Tier 1 Fast Path

- **Performance**: < 0.1ms
- **When**: Every database open (hash comparison)
- **Impact**: Negligible (same as before)

### Tier 2 Slow Path

- **Performance**: 1-5ms
- **When**: Only on hash mismatch (rare)
- **Impact**: Minimal (only when SQL changes)

### Overall

- **No performance degradation** for normal operations
- **Faster development workflow** (whitespace changes auto-corrected)
- **Better debugging** (enhanced errors show what changed)

---

## Rollback Plan

If you need to rollback to v2.1.0:

### Option 1: Direct Rollback

```bash
npm install web-sqlite-js@2.1.0
```

The v2.1.0 library will:

- Ignore the new `originalMigrationSQL` and `originalSeedSQL` columns
- Use simple hash comparison (same as before)
- Continue to work normally

### Option 2: Clean Slate (If Issues Occur)

If you encounter any issues:

1. **Export your data**:

   ```typescript
   const db = await openDB("myapp");
   const data = await db.query("SELECT * FROM users");
   console.log(data);
   ```

2. **Delete the database**:

   ```typescript
   // In browser console or DevTools
   const root = await navigator.storage.getDirectory();
   const dir = await root.getDirectoryHandle("myapp");
   // Delete directory and recreate
   ```

3. **Recreate with v2.1.0**:
   ```typescript
   import openDB from "web-sqlite-js@2.1.0";
   // Recreate database from scratch
   ```

---

## Troubleshooting

### Issue: "Hash mismatch" error after reformatting SQL

**Solution**: This is expected! The two-tier validation system will auto-update the hash on the first open after reformatting.

```typescript
// First open after reformatting - auto-updates hash
const db = await openDB("myapp", {
  releases: [
    {
      version: "1.0.0",
      migrationSQL: reformattedSQL, // Reformatted SQL
    },
  ],
});

// Second open - uses updated hash (no validation needed)
await db.close();
const db2 = await openDB("myapp", {
  releases: [
    {
      version: "1.0.0",
      migrationSQL: reformattedSQL,
    },
  ],
});
```

### Issue: Enhanced error not showing for old database

**Reason**: Old databases (created before v2.2.0) don't have original SQL stored.

**Solution**: This is expected behavior. For old databases, the system falls back to simple hash comparison.

**Workaround**: If you want enhanced errors for an old database:

1. Export your data
2. Delete the database
3. Recreate with v2.2.0 (original SQL will be stored)

### Issue: TypeScript errors accessing `originalMigrationSQL`

**Reason**: Your `@types/node` or TypeScript version may be outdated.

**Solution**: Update dependencies:

```bash
npm install typescript@latest @types/node@latest
```

---

## FAQ

**Q: Do I need to update my code?**

A: No! F-003 is fully backward compatible. Your existing code will work without changes.

**Q: Will my existing databases break?**

A: No. The migration is automatic and non-destructive.

**Q: Can I disable the two-tier validation?**

A: No, but you don't need to! It's faster for normal operations and only runs Tier 2 when there's a hash mismatch.

**Q: What happens if I have a very old database?**

A: The system will auto-migrate the schema and fall back to simple hash comparison for versions without original SQL.

**Q: Can I access the original SQL for debugging?**

A: Yes! Use `window.__web_sqlite.databases[name].originalMigrationSQL.get(version)`.

---

## Additional Resources

- [F-003 Feature Spec](../01-discovery/features/F-003-sql-normalization-validation.md)
- [Task Catalog](../07-taskManager/02-task-catalog.md)
- [Build and Run Guide](./01-build-and-run.md)

---

## Navigation

**Previous**: [Auto-Migration Strategy](../../04-adr/0008-auto-migration-strategy.md)

**Up**: [Implementation Guide](./01-build-and-run.md)

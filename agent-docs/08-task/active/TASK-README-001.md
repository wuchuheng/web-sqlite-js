# TASK-README-001: Add Migration Config Documentation to README

**Task ID**: TASK-README-001
**Priority**: P1
**Status**: In Progress
**Created**: 2026-01-13
**Dependencies**: None

---

## Overview

Add migration config documentation to README.md to help users understand how to use the release versioning system for database schema migrations.

---

## Context: Release Versioning System

The library has a built-in release versioning system that allows users to:

1. **Define release configurations** with `releases` option in `openDB()`
2. **Track database schema versions** with migration SQL
3. **Seed initial data** with optional seed SQL
4. **Auto-migrate** on database open when new releases are detected

**Key Files**:

- `src/types/DB.ts` - `ReleaseConfig`, `OpenDBOptions` types
- `src/release/release-manager.ts` - Release versioning implementation
- `tests/e2e/release.e2e.test.ts` - E2E tests for releases

---

## Current State Analysis

### README.md Status

The current README does NOT have any documentation about the `releases` option. Users have no way to discover this feature without reading the source code or tests.

**Missing Documentation**:

- `releases` option in `openDB()`
- `ReleaseConfig` type with `version`, `migrationSQL`, `seedSQL`
- How migrations are applied automatically
- How versioning works with OPFS storage
- Hash verification for release integrity

### Existing Test Coverage

| File                                   | Tests | Status | Notes                        |
| -------------------------------------- | ----- | ------ | ---------------------------- |
| `tests/e2e/release.e2e.test.ts`        | 3     | Pass   | Release apply, hash, devTool |
| `tests/e2e/auto-migration.e2e.test.ts` | 5     | Pass   | v2.0.0 → v2.1.0 migration    |

**Total**: 8 E2E tests for release/migration features (all passing)

---

## Specification

### 1. README.md Updates

**Functional Requirements**:

1. Add new "Schema Migrations" section after "Transactions" section
2. Document the `releases` option with clear examples
3. Explain how automatic migrations work
4. Include best practices for schema versioning

**New Section: Schema Migrations**

````markdown
## Schema Migrations

Manage database schema changes across releases using the built-in versioning system. Define releases with migration SQL and optional seed data.

### Basic Usage

```typescript
const db = await openDB("myapp.sqlite3", {
  releases: [
    {
      version: "1.0.0",
      migrationSQL: `
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE
        );
      `,
      seedSQL: `
        INSERT INTO users (name, email) VALUES
        ('Alice', 'alice@example.com'),
        ('Bob', 'bob@example.com');
      `,
    },
    {
      version: "1.1.0",
      migrationSQL: `
        ALTER TABLE users ADD COLUMN created_at TEXT DEFAULT (datetime('now'));
      `,
    },
  ],
});

// Database is now at version 1.1.0 with all migrations applied
const users = await db.query("SELECT * FROM users");
```
````

### How It Works

1. **Version Tracking**: Each release has a semantic version (e.g., "1.0.0")
2. **Automatic Migration**: When opening a database, new releases are applied in order
3. **Hash Verification**: Migration SQL is hashed to prevent tampering
4. **OPFS Storage**: Each version is stored as a separate file (`1.0.0.sqlite3`, `1.1.0.sqlite3`)

### Best Practices

- **Use Semantic Versioning**: Follow `MAJOR.MINOR.PATCH` format
- **Idempotent Migrations**: Each migration should handle re-runs safely
- **Test Migrations**: Always test migrations on a clean database
- **Incremental Changes**: Keep migrations focused on single schema changes

````

**Update Table of Contents**:

Add entry:
```markdown
- [Schema Migrations](#schema-migrations)
````

**Update Features List**:

Add feature:

```markdown
- **Schema Migrations**: Built-in versioning system for database schema changes
```

---

### 2. Additional Examples (Optional)

**Functional Requirements**:

1. Create `examples/migrations.html` demonstrating:
   - Multiple release versions
   - Schema evolution
   - Seed data application

**Example File**: `examples/migrations.html`

```html
<!DOCTYPE html>
<html>
  <head>
    <title>web-sqlite-js: Schema Migrations Example</title>
  </head>
  <body>
    <h1>Schema Migrations</h1>
    <pre id="output"></pre>

    <script type="module">
      import openDB from "https://cdn.jsdelivr.net/npm/web-sqlite-js@2.1.0/dist/index.js";

      const output = document.getElementById("output");

      function log(msg) {
        output.textContent += msg + "\n";
      }

      async function main() {
        log("Opening database with migrations...");

        const db = await openDB("migrations-demo", {
          releases: [
            {
              version: "1.0.0",
              migrationSQL: `
              CREATE TABLE products (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                price REAL
              );
            `,
              seedSQL: `
              INSERT INTO products (name, price) VALUES
              ('Widget', 9.99),
              ('Gadget', 19.99);
            `,
            },
            {
              version: "1.1.0",
              migrationSQL: `
              ALTER TABLE products ADD COLUMN category TEXT DEFAULT 'general';
            `,
            },
            {
              version: "1.2.0",
              migrationSQL: `
              CREATE TABLE orders (
                id INTEGER PRIMARY KEY,
                product_id INTEGER REFERENCES products(id),
                quantity INTEGER
              );
            `,
              seedSQL: `
              INSERT INTO orders (product_id, quantity) VALUES (1, 5);
            `,
            },
          ],
        });

        log("Database opened at latest version!");

        const products = await db.query("SELECT * FROM products");
        log(`Products (${products.length}):`);
        products.forEach((p) =>
          log(`  - ${p.name}: $${p.price} (${p.category})`),
        );

        const orders = await db.query("SELECT * FROM orders");
        log(`Orders (${orders.length}):`);
        orders.forEach((o) => log(`  - Order #${o.id}: ${o.quantity} units`));

        await db.close();
        log("Database closed.");
      }

      main().catch(console.error);
    </script>
  </body>
</html>
```

---

## Definition of Done

**TASK-README-001 is COMPLETE when**:

- [ ] `README.md` updated with "Schema Migrations" section
- [ ] Table of contents updated with migrations link
- [ ] Features list updated with migrations feature
- [ ] `examples/migrations.html` created (optional)
- [ ] Documentation is clear and easy to understand
- [ ] Code examples are copy-paste runnable

---

## Implementation Notes

1. **Functional Design**: This task is documentation-focused. No code changes required.

2. **Placement**: Add "Schema Migrations" section after "Transactions" and before "Debug mode".

3. **User Perspective**: Focus on practical usage, not internal implementation details.

4. **Clarity**: Use simple, clear examples that build understanding incrementally.

---

## References

- `src/types/DB.ts` - `ReleaseConfig`, `OpenDBOptions` type definitions
- `tests/e2e/release.e2e.test.ts` - E2E test examples for releases
- `agent-docs/04-adr/0004-release-versioning-system.md` - ADR for release system
- `README.md` - Main README (to be updated)

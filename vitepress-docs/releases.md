---
outline: deep
---

# Releases (Versioned Migrations)

Releases let you evolve your schema and seed data on the client in a predictable,
versioned way. Each release is immutable and identified by a semantic version
string (`x.x.x` with no leading zeros). The library stores release metadata in a
separate SQLite file and keeps a historical database copy for every version.

## Usage

### 1) Declare immutable releases at startup

```ts
import openDB from "web-sqlite-js";

const db = await openDB("demo.sqlite3", {
  releases: [
    {
      version: "0.0.0",
      migrationSQL: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);",
      seedSQL: "INSERT INTO users (name) VALUES ('Ada');",
    },
    {
      version: "0.0.1",
      migrationSQL: "ALTER TABLE users ADD COLUMN created_at TEXT;",
    },
  ],
});
```

## Validation rules

- Versions must follow `x.x.x` with no leading zeros (for example: `0.0.1`).
- Versions in `releases` must be strictly increasing and unique.
- The version name `default` is reserved and cannot be used in `releases`.
- Archived release rows must be declared in `releases` and their hashes must
  match the stored metadata.
- New versions must be greater than the latest version in metadata.
- `devTool.rollback()` cannot roll back below the latest **release** version.

## Behavior notes

- The latest version (release or dev) is always opened as the active database.
- Migration + seed SQL run inside a single transaction.
- Failed releases clean up their version file and do not update metadata.
- SHA-256 is used to hash `migrationSQL` and `seedSQL` for immutability checks.

## OPFS layout

When you open a database named `demo.sqlite3`, OPFS will look like this:

```
demo.sqlite3/
  release.sqlite3      # Metadata database
  default.sqlite3      # Initial empty database (version "default")
  0.0.0.sqlite3        # Release version 0.0.0
  0.0.1.sqlite3        # Release version 0.0.1
  1.0.0.sqlite3        # Release version 1.0.0
  1.0.1.dev.sqlite3    # Dev version 1.0.1 (marked with .dev suffix)
```

**Note**: `default.sqlite3` is the system-generated base version and is always present. User-provided versions must follow semver format (`x.y.z`).

## Dev Versions

Dev versions created via `db.devTool.release()` are distinguished from release versions:

- **Naming**: Dev versions use the `.dev` suffix (e.g., `1.0.1.dev.sqlite3`)
- **Storage mode**: Marked as "dev" in the metadata database
- **Rollback**: Can be freely rolled back (release versions are protected)

```ts
// Create a dev version
await db.devTool.release({
  version: "1.0.1",
  migrationSQL: "ALTER TABLE users ADD COLUMN age INTEGER;",
});

// The dev version is created as: demo.sqlite3/1.0.1.dev.sqlite3
```

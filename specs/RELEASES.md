# Specification: Release Versioning (OPFS-based)

## Overview

Introduce a release/version system for `web-sqlite-js` that manages SQLite files in OPFS with a metadata database (`release.sqlite3`). Versions can be:

- `release`: immutable versions defined by the `openDB()` configuration.
- `dev`: mutable versions created by dev tooling APIs.
- `default`: a system-generated initial version (empty DB).

All versions are recorded in `release.sqlite3`. The database opened by `openDB()` is always the latest version row (by insert order), regardless of mode.

## Goals

- Keep a strict, auditable release history with immutable SQL hashes for released versions.
- Support dev-only versions for testing and rollback.
- Store migration and seed SQL files alongside each version.
- Always keep historical DBs (no pruning).

## Non-goals

- No SQL normalization or formatting.
- No auto-pruning or cleanup of old versions.
- No parallel query routing across multiple user DBs.

## Public API

### `openDB(filename, { releases?: ReleaseConfig[], debug?: boolean })`

`releases` defines the immutable release history. Each entry is applied only if it is newer than the latest recorded version.

```ts
type ReleaseConfig = {
  version: string; // "x.x.x" (no leading zeros)
  migrationSQL: string;
  seedSQL?: string | null;
};
```

### Dev tooling

`openDB()` returns `DBInterface` with a new `devTool` field:

```ts
type DevTool = {
  release(input: ReleaseConfig): Promise<void>;
  rollback(version: string): Promise<void>;
};
```

- `devTool.release(...)` appends a **dev** version and switches the active DB to it.
- `devTool.rollback(version)` removes dev versions above the target and switches the active DB to the target.

## OPFS Layout

```
demo.sqlite3/
  release.sqlite3
  default.sqlite3
  0.0.0/
    db.sqlite3
    migration.sql
    seed.sql
  0.0.1/
    db.sqlite3
    migration.sql
    seed.sql
  ...
```

Notes:

- The directory name is always `<filename>.sqlite3` (append `.sqlite3` if missing).
- `default.sqlite3` is an empty DB and is always created.
- Per-version SQL files are always written; `seed.sql` is omitted if `seedSQL` is `null`/empty.

## Metadata Database (`release.sqlite3`)

### Table: `release`

```
CREATE TABLE IF NOT EXISTS release (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL,
  migrationSQLHash TEXT,
  seedSQLHash TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('release', 'dev')),
  createdAt TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_release_version ON release(version);
```

### Table: `release_lock`

```
CREATE TABLE IF NOT EXISTS release_lock (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  lockedAt TEXT NOT NULL
);
```

- The latest version is the row with the highest `id`.
- The `default` row has `version = "default"`, `mode = "release"`,
  `migrationSQLHash = NULL`, `seedSQLHash = NULL`.
- `version` must be unique across both `release` and `dev`.

## Worker Connections

- The worker keeps **two** SQLite connections open:
  - **Metadata DB**: `release.sqlite3` (used for locks and release records).
  - **Active DB**: the latest version DB (`default.sqlite3` or `<version>/db.sqlite3`).
- Normal `exec/query/transaction` calls go to the **active DB**.
- Release/rollback logic uses the metadata DB for locking and version bookkeeping, and
  the active DB for migrations/seed execution.
- After a successful release or rollback, the worker **switches** the active DB
  connection to the new latest version.

## Version Rules

- Valid version formats:
  - `default` (system-only)
  - `x.x.x` numeric semver (no leading zeros; `0` allowed)
- Release configs may **not** use `default`.
- Versions must be strictly increasing in `releases` order.
- New versions (release or dev) must be greater than the latest recorded version.

## Hashing

- Algorithm: SHA-256
- Input: raw SQL string as provided (no normalization).
- Encoding: lowercase hex.
- `seedSQL` hash is `NULL` when `seedSQL` is `null`/empty.

## openDB Flow

### 1) Input handling

- Accept `filename` and `{ releases?, debug? }`.
- Validate `filename` is a non-empty string.
- Validate `releases` (if provided):
  - Each entry has `{ version, migrationSQL, seedSQL? }`.
  - `migrationSQL` is a non-empty string; `seedSQL` is string or `null`.
  - `version` is valid semver (`x.x.x`, no leading zeros) and not `default`.
  - Versions are strictly increasing and unique.
- Precompute `migrationSQLHash` and `seedSQLHash` for each entry.
- Normalize `filename` to end with `.sqlite3` (append if missing).

### 2) Processing

- Ensure the OPFS directory:
  - If a file exists with the directory name: throw.
  - If directory does not exist: create it.
- Ensure `default.sqlite3` exists (empty DB).
- Ensure `release.sqlite3` exists:
  - Create `release` and `release_lock` tables if missing.
  - Ensure a `default` row exists; insert if absent.
  - After this step metadata is never empty.
- Load metadata:
  - `latestRow = SELECT * FROM release ORDER BY id DESC LIMIT 1`
  - `releaseRows = SELECT * FROM release WHERE mode='release' ORDER BY id`
- Validate `releases` config (if provided):
  - For every `releaseRows` version (excluding `default`), config must contain an exact match by:
    - version
    - `migrationSQLHash`
    - `seedSQLHash`
  - Config must not include any version `<= latestReleaseVersion` that is not present in `releaseRows`.
  - Any config entry `> latestReleaseVersion` is considered **new** and eligible to apply.
- Apply new release versions:
  - Acquire metadata lock.
  - For each new version in order:
    - Copy latest DB file to `/<version>/db.sqlite3`
    - Write `migration.sql` and optional `seed.sql`
    - Execute migration + seed in a single transaction
    - Insert new `release` row with mode `release`
  - Release lock.

### 3) Return (latest result)

- Determine the latest metadata row after applying new releases.
- Resolve DB path:
  - `default.sqlite3` if `latestRow.version === "default"`
  - `/<version>/db.sqlite3` otherwise
- Open `release.sqlite3` and the resolved DB file in the worker and return `DBInterface`.
- `debug: true` only enables SQL logging and does not remove or alter any files.

### Locking (Release/Dev Operations)

Acquire the lock by opening `release.sqlite3` and running:

```
BEGIN IMMEDIATE;
INSERT OR REPLACE INTO release_lock (id, lockedAt) VALUES (1, <ISO time>);
```

If the lock cannot be acquired (database locked), throw an error like
`"Release operation already in progress"`.

## Applying a Version (Release or Dev)

For a target version `v`:

1. Create `<dir>/<v>/` if missing.
2. Copy latest DB file to `<dir>/<v>/db.sqlite3`.
3. Write `migration.sql` and (if provided) `seed.sql`.
4. Open `<dir>/<v>/db.sqlite3` in worker and run:
   - `BEGIN;`
   - `migrationSQL`
   - `seedSQL` (if provided)
   - `COMMIT;`
5. On failure:
   - `ROLLBACK;`
   - Delete `<dir>/<v>/` directory.
   - Remove any inserted metadata row.
6. On success:
   - Insert metadata row with `mode = 'release'` or `'dev'`.

## Dev Tool: `devTool.release(...)`

Validation:

- `version` must be valid semver, no leading zeros.
- `version` must be greater than latest metadata version.
- `version` must not exist in metadata.

Flow:

- Acquire lock.
- Apply version using the standard apply flow (mode `dev`).
- Switch the active DB to the new version.
- Release lock.

## Dev Tool: `devTool.rollback(version)`

Rules:

- Target `version` must exist in metadata.
- Rollback cannot go below the latest `release` version.
- Only dev versions above the target are removed.

Flow:

- Acquire lock.
- Determine `latestReleaseVersion` from `mode='release'` rows.
- Validate target is `>= latestReleaseVersion`.
- Collect all dev rows with version `> target`.
- Delete their version directories.
- Delete their metadata rows.
- Switch the active DB to the target version.
- Release lock.

## Errors

Raise explicit errors for:

- Directory name conflicts with an existing file.
- Invalid version format or non-increasing order.
- `default` used in config.
- Hash mismatch between config and metadata.
- Missing config for an already released version.
- Attempt to add a version `<= latest`.
- Release/rollback lock contention.
- Rollback below latest release.

## E2E Test Plan

### New test coverage

1. **Default init**
   - `openDB("db-default.sqlite3")` with no `releases`.
   - Assert OPFS contains `db-default.sqlite3/` with `default.sqlite3` and `release.sqlite3`.
   - Assert `release` table contains exactly one row (`version = "default"`).

2. **Release apply and seed**
   - `openDB("db-release.sqlite3", { releases: [...] })` with `0.0.0` and `0.0.1`.
   - `migrationSQL` creates table, `seedSQL` inserts rows.
   - Assert latest DB contains seeded rows.
   - Assert `0.0.0/` and `0.0.1/` contain `db.sqlite3`, `migration.sql`, `seed.sql`.
   - Assert metadata hashes match input SQL.

3. **Release hash mismatch**
   - First run: apply `0.0.0` with SQL A.
   - Second run: call `openDB` with `0.0.0` and SQL B (different hash).
   - Expect error with mismatch message.

4. **Release ordering and format**
   - Invalid ordering (e.g., `0.0.1` then `0.0.0`) should throw.
   - Leading zeros (e.g., `01.0.0`) should throw.

5. **Slot rule validation**
   - Metadata already has `0.0.0` and `0.0.1`.
   - Config includes `0.0.0`, `0.0.1`, and an extra `0.0.2` that is `<= latestReleaseVersion`.
   - Expect error about extra release config in the archived range.

6. **devTool.release**
   - Start with release versions `0.0.0`, `0.0.1`.
   - Call `db.devTool.release({ version: "0.0.2", ... })`.
   - Assert latest DB is `0.0.2` and metadata `mode = "dev"`.

7. **devTool.rollback**
   - After creating dev versions `0.0.2`, `0.0.3`, call `db.devTool.rollback("0.0.2")`.
   - Assert `0.0.3/` directory removed and metadata row deleted.
   - Assert DB opens `0.0.2`.
   - Attempt rollback below latest release and expect error.

8. **Lock contention**
   - Hold a `BEGIN IMMEDIATE` transaction on `release.sqlite3`.
   - Attempt `openDB` release apply or `devTool.release` and expect a lock error.

### Updates to existing E2E tests

- `tests/e2e/exec.e2e.test.ts`
  - Update persistence check to assert directory `filename/` exists.
  - Read `default.sqlite3` (or latest version file when using `releases`) instead of expecting a top-level file.
- `tests/e2e/sqlite3.e2e.test.ts`
  - Add assertion that `release.sqlite3` exists under `filename/`.
- `tests/e2e/error.e2e.test.ts`
  - Add cases for invalid `releases` input, hash mismatch, and ordering errors.
- `tests/e2e/query.e2e.test.ts` and `tests/e2e/transaction.e2e.test.ts`
  - Keep behavior, but ensure the DB name is unique per test run to avoid version conflicts.

## Notes

- Version history is linear; dev and release versions share the same sequence.
- To avoid building a release on top of dev changes, roll back dev versions before adding a release.

## Logging (console.debug)

Add `console.debug` logs at these points (no `debug` flag condition):

- `openDB`: start/end of input validation, and normalized filename.
- OPFS setup: directory creation, `default.sqlite3` creation, `release.sqlite3` init.
- Metadata: latest version detected and release row count.
- Release apply: start/end of each version apply (version number, mode), and lock acquire/release.
- Dev tool: `devTool.release` start/end and `devTool.rollback` start/end (target version).
- Worker: log when switching the active DB to a new latest version.

## JSDoc

- Add standard JSDoc comments for all new public APIs:
  - `openDB` options (`releases`, `debug`)
  - `devTool.release`, `devTool.rollback`
  - `ReleaseConfig` type
  - Any new errors thrown (documented in API docs and types)
- Use concise, explicit descriptions; include parameter details and expected errors.

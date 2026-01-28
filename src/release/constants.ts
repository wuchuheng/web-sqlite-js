/** Release manager constants and schema SQL. */

export const DEFAULT_VERSION = "default";
export const VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export const RELEASE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS release (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL,
  migrationSQLHash TEXT,
  seedSQLHash TEXT,
  originalMigrationSQL TEXT,
  originalSeedSQL TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('release', 'dev')),
  createdAt TEXT NOT NULL
);`;

export const RELEASE_INDEX_SQL =
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_release_version ON release(version);";

export const RELEASE_LOCK_TABLE_SQL = `CREATE TABLE IF NOT EXISTS release_lock (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  lockedAt TEXT NOT NULL
);`;

/**
 * Migration SQL for adding F-003 original SQL columns to existing databases.
 * These ALTER TABLE statements add the originalMigrationSQL and originalSeedSQL
 * columns to databases created before v2.2.0.
 *
 * @example
 * ```ts
 * import { RELEASE_MIGRATION_F003_SQL } from "./constants";
 * for (const sql of RELEASE_MIGRATION_F003_SQL) {
 *   await db.exec(sql);
 * }
 * ```
 */
export const RELEASE_MIGRATION_F003_SQL = [
  "ALTER TABLE release ADD COLUMN originalMigrationSQL TEXT;",
  "ALTER TABLE release ADD COLUMN originalSeedSQL TEXT;",
] as const;

import {
  OpenDBArgs,
  PrepareRequest,
  PrepareResponse,
  SqliteEvent,
  WorkerOpenDBOptions,
} from "../types/message";
import { DatabaseRegistry } from "../registry/database-registry";
import { globalNamespace } from "../global/namespace";
import type {
  DBInterface,
  SQLParams,
  ExecResult,
  ExecParams,
  transactionCallback,
  DbTarget,
  DevTool,
  LogEntry,
  DatabaseRecord,
} from "../types/DB";
import { detectStructure } from "../migration/migration-detector";
import { migrateToV21 } from "../migration/auto-migrator";
import {
  DEFAULT_VERSION,
  RELEASE_INDEX_SQL,
  RELEASE_LOCK_TABLE_SQL,
  RELEASE_TABLE_SQL,
  RELEASE_MIGRATION_F003_SQL,
} from "./constants";
import { validateAndHashReleases } from "./hash-utils";
import {
  copyFileHandle,
  ensureDir,
  ensureFile,
  getDbPathForVersion,
} from "./opfs-utils";
import type {
  ReleaseConfigWithHash,
  ReleaseManagerDeps,
  ReleaseRow,
} from "./types";
import {
  compareVersions,
  getDevVersionFilename,
  getLatestReleaseVersion,
  normalizeFilename,
} from "./version-utils";
import { isLockError } from "./lock-utils";
import { VERSION_RE } from "./constants";
import { validateHashTier1, validateHashTier2 } from "./hash-utils-two-tier";
import { HashMismatchError } from "./errors";

/**
 * Open and prepare a versioned database using release metadata.
 *
 * @param deps - Dependencies required to open the DB and communicate with the worker.
 * @returns A DatabaseRecord containing SQL Maps and DBInterface bound to the latest version.
 */
export const openReleaseDB = async ({
  filename,
  options,
  sendMsg,
  runMutex,
  logDispatcher,
}: ReleaseManagerDeps): Promise<DatabaseRecord> => {
  // 1. Input Validation
  console.debug("[openDB] input validation start");
  if (typeof filename !== "string" || filename.trim() === "") {
    throw new Error("filename must be a non-empty string");
  }

  const releaseConfigs = await validateAndHashReleases(options?.releases);
  const hasReleaseConfig = releaseConfigs.length > 0;
  console.debug("[openDB] input validation end");

  const normalizedFilename = normalizeFilename(filename);
  console.debug(`[openDB] normalized filename: ${normalizedFilename}`);

  // 2. Core: Setup directory structure
  const root = await navigator.storage.getDirectory();
  const baseDir = await ensureDir(root, normalizedFilename);
  console.debug(`[openDB] ensured directory: ${normalizedFilename}`);

  // v2.1.0: Auto-migrate v2.0.0 structure to v2.1.0
  // Declare SQL Maps early for migration (populated below)
  // F-003: Add original SQL Maps
  const migrationSQLMap = new Map<string, string>();
  const seedSQLMap = new Map<string, string>();
  const originalMigrationSQLMap = new Map<string, string>();
  const originalSeedSQLMap = new Map<string, string | null>();

  const structure = await detectStructure(baseDir);
  if (structure.version === "2.0.0") {
    console.debug(`[openDB] v2.0.0 structure detected, migrating to v2.1.0`);
    await migrateToV21(baseDir, migrationSQLMap, seedSQLMap);
    console.debug(`[openDB] migration complete`);
  }

  await ensureFile(baseDir, "default.sqlite3");
  console.debug("[openDB] ensured default.sqlite3");

  const workerOptions: WorkerOpenDBOptions | undefined = options
    ? { debug: options.debug }
    : undefined;

  await sendMsg<void, OpenDBArgs>(SqliteEvent.OPEN, {
    filename: `${normalizedFilename}/release.sqlite3`,
    options: workerOptions,
    target: "meta",
  });
  console.debug("[openDB] opened release.sqlite3");

  // Worker helpers for meta vs active database targets.
  const _exec = async (
    sql: string,
    params?: SQLParams,
    target: DbTarget = "active",
  ): Promise<ExecResult> => {
    return await sendMsg<ExecResult, ExecParams>(SqliteEvent.EXECUTE, {
      sql,
      bind: params,
      target,
    });
  };

  const _query = async <T = unknown>(
    sql: string,
    params?: SQLParams,
    target: DbTarget = "active",
  ): Promise<T[]> => {
    if (typeof sql !== "string" || sql.trim() === "") {
      throw new Error("SQL query must be a non-empty string");
    }
    return await sendMsg<T[], ExecParams>(SqliteEvent.QUERY, {
      sql,
      bind: params,
      target,
    });
  };

  const metaExec = (sql: string, params?: SQLParams) =>
    _exec(sql, params, "meta");
  const metaQuery = <T = unknown>(sql: string, params?: SQLParams) =>
    _query<T>(sql, params, "meta");

  /**
   * Ensures metadata tables exist and applies F-003 migration to add original SQL columns.
   * This function is idempotent and can be called multiple times without side effects.
   *
   * @example
   * ```ts
   * await ensureMetadata();
   * // Tables are created, migrations applied, default row inserted
   * ```
   */
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

  await ensureMetadata();
  console.debug("[openDB] ensured metadata tables and default row");

  // F-003: Query metadata including original SQL columns
  const latestRows = await metaQuery<ReleaseRow>(
    "SELECT id, version, migrationSQLHash, seedSQLHash, originalMigrationSQL, originalSeedSQL, mode, createdAt FROM release ORDER BY id DESC LIMIT 1",
  );
  if (latestRows.length === 0) {
    throw new Error("release metadata not initialized");
  }
  let latestRow = latestRows[0];

  // F-003: Query metadata including original SQL columns
  const releaseRows = await metaQuery<ReleaseRow>(
    "SELECT id, version, migrationSQLHash, seedSQLHash, originalMigrationSQL, originalSeedSQL, mode, createdAt FROM release WHERE mode = 'release' ORDER BY id",
  );

  console.debug(
    `[openDB] latest version: ${latestRow.version}, release rows: ${releaseRows.length}`,
  );

  // v2.1.0: SQL Maps already declared earlier (after baseDir creation, for migration)

  const configByVersion = new Map<string, ReleaseConfigWithHash>();
  for (const config of releaseConfigs) {
    configByVersion.set(config.version, config);
  }

  // TASK-410: Populate original SQL Maps from metadata database
  // F-003: Load original SQL from releaseRows for existing releases FIRST
  // This must happen BEFORE config processing so metadata takes precedence
  for (const row of releaseRows) {
    if (row.version === DEFAULT_VERSION) continue;

    // Populate originalMigrationSQLMap from metadata
    if (row.originalMigrationSQL !== null) {
      // Only set if not already set (metadata takes precedence over config)
      if (!originalMigrationSQLMap.has(row.version)) {
        originalMigrationSQLMap.set(row.version, row.originalMigrationSQL);
      }
    }

    // Populate originalSeedSQLMap from metadata
    if (row.originalSeedSQL !== null) {
      // Only set if not already set (metadata takes precedence over config)
      if (!originalSeedSQLMap.has(row.version)) {
        originalSeedSQLMap.set(row.version, row.originalSeedSQL);
      }
    }
  }

  // v2.1.0: Populate SQL Maps for existing releases from releaseConfigs
  // v2.1.0: Skip if already populated by migration (avoid overwriting migrated SQL)
  // F-003: Populate original SQL Maps (only if not already loaded from metadata)
  for (const config of releaseConfigs) {
    if (!migrationSQLMap.has(config.version)) {
      migrationSQLMap.set(config.version, config.migrationSQL);
    }
    if (!seedSQLMap.has(config.version)) {
      if (config.normalizedSeedSQL) {
        seedSQLMap.set(config.version, config.normalizedSeedSQL);
      } else {
        // Store empty string for versions without seed SQL
        seedSQLMap.set(config.version, "");
      }
    }
    // F-003: Store original SQL in Maps (only if not already loaded from metadata)
    // Metadata takes precedence over config because it has the TRUE original SQL
    if (!originalMigrationSQLMap.has(config.version)) {
      originalMigrationSQLMap.set(config.version, config.originalMigrationSQL);
    }
    if (!originalSeedSQLMap.has(config.version)) {
      originalSeedSQLMap.set(config.version, config.originalSeedSQL);
    }
  }

  // v2.1.0: Map version to mode for proper file naming (dev vs release)
  const versionToModeMap = new Map<string, "release" | "dev">();
  for (const row of releaseRows) {
    if (row.version !== DEFAULT_VERSION) {
      versionToModeMap.set(row.version, row.mode as "release" | "dev");
    }
  }

  const latestReleaseVersion = getLatestReleaseVersion(
    releaseRows.filter((row) => row.version !== DEFAULT_VERSION),
  );

  // F-003: Two-tier validation (TASK-409)
  if (hasReleaseConfig) {
    // 1. Input: Create workerBridge for Tier 2 normalization
    const workerBridge = {
      sendMsg,
      sendPrepareMsg: (sql: string) =>
        sendMsg<PrepareResponse, PrepareRequest>(SqliteEvent.PREPARE, { sql }),
      terminate: () => {
        // No-op: Don't terminate worker from release manager
      },
    };

    // 2. Core: Two-tier validation for each release
    for (const row of releaseRows) {
      if (row.version === DEFAULT_VERSION) continue;

      const config = configByVersion.get(row.version);
      if (!config) {
        throw new Error(`Missing release config for ${row.version}`);
      }

      // 2a. Tier 1: Fast path validation for migrationSQL
      const migrationTier1Result = await validateHashTier1(
        config.migrationSQL,
        row.migrationSQLHash || "",
      );

      if (migrationTier1Result.needsTier2) {
        // Check if original SQL is available (for backward compatibility)
        const originalMigrationSQL = originalMigrationSQLMap.get(row.version);
        if (!originalMigrationSQL && row.originalMigrationSQL === null) {
          // Old database without original SQL - fall back to simple hash comparison
          throw new Error(`migrationSQL hash mismatch for ${row.version}`);
        }

        // 2b. Tier 2: Slow path validation for migrationSQL
        try {
          const migrationTier2Result = await validateHashTier2(
            originalMigrationSQL || row.originalMigrationSQL || "",
            config.migrationSQL,
            row.migrationSQLHash || "",
            migrationTier1Result.currentHash!,
            workerBridge,
            row.version,
            "migrationSQL",
          );

          // Auto-update hash on whitespace-only difference
          if (migrationTier2Result.normalizedMatch) {
            await metaExec(
              "UPDATE release SET migrationSQLHash = ? WHERE version = ?",
              [migrationTier2Result.newHash!, row.version],
            );
            console.debug(
              `[F-003] Auto-updated migrationSQL hash for ${row.version} (whitespace-only change)`,
            );
          }
        } catch (error) {
          if (error instanceof HashMismatchError) {
            // Re-throw enhanced error with context
            throw error;
          }
          throw error;
        }
      }

      // 2c. Tier 1: Fast path validation for seedSQL
      if (row.seedSQLHash !== null && config.seedSQLHash !== null) {
        const seedTier1Result = await validateHashTier1(
          config.normalizedSeedSQL || "",
          row.seedSQLHash,
        );

        if (seedTier1Result.needsTier2) {
          // Check if original SQL is available (for backward compatibility)
          const originalSeedSQL = originalSeedSQLMap.get(row.version);
          if (originalSeedSQL === undefined && row.originalSeedSQL === null) {
            // Old database without original SQL - fall back to simple hash comparison
            throw new Error(`seedSQL hash mismatch for ${row.version}`);
          }

          // 2d. Tier 2: Slow path validation for seedSQL
          try {
            const seedTier2Result = await validateHashTier2(
              originalSeedSQL || row.originalSeedSQL || "",
              config.normalizedSeedSQL || "",
              row.seedSQLHash,
              seedTier1Result.currentHash!,
              workerBridge,
              row.version,
              "seedSQL",
            );

            // Auto-update hash on whitespace-only difference
            if (seedTier2Result.normalizedMatch) {
              await metaExec(
                "UPDATE release SET seedSQLHash = ? WHERE version = ?",
                [seedTier2Result.newHash!, row.version],
              );
              console.debug(
                `[F-003] Auto-updated seedSQL hash for ${row.version} (whitespace-only change)`,
              );
            }
          } catch (error) {
            if (error instanceof HashMismatchError) {
              // Re-throw enhanced error with context
              throw error;
            }
            throw error;
          }
        }
      }
    }

    // 3. Output: Continue with remaining validation logic
    for (const config of releaseConfigs) {
      if (compareVersions(config.version, latestReleaseVersion) <= 0) {
        if (!releaseRows.find((row) => row.version === config.version)) {
          throw new Error(
            `Release config ${config.version} is within archived range but not recorded`,
          );
        }
      }
      if (
        compareVersions(config.version, latestRow.version) <= 0 &&
        !releaseRows.find((row) => row.version === config.version)
      ) {
        throw new Error(
          `Release config ${config.version} is not greater than the latest version`,
        );
      }
    }
  }

  let latestVersion = latestRow.version;

  // Serialize release operations using a metadata lock transaction.
  const withReleaseLock = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      await metaExec("BEGIN IMMEDIATE");
    } catch (error) {
      if (isLockError(error)) {
        throw new Error("Release operation already in progress");
      }
      throw error;
    }
    await metaExec(
      "INSERT OR REPLACE INTO release_lock (id, lockedAt) VALUES (1, ?)",
      [new Date().toISOString()],
    );
    console.debug("[release] lock acquired");
    try {
      const result = await fn();
      await metaExec("COMMIT");
      console.debug("[release] lock released");
      return result;
    } catch (error) {
      try {
        await metaExec("ROLLBACK");
      } catch {
        // ignore rollback errors
      }
      console.debug("[release] lock released (rollback)");
      throw error;
    }
  };

  // Switch the worker's active DB.
  const openActiveDb = async (dbPath: string, replace: boolean) => {
    await sendMsg<void, OpenDBArgs>(SqliteEvent.OPEN, {
      filename: dbPath,
      target: "active",
      replace,
    });
  };

  // Apply a version by copying the latest DB, running SQL, and inserting metadata.
  const applyVersion = async (
    config: ReleaseConfigWithHash,
    mode: "release" | "dev",
  ): Promise<void> => {
    console.debug(`[release] apply start ${config.version} (${mode})`);

    // v2.1.0: Use flat file naming {version}.sqlite3 instead of nested directories
    // For dev versions, use {version}.dev.sqlite3 suffix
    const versionFilename =
      mode === "dev"
        ? getDevVersionFilename(config.version)
        : `${config.version}.sqlite3`;
    const destDbHandle = await baseDir.getFileHandle(versionFilename, {
      create: true,
    });

    // F-003: Get a fresh handle for the source file
    const sourceMode = versionToModeMap.get(latestVersion) || "release";
    const sourceVersionFilename =
      sourceMode === "dev"
        ? getDevVersionFilename(latestVersion)
        : `${latestVersion}.sqlite3`;
    const sourceDbHandle = await baseDir.getFileHandle(sourceVersionFilename);

    await copyFileHandle(sourceDbHandle, destDbHandle);

    // v2.1.0: SQL stored in memory Maps (Task T-002), no file writing
    // Migration/seed SQL will be stored in Map<string, string> structures

    await openActiveDb(
      getDbPathForVersion(normalizedFilename, config.version, mode),
      true,
    );

    try {
      await _exec("BEGIN", undefined, "active");
      await _exec(config.migrationSQL, undefined, "active");
      if (config.normalizedSeedSQL) {
        await _exec(config.normalizedSeedSQL, undefined, "active");
      }
      await _exec("COMMIT", undefined, "active");
    } catch (error) {
      try {
        await _exec("ROLLBACK", undefined, "active");
      } catch {
        // ignore rollback errors
      }
      await openActiveDb(
        getDbPathForVersion(normalizedFilename, latestVersion),
        true,
      );
      try {
        // v2.1.0: Remove flat file instead of directory
        await baseDir.removeEntry(versionFilename);
      } catch (removeError) {
        const name = (removeError as Error).name;
        if (name !== "NotFoundError") {
          throw removeError;
        }
      }
      throw error;
    }

    // F-003: Insert metadata with original SQL columns
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

    // v2.1.0: Track the actual filename for OPFS operations
    latestVersion = config.version;
    latestRow = {
      id: 0,
      version: config.version,
      migrationSQLHash: config.migrationSQLHash,
      seedSQLHash: config.seedSQLHash,
      originalMigrationSQL: config.originalMigrationSQL, // F-003
      originalSeedSQL: config.originalSeedSQL, // F-003
      mode,
      createdAt: new Date().toISOString(),
    };
    // v2.1.0: Update versionToModeMap for new version
    versionToModeMap.set(config.version, mode);
    // v2.1.0: Store SQL in memory Maps
    migrationSQLMap.set(config.version, config.migrationSQL);
    if (config.normalizedSeedSQL) {
      seedSQLMap.set(config.version, config.normalizedSeedSQL);
    } else {
      seedSQLMap.set(config.version, "");
    }
    // F-003: Store original SQL in Maps
    originalMigrationSQLMap.set(config.version, config.originalMigrationSQL);
    originalSeedSQLMap.set(config.version, config.originalSeedSQL);
    console.debug(`[release] apply end ${config.version} (${mode})`);
  };

  if (hasReleaseConfig) {
    const newReleaseConfigs = releaseConfigs.filter(
      (config) => compareVersions(config.version, latestVersion) > 0,
    );

    if (newReleaseConfigs.length > 0) {
      await withReleaseLock(async () => {
        for (const config of newReleaseConfigs) {
          await applyVersion(config, "release");
        }
      });
    }
  }

  const latestDbPath = getDbPathForVersion(
    normalizedFilename,
    latestVersion,
    // Get mode from map, or default to "release" for versions not yet in map
    versionToModeMap.get(latestVersion) || "release",
  );
  await openActiveDb(latestDbPath, true);

  // Public DB interface for the active DB.
  const exec = async (sql: string, params?: SQLParams): Promise<ExecResult> => {
    return runMutex(() => _exec(sql, params, "active"));
  };

  const query = async <T = unknown>(
    sql: string,
    params?: SQLParams,
  ): Promise<T[]> => {
    return runMutex(() => _query<T>(sql, params, "active"));
  };

  const transaction = async <T>(fn: transactionCallback<T>): Promise<T> => {
    return runMutex(async () => {
      await _exec("BEGIN", undefined, "active");
      try {
        const result = await fn({
          exec: (sql: string, params?: SQLParams) =>
            _exec(sql, params, "active"),
          query: <U = unknown>(sql: string, params?: SQLParams) =>
            _query<U>(sql, params, "active"),
        });
        await _exec("COMMIT", undefined, "active");

        // Emit application log for transaction commit
        logDispatcher.dispatch({
          level: "info",
          data: { action: "commit", sql: "COMMIT" },
        });

        return result;
      } catch (error) {
        await _exec("ROLLBACK", undefined, "active");

        // Emit application log for transaction rollback
        logDispatcher.dispatch({
          level: "info",
          data: { action: "rollback", sql: "ROLLBACK" },
        });

        throw error;
      }
    });
  };

  const close = async (): Promise<void> => {
    return runMutex(async () => {
      // Emit application log for database close
      logDispatcher.dispatch({
        level: "info",
        data: { action: "close", dbName: normalizedFilename },
      });

      await sendMsg(SqliteEvent.CLOSE);
      // Unregister from registry after close
      DatabaseRegistry.unregister(normalizedFilename);

      // Emit database change event AFTER unregister (so databases list is accurate)
      globalNamespace._emitEvent({
        action: "closed",
        dbName: normalizedFilename,
        databases: DatabaseRegistry.list(),
      });
    });
  };

  // Dev tooling for creating and rolling back dev versions.
  const devToolRelease: DevTool["release"] = async (input) => {
    return runMutex(async () => {
      console.debug(`[devTool.release] start ${input.version}`);
      const [config] = await validateAndHashReleases([input]);
      if (!config) {
        throw new Error("devTool.release requires a valid release config");
      }
      if (compareVersions(config.version, latestVersion) <= 0) {
        throw new Error("devTool.release version must be greater than latest");
      }
      await withReleaseLock(async () => {
        await applyVersion(config, "dev");
      });
      console.debug(`[devTool.release] end ${input.version}`);
    });
  };

  const devToolRollback: DevTool["rollback"] = async (version) => {
    return runMutex(async () => {
      console.debug(`[devTool.rollback] start ${version}`);
      if (version !== DEFAULT_VERSION && !VERSION_RE.test(version)) {
        throw new Error(`Invalid version format: ${version}`);
      }

      await withReleaseLock(async () => {
        // F-003: Query metadata including original SQL columns
        const rows = await metaQuery<ReleaseRow>(
          "SELECT id, version, migrationSQLHash, seedSQLHash, originalMigrationSQL, originalSeedSQL, mode, createdAt FROM release ORDER BY id",
        );

        const targetRow = rows.find((row) => row.version === version);
        if (!targetRow) {
          throw new Error(`Version not found: ${version}`);
        }

        const latestReleaseRows = rows.filter((row) => row.mode === "release");
        const latestRelease = getLatestReleaseVersion(
          latestReleaseRows.filter((row) => row.version !== DEFAULT_VERSION),
        );

        if (compareVersions(version, latestRelease) < 0) {
          throw new Error("Cannot rollback below the latest release version");
        }

        const devRowsToRemove = rows.filter(
          (row) =>
            row.mode === "dev" && compareVersions(row.version, version) > 0,
        );

        for (const row of devRowsToRemove) {
          // v2.1.0: Dev versions use .dev.sqlite3 suffix (flat file structure)
          const devVersionFilename = getDevVersionFilename(row.version);
          try {
            await baseDir.removeEntry(devVersionFilename);
          } catch (removeError) {
            const name = (removeError as Error).name;
            if (name !== "NotFoundError") {
              throw removeError;
            }
          }
          await metaExec("DELETE FROM release WHERE id = ?", [row.id]);
          // F-003: Remove from original SQL Maps on rollback
          originalMigrationSQLMap.delete(row.version);
          originalSeedSQLMap.delete(row.version);
        }

        latestVersion = version;
        // Get mode from map, or default to "release" for versions not yet in map
        const rollbackMode = versionToModeMap.get(version) || "release";
        await openActiveDb(
          getDbPathForVersion(normalizedFilename, version, rollbackMode),
          true,
        );
      });

      console.debug(`[devTool.rollback] end ${version}`);
    });
  };

  const devTool: DevTool = {
    release: devToolRelease,
    rollback: devToolRollback,
  };

  // Implement onLog method using the log dispatcher from main
  const onLog = (callback: (log: LogEntry) => void): (() => void) => {
    return logDispatcher.register(callback);
  };

  const db: DBInterface = {
    exec,
    query,
    transaction,
    close,
    onLog,
    devTool,
  };

  // v2.1.0: Create DatabaseRecord for registry and global namespace
  // F-003: Include original SQL Maps
  const databaseRecord: DatabaseRecord = {
    migrationSQL: migrationSQLMap,
    seedSQL: seedSQLMap,
    originalMigrationSQL: originalMigrationSQLMap, // F-003
    originalSeedSQL: originalSeedSQLMap, // F-003
    db,
  };

  return databaseRecord;
};

import { OpenDBArgs, SqliteEvent, WorkerOpenDBOptions } from "../types/message";
import { DatabaseRegistry } from "../registry/database-registry";
import type {
  DBInterface,
  SQLParams,
  ExecResult,
  ExecParams,
  transactionCallback,
  DbTarget,
  DevTool,
  LogEntry,
} from "../types/DB";
import {
  DEFAULT_VERSION,
  RELEASE_INDEX_SQL,
  RELEASE_LOCK_TABLE_SQL,
  RELEASE_TABLE_SQL,
} from "./constants";
import { validateAndHashReleases } from "./hash-utils";
import {
  copyFileHandle,
  ensureDir,
  ensureFile,
  getDbHandleForVersion,
  getDbPathForVersion,
  removeDir,
  writeTextFile,
} from "./opfs-utils";
import type {
  ReleaseConfigWithHash,
  ReleaseManagerDeps,
  ReleaseRow,
} from "./types";
import {
  compareVersions,
  getLatestReleaseVersion,
  normalizeFilename,
} from "./version-utils";
import { isLockError } from "./lock-utils";
import { VERSION_RE } from "./constants";

/**
 * Open and prepare a versioned database using release metadata.
 *
 * @param deps - Dependencies required to open the DB and communicate with the worker.
 * @returns A DBInterface bound to the latest version.
 */
export const openReleaseDB = async ({
  filename,
  options,
  sendMsg,
  runMutex,
  logDispatcher,
}: ReleaseManagerDeps): Promise<DBInterface> => {
  console.debug("[openDB] input validation start");
  if (typeof filename !== "string" || filename.trim() === "") {
    throw new Error("filename must be a non-empty string");
  }

  const releaseConfigs = await validateAndHashReleases(options?.releases);
  const hasReleaseConfig = releaseConfigs.length > 0;
  console.debug("[openDB] input validation end");

  const normalizedFilename = normalizeFilename(filename);
  console.debug(`[openDB] normalized filename: ${normalizedFilename}`);

  const root = await navigator.storage.getDirectory();
  const baseDir = await ensureDir(root, normalizedFilename);
  console.debug(`[openDB] ensured directory: ${normalizedFilename}`);

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

  // Ensure metadata tables and the default row exist.
  const ensureMetadata = async (): Promise<void> => {
    await metaExec(RELEASE_TABLE_SQL);
    await metaExec(RELEASE_INDEX_SQL);
    await metaExec(RELEASE_LOCK_TABLE_SQL);

    const defaults = await metaQuery<{ id: number }>(
      "SELECT id FROM release WHERE version = ? LIMIT 1",
      [DEFAULT_VERSION],
    );
    if (defaults.length === 0) {
      await metaExec(
        "INSERT INTO release (version, migrationSQLHash, seedSQLHash, mode, createdAt) VALUES (?, ?, ?, ?, ?)",
        [DEFAULT_VERSION, null, null, "release", new Date().toISOString()],
      );
    }
  };

  await ensureMetadata();
  console.debug("[openDB] ensured metadata tables and default row");

  const latestRows = await metaQuery<ReleaseRow>(
    "SELECT id, version, migrationSQLHash, seedSQLHash, mode, createdAt FROM release ORDER BY id DESC LIMIT 1",
  );
  if (latestRows.length === 0) {
    throw new Error("release metadata not initialized");
  }
  let latestRow = latestRows[0];

  const releaseRows = await metaQuery<ReleaseRow>(
    "SELECT id, version, migrationSQLHash, seedSQLHash, mode, createdAt FROM release WHERE mode = 'release' ORDER BY id",
  );

  console.debug(
    `[openDB] latest version: ${latestRow.version}, release rows: ${releaseRows.length}`,
  );

  const configByVersion = new Map<string, ReleaseConfigWithHash>();
  for (const config of releaseConfigs) {
    configByVersion.set(config.version, config);
  }

  const latestReleaseVersion = getLatestReleaseVersion(
    releaseRows.filter((row) => row.version !== DEFAULT_VERSION),
  );

  if (hasReleaseConfig) {
    for (const row of releaseRows) {
      if (row.version === DEFAULT_VERSION) continue;
      const config = configByVersion.get(row.version);
      if (!config) {
        throw new Error(`Missing release config for ${row.version}`);
      }
      if (config.migrationSQLHash !== row.migrationSQLHash) {
        throw new Error(`migrationSQL hash mismatch for ${row.version}`);
      }
      if (config.seedSQLHash !== row.seedSQLHash) {
        throw new Error(`seedSQL hash mismatch for ${row.version}`);
      }
    }

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
  let latestDbHandle = await getDbHandleForVersion(
    baseDir,
    latestVersion,
    latestVersion === DEFAULT_VERSION,
  );

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
    const versionDir = await baseDir.getDirectoryHandle(config.version, {
      create: true,
    });
    const destDbHandle = await versionDir.getFileHandle("db.sqlite3", {
      create: true,
    });

    await copyFileHandle(latestDbHandle, destDbHandle);
    await writeTextFile(versionDir, "migration.sql", config.migrationSQL);
    if (config.normalizedSeedSQL) {
      await writeTextFile(versionDir, "seed.sql", config.normalizedSeedSQL);
    } else {
      try {
        await versionDir.removeEntry("seed.sql");
      } catch (error) {
        const name = (error as Error).name;
        if (name !== "NotFoundError") {
          throw error;
        }
      }
    }

    await openActiveDb(
      getDbPathForVersion(normalizedFilename, config.version),
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
        await removeDir(baseDir, config.version);
      } catch (removeError) {
        const name = (removeError as Error).name;
        if (name !== "NotFoundError") {
          throw removeError;
        }
      }
      throw error;
    }

    await metaExec(
      "INSERT INTO release (version, migrationSQLHash, seedSQLHash, mode, createdAt) VALUES (?, ?, ?, ?, ?)",
      [
        config.version,
        config.migrationSQLHash,
        config.seedSQLHash,
        mode,
        new Date().toISOString(),
      ],
    );

    latestVersion = config.version;
    latestDbHandle = destDbHandle;
    latestRow = {
      id: 0,
      version: config.version,
      migrationSQLHash: config.migrationSQLHash,
      seedSQLHash: config.seedSQLHash,
      mode,
      createdAt: new Date().toISOString(),
    };
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

  const latestDbPath = getDbPathForVersion(normalizedFilename, latestVersion);
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
        return result;
      } catch (error) {
        await _exec("ROLLBACK", undefined, "active");
        throw error;
      }
    });
  };

  const close = async (): Promise<void> => {
    return runMutex(async () => {
      await sendMsg(SqliteEvent.CLOSE);
      // Unregister from registry after close
      DatabaseRegistry.unregister(normalizedFilename);
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
        const rows = await metaQuery<ReleaseRow>(
          "SELECT id, version, migrationSQLHash, seedSQLHash, mode, createdAt FROM release ORDER BY id",
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
          await removeDir(baseDir, row.version);
          await metaExec("DELETE FROM release WHERE id = ?", [row.id]);
        }

        latestVersion = version;
        latestDbHandle = await getDbHandleForVersion(baseDir, version, false);
        await openActiveDb(
          getDbPathForVersion(normalizedFilename, version),
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

  return db;
};

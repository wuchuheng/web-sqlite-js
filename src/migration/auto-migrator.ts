/**
 * Auto-migrator for v2.0.0 → v2.1.0 structure conversion
 * @module auto-migrator
 */

import { copyFileHandle } from "../release/opfs-utils.js";

/** Backup directory suffix */
const BACKUP_SUFFIX = ".backup";

/** Version directory pattern */
const VERSION_DIR_PATTERN = /^\d+\.\d+\.\d+$/;

/**
 * Read text content from a file
 * @param dir - Directory handle
 * @param name - File name
 * @returns File content as string
 * @internal
 */
async function readTextFile(
  dir: FileSystemDirectoryHandle,
  name: string,
): Promise<string> {
  const file = await dir.getFileHandle(name);
  const fileData = await file.getFile();
  return await fileData.text();
}

/**
 * Copy a directory recursively
 * @param srcDir - Source directory handle
 * @param destParent - Destination parent directory handle
 * @param dirName - Directory name to copy
 * @internal
 */
async function copyDirectory(
  srcDir: FileSystemDirectoryHandle,
  destParent: FileSystemDirectoryHandle,
  dirName: string,
): Promise<void> {
  const srcSubDir = await srcDir.getDirectoryHandle(dirName);
  const destSubDir = await destParent.getDirectoryHandle(dirName, {
    create: true,
  });

  // Copy all entries recursively
  for await (const entry of srcSubDir.values()) {
    if (entry.kind === "file") {
      const srcFile = await srcSubDir.getFileHandle(entry.name);
      const destFile = await destSubDir.getFileHandle(entry.name, {
        create: true,
      });
      await copyFileHandle(srcFile, destFile);
    } else if (entry.kind === "directory") {
      await copyDirectory(srcSubDir, destSubDir, entry.name);
    }
  }
}

/**
 * Create a backup of the OPFS directory
 * @param baseDir - Base directory handle to backup
 * @returns Backup directory handle
 * @internal
 */
async function createBackup(
  baseDir: FileSystemDirectoryHandle,
): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  const baseDirName = baseDir.name;
  const backupName = `${baseDirName}${BACKUP_SUFFIX}`;

  // Create backup directory
  const backupDir = await root.getDirectoryHandle(backupName, {
    create: true,
  });

  // Copy all entries from baseDir to backup
  for await (const entry of baseDir.values()) {
    if (entry.kind === "file") {
      const srcFile = await baseDir.getFileHandle(entry.name);
      const destFile = await backupDir.getFileHandle(entry.name, {
        create: true,
      });
      await copyFileHandle(srcFile, destFile);
    } else if (entry.kind === "directory") {
      await copyDirectory(baseDir, backupDir, entry.name);
    }
  }

  return backupDir;
}

/**
 * Restore backup on migration failure
 * @param baseDirName - Original directory name to restore
 * @internal
 */
async function restoreBackup(baseDirName: string): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const backupName = `${baseDirName}${BACKUP_SUFFIX}`;

  // Remove original directory
  try {
    await root.removeEntry(baseDirName, { recursive: true });
  } catch (e) {
    const name = (e as Error).name;
    if (name !== "NotFoundError") {
      throw e;
    }
  }

  // Copy backup to original name
  const backupDir = await root.getDirectoryHandle(backupName);
  await copyDirectory(backupDir, root, baseDirName);

  // Remove backup directory
  try {
    await root.removeEntry(backupName, { recursive: true });
  } catch (_e) {
    // Ignore if backup doesn't exist
  }
}

/**
 * Delete backup after successful migration
 * @param baseDirName - Directory name (without backup suffix)
 * @internal
 */
async function deleteBackup(baseDirName: string): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const backupName = `${baseDirName}${BACKUP_SUFFIX}`;

  try {
    await root.removeEntry(backupName, { recursive: true });
  } catch (_e) {
    // Ignore if backup doesn't exist
  }
}

/**
 * Migrate a single version directory to flat file
 * @param baseDir - Base directory handle
 * @param version - Version string (e.g., "0.0.1")
 * @param migrationSQLMap - Map to populate with migration SQL
 * @param seedSQLMap - Map to populate with seed SQL
 * @internal
 */
async function migrateVersionDirectory(
  baseDir: FileSystemDirectoryHandle,
  version: string,
  migrationSQLMap: Map<string, string>,
  seedSQLMap: Map<string, string>,
): Promise<void> {
  const versionDir = await baseDir.getDirectoryHandle(version);

  // Read migration.sql if exists
  try {
    const migrationSQL = await readTextFile(versionDir, "migration.sql");
    migrationSQLMap.set(version, migrationSQL);
  } catch (_e) {
    // migration.sql may not exist, skip
  }

  // Read seed.sql if exists
  try {
    const seedSQL = await readTextFile(versionDir, "seed.sql");
    seedSQLMap.set(version, seedSQL);
  } catch (_e) {
    // seed.sql may not exist, skip
  }

  // Copy db.sqlite3 to {version}.sqlite3 if it exists
  // If db.sqlite3 doesn't exist, skip copying but continue with cleanup
  let dbFile: FileSystemFileHandle | undefined;
  try {
    dbFile = await versionDir.getFileHandle("db.sqlite3");
    const newFileName = `${version}.sqlite3`;
    const newFile = await baseDir.getFileHandle(newFileName, {
      create: true,
    });
    await copyFileHandle(dbFile, newFile);
  } catch (_e) {
    // db.sqlite3 doesn't exist, skip copying but continue with cleanup
    console.debug(
      `[migrateToV21] No db.sqlite3 found for version ${version}, skipping file copy`,
    );
  }

  // Remove SQL files
  try {
    await versionDir.removeEntry("migration.sql");
  } catch (_e) {
    // Ignore if file doesn't exist
  }

  try {
    await versionDir.removeEntry("seed.sql");
  } catch (_e) {
    // Ignore if file doesn't exist
  }

  // Remove version directory (now empty)
  await baseDir.removeEntry(version);
}

/**
 * Collect all version directory names
 * @param baseDir - Base directory handle
 * @returns Array of version directory names
 * @internal
 */
async function collectVersionDirectories(
  baseDir: FileSystemDirectoryHandle,
): Promise<string[]> {
  const versionDirs: string[] = [];

  for await (const entry of baseDir.values()) {
    if (entry.kind === "directory" && VERSION_DIR_PATTERN.test(entry.name)) {
      versionDirs.push(entry.name);
    }
  }

  return versionDirs;
}

/**
 * Migrate v2.0.0 structure to v2.1.0 structure
 *
 * Converts nested version directories (v2.0.0) to flat files (v2.1.0):
 * - Before: `0.0.1/db.sqlite3`, `migration.sql`, `seed.sql`
 * - After: `0.0.1.sqlite3` (SQL stored in memory Maps)
 *
 * Migration is atomic with automatic rollback on failure:
 * 1. Create backup of entire directory
 * 2. Convert each version directory to flat file
 * 3. Read SQL files and populate Maps
 * 4. Delete backup on success
 * 5. Restore backup on any error
 *
 * @param baseDir - Base OPFS directory handle
 * @param migrationSQLMap - Map to populate with migration SQL (version → SQL)
 * @param seedSQLMap - Map to populate with seed SQL (version → SQL)
 * @throws Error if migration fails (with automatic rollback)
 *
 * @example
 * // Before migration (v2.0.0):
 * // demo.sqlite3/
 * //   0.0.1/
 * //     db.sqlite3
 * //     migration.sql
 * //     seed.sql
 *
 * const migrationMap = new Map<string, string>();
 * const seedMap = new Map<string, string>();
 * await migrateToV21(baseDir, migrationMap, seedMap);
 *
 * // After migration (v2.1.0):
 * // demo.sqlite3/
 * //   0.0.1.sqlite3
 * // migrationMap.get("0.0.1") // "CREATE TABLE..."
 * // seedMap.get("0.0.1") // "INSERT INTO..."
 */
export async function migrateToV21(
  baseDir: FileSystemDirectoryHandle,
  migrationSQLMap: Map<string, string>,
  seedSQLMap: Map<string, string>,
): Promise<void> {
  const baseDirName = baseDir.name;

  // Phase 1: Create backup
  await createBackup(baseDir);

  try {
    // Phase 2: Collect and migrate version directories
    const versionDirs = await collectVersionDirectories(baseDir);

    for (const version of versionDirs) {
      await migrateVersionDirectory(
        baseDir,
        version,
        migrationSQLMap,
        seedSQLMap,
      );
    }

    // Phase 3: Delete backup (success)
    await deleteBackup(baseDirName);
  } catch (error) {
    // Rollback: Restore backup on any error
    await restoreBackup(baseDirName);
    throw new Error(
      `Migration failed: ${error instanceof Error ? error.message : String(error)}. Original structure restored.`,
    );
  }
}

import { createWorkerBridge } from "./worker-bridge";
import { createMutex } from "./utils/mutex/mutex";
import { createLogDispatcher } from "./logs/log-dispatcher";
import type { DBInterface, OpenDBOptions } from "./types/DB";
import { abilityCheck } from "./validations/shareBufferAbiliCheck";
import { openReleaseDB } from "./release/release-manager";
import { DatabaseRegistry } from "./registry/database-registry";
// Initialize global namespace on library load
import "./global/namespace";

/**
 * Opens a SQLite database connection with release-versioning support.
 *
 * @param filename - The base database name (directory is created in OPFS).
 * @param options - Optional release configuration and debug flag.
 * @returns A DBInterface for the latest active version.
 *
 * @throws Error if the filename is invalid, release config is invalid,
 * or an archived release hash does not match.
 */
export const openDB = async (
  filename: string,
  options?: OpenDBOptions,
): Promise<DBInterface> => {
  abilityCheck();

  // Check lock before opening to prevent duplicate opens
  DatabaseRegistry.checkLock(filename);

  // Create log dispatcher for this database instance
  const logDispatcher = createLogDispatcher();

  // Create worker bridge with log dispatcher
  const { sendMsg } = createWorkerBridge(logDispatcher);
  const runMutex = createMutex();

  const db = await openReleaseDB({
    filename,
    options,
    sendMsg,
    runMutex,
    logDispatcher,
  });

  // Register after successful open
  DatabaseRegistry.register(filename, db);

  return db;
};

export default openDB;

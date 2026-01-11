import type { ReleaseConfig, OpenDBOptions } from "../types/DB";
import type { SqliteEvent } from "../types/message";
import type { LogDispatcher } from "../logs/log-dispatcher";

/** Release config decorated with hashes for validation. */
export type ReleaseConfigWithHash = ReleaseConfig & {
  migrationSQLHash: string;
  seedSQLHash: string | null;
  normalizedSeedSQL: string | null;
};

/** Row shape from the release metadata table. */
export type ReleaseRow = {
  id: number;
  version: string;
  migrationSQLHash: string | null;
  seedSQLHash: string | null;
  mode: "release" | "dev";
  createdAt: string;
};

/** Worker message sender abstraction. */
export type SendMsg = <TRes, TReq = unknown>(
  event: SqliteEvent,
  payload?: TReq,
) => Promise<TRes>;

/** Dependencies required to open a release-managed DB. */
export type ReleaseManagerDeps = {
  filename: string;
  options?: OpenDBOptions;
  sendMsg: SendMsg;
  runMutex: <T>(fn: () => Promise<T>) => Promise<T>;
  logDispatcher: LogDispatcher;
};

import type { ReleaseConfig } from "../types/DB";
import { DEFAULT_VERSION, VERSION_RE } from "./constants";
import { compareVersions } from "./version-utils";
import type { ReleaseConfigWithHash } from "./types";

/**
 * Normalize seed SQL and enforce allowed types.
 *
 * @param seedSQL - The seed SQL to normalize.
 * @returns Normalized seed SQL or null if empty.
 */
const normalizeSeedSQL = (seedSQL?: string | null): string | null => {
  if (seedSQL === undefined || seedSQL === null || seedSQL === "") {
    return null;
  }
  if (typeof seedSQL !== "string") {
    throw new Error("seedSQL must be a string or null");
  }
  return seedSQL;
};

/**
 * Hash SQL text using SHA-256 hex.
 *
 * @param value - The SQL string to hash.
 * @returns Hex-encoded SHA-256 hash.
 */
const hashSQL = async (value: string): Promise<string> => {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

/**
 * Validate release configs and attach SQL hashes and original SQL (F-003).
 *
 * Validates that release versions are properly formatted, strictly increasing,
 * and have non-empty migration SQL. Computes SHA-256 hashes for migration
 * and seed SQL. Stores original SQL for two-tier validation (F-003).
 *
 * @example
 * ```ts
 * const releases = [
 *   {
 *     version: "1.0.0",
 *     migrationSQL: "CREATE TABLE users (id INTEGER PRIMARY KEY);",
 *     seedSQL: "INSERT INTO users VALUES (1);",
 *   },
 * ];
 *
 * const result = await validateAndHashReleases(releases);
 * // result[0].migrationSQLHash === "abc123..."
 * // result[0].originalMigrationSQL === "CREATE TABLE users (id INTEGER PRIMARY KEY);"
 * ```
 *
 * @param releases - Array of release configs to validate.
 * @returns Array of release configs with hashes and original SQL attached.
 * @throws Error if validation fails.
 */
export const validateAndHashReleases = async (
  releases?: ReleaseConfig[],
): Promise<ReleaseConfigWithHash[]> => {
  // 1. Input Validation
  if (!releases || releases.length === 0) return [];
  if (!Array.isArray(releases)) {
    throw new Error("releases must be an array");
  }

  const result: ReleaseConfigWithHash[] = [];
  let prevVersion: string | null = null;
  const seen = new Set<string>();

  // 2. Core: Validate and hash each release
  for (const release of releases) {
    if (!release || typeof release !== "object") {
      throw new Error("release entry must be an object");
    }

    const { version, migrationSQL } = release;
    if (typeof version !== "string") {
      throw new Error("release.version must be a string");
    }
    if (version === DEFAULT_VERSION) {
      throw new Error("default is reserved and cannot be used in releases");
    }
    if (!VERSION_RE.test(version)) {
      throw new Error(`Invalid version format: ${version}`);
    }
    if (seen.has(version)) {
      throw new Error(`Duplicate release version: ${version}`);
    }
    seen.add(version);

    if (prevVersion && compareVersions(version, prevVersion) <= 0) {
      throw new Error("release versions must be strictly increasing");
    }
    prevVersion = version;

    if (typeof migrationSQL !== "string" || migrationSQL.trim() === "") {
      throw new Error(`migrationSQL must be a non-empty string (${version})`);
    }

    const normalizedSeedSQL = normalizeSeedSQL(release.seedSQL);
    const migrationSQLHash = await hashSQL(migrationSQL);
    const seedSQLHash = normalizedSeedSQL
      ? await hashSQL(normalizedSeedSQL)
      : null;

    // 3. Output: Return config with hashes and original SQL
    result.push({
      ...release,
      seedSQL: normalizedSeedSQL,
      normalizedSeedSQL,
      migrationSQLHash,
      seedSQLHash,
      originalMigrationSQL: migrationSQL, // F-003: Store original SQL
      originalSeedSQL: normalizedSeedSQL, // F-003: Store original SQL
    });
  }

  return result;
};

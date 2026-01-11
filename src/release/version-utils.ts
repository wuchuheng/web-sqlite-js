import { DEFAULT_VERSION, VERSION_RE } from "./constants";
import { isDevVersion } from "./opfs-utils";

/** Normalize database name to a `.sqlite3` suffix. */
export const normalizeFilename = (filename: string): string => {
  return filename.endsWith(".sqlite3") ? filename : `${filename}.sqlite3`;
};

/** Parse a semver string into numeric parts. */
const parseVersion = (version: string): number[] => {
  const match = VERSION_RE.exec(version);
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

/** Compare versions, treating `default` as lowest. */
export const compareVersions = (a: string, b: string): number => {
  if (a === b) return 0;
  if (a === DEFAULT_VERSION) return -1;
  if (b === DEFAULT_VERSION) return 1;
  const aParts = parseVersion(a);
  const bParts = parseVersion(b);
  for (let i = 0; i < aParts.length; i++) {
    if (aParts[i] !== bParts[i]) {
      return aParts[i] > bParts[i] ? 1 : -1;
    }
  }
  return 0;
};

/** Get the latest release version from sorted rows. */
export const getLatestReleaseVersion = (
  rows: { version: string }[],
): string => {
  if (rows.length === 0) return DEFAULT_VERSION;
  return rows[rows.length - 1].version;
};

/**
 * Get the dev version filename for a version.
 * @param version - Semver version string (e.g., "1.0.0")
 * @returns Dev version filename (e.g., "1.0.0.dev.sqlite3")
 */
export const getDevVersionFilename = (version: string): string => {
  return `${version}.dev.sqlite3`;
};

/**
 * Extract base version from a dev version filename.
 * @param devVersion - Dev version filename (e.g., "1.0.0.dev.sqlite3")
 * @returns Base version string (e.g., "1.0.0")
 */
export const extractBaseVersionFromDev = (devVersion: string): string => {
  if (!isDevVersion(devVersion)) {
    throw new Error(`Not a dev version: ${devVersion}`);
  }
  return devVersion.replace(".dev.sqlite3", "");
};

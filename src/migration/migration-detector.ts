/**
 * Migration detector for v2.0.0 → v2.1.0 structure detection
 * @module migration-detector
 */

/** Version directory pattern for v2.0.0 */
const VERSION_DIR_PATTERN = /^\d+\.\d+\.\d+$/;

/**
 * Detection result for OPFS structure
 */
export interface StructureDetectionResult {
  /** Detected structure version */
  version: "2.0.0" | "2.1.0";
  /** Whether nested version directories exist */
  hasNestedDirs: boolean;
}

/**
 * Detect whether the OPFS structure is v2.0.0 or v2.1.0
 *
 * v2.0.0 structure uses nested version directories (e.g., `0.0.1/db.sqlite3`)
 * v2.1.0 structure uses flat files (e.g., `0.0.1.sqlite3`)
 *
 * @param baseDir - Base OPFS directory handle
 * @returns Structure detection result with version and flag
 *
 * @example
 * // v2.0.0 structure:
 * // demo.sqlite3/
 * //   0.0.1/
 * //     db.sqlite3
 * const result = await detectStructure(baseDir);
 * // Returns: { version: "2.0.0", hasNestedDirs: true }
 *
 * @example
 * // v2.1.0 structure:
 * // demo.sqlite3/
 * //   0.0.1.sqlite3
 * const result = await detectStructure(baseDir);
 * // Returns: { version: "2.1.0", hasNestedDirs: false }
 */
export async function detectStructure(
  baseDir: FileSystemDirectoryHandle,
): Promise<StructureDetectionResult> {
  // PHASE 1: Scan for version directories
  for await (const entry of baseDir.values()) {
    if (entry.kind === "directory" && VERSION_DIR_PATTERN.test(entry.name)) {
      return { version: "2.0.0", hasNestedDirs: true };
    }
  }

  // PHASE 2: No version directories found → v2.1.0 structure
  return { version: "2.1.0", hasNestedDirs: false };
}

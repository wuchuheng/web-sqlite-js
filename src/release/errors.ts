/**
 * Enhanced Hash Mismatch Error (F-003)
 *
 * Provides detailed error messages when SQL hash validation fails,
 * including truncated SQL snippets and diff formatting to help
 * developers identify what changed.
 */

/**
 * Enhanced hash mismatch error with SQL diff formatting (F-003).
 *
 * Provides detailed error messages when SQL hash validation fails,
 * including truncated SQL snippets and diff formatting to help
 * developers identify what changed.
 *
 * @example
 * ```typescript
 * throw new HashMismatchError({
 *   version: "1.0.0",
 *   sqlType: "migrationSQL",
 *   storedHash: "abc123...",
 *   currentHash: "def456...",
 *   originalSQL: "CREATE TABLE users (id INTEGER);",
 *   currentSQL: "CREATE TABLE users (id INTEGER, name TEXT);",
 * });
 * // Error message:
 * // "Hash mismatch for 1.0.0 migrationSQL:
 * //  Expected: abc123...
 * //  Actual: def456...
 * //  SQL has changed:
 * //  - Original: CREATE TABLE users (id INTEGER);
 * //  + Current:  CREATE TABLE users (id INTEGER, name TEXT);"
 * ```
 */
export class HashMismatchError extends Error {
  /** The release version for error context. */
  readonly version: string;
  /** The SQL type ("migrationSQL" or "seedSQL"). */
  readonly sqlType: "migrationSQL" | "seedSQL";
  /** The stored hash from metadata database. */
  readonly storedHash: string;
  /** The computed hash of current SQL. */
  readonly currentHash: string;
  /** The normalized original SQL (truncated in error message). */
  readonly originalSQL: string;
  /** The normalized current SQL (truncated in error message). */
  readonly currentSQL: string;
  /** Diff-formatted SQL change for debugging. */
  readonly diff: string;

  /**
   * Creates a new HashMismatchError.
   *
   * @param params - Error parameters.
   */
  constructor(params: {
    version: string;
    sqlType: "migrationSQL" | "seedSQL";
    storedHash: string;
    currentHash: string;
    originalSQL: string;
    currentSQL: string;
  }) {
    // 1. Construct error message with truncation
    const truncate = (sql: string): string => {
      if (sql.length <= 200) return sql;
      return sql.substring(0, 200) + "...";
    };

    const truncatedOriginal = truncate(params.originalSQL);
    const truncatedCurrent = truncate(params.currentSQL);

    const message = `Hash mismatch for ${params.version} ${params.sqlType}:
Expected: ${params.storedHash}
Actual: ${params.currentHash}
SQL has changed:
- Original: ${truncatedOriginal}
+ Current:  ${truncatedCurrent}`;

    super(message);

    // 2. Set error name and properties
    this.name = "HashMismatchError";
    this.version = params.version;
    this.sqlType = params.sqlType;
    this.storedHash = params.storedHash;
    this.currentHash = params.currentHash;
    this.originalSQL = params.originalSQL;
    this.currentSQL = params.currentSQL;

    // 3. Generate diff formatting
    this.diff = this.generateDiff(params.originalSQL, params.currentSQL);

    // Maintain proper stack trace (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HashMismatchError);
    }
  }

  /**
   * Generates diff-formatted SQL change.
   *
   * @param original - The original SQL.
   * @param current - The current SQL.
   * @returns Diff-formatted string.
   */
  private generateDiff(original: string, current: string): string {
    const linesOriginal = original.split("\n");
    const linesCurrent = current.split("\n");
    const maxLines = Math.max(linesOriginal.length, linesCurrent.length);
    const diff: string[] = [];

    for (let i = 0; i < Math.min(maxLines, 20); i++) {
      const lineOriginal = linesOriginal[i] ?? "";
      const lineCurrent = linesCurrent[i] ?? "";

      if (lineOriginal === lineCurrent) {
        diff.push(` ${lineOriginal}`);
      } else {
        if (lineOriginal) diff.push(`-${lineOriginal}`);
        if (lineCurrent) diff.push(`+${lineCurrent}`);
      }
    }

    if (maxLines > 20) {
      diff.push("... (truncated)");
    }

    return diff.join("\n");
  }
}

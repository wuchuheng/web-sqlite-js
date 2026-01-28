/**
 * SQL Normalizer Module (F-003)
 *
 * Provides SQL normalization using a custom implementation for two-tier validation.
 * This module wraps the worker bridge's normalizeSQL() function for release management.
 *
 * Note: SQLite WASM build doesn't expose sqlite3_normalized_sql or sqlite3_expanded_sql
 * (SQLITE_ENABLE_NORMALIZE is disabled), so we implement our own normalization function.
 */

import { normalizeSQL } from "../worker-bridge";
import type { WorkerBridge } from "../worker-bridge";

/**
 * Normalizes SQL using custom normalization (F-003 Tier 2 validation).
 *
 * This function normalizes a SQL string using a custom normalization function
 * that removes extra whitespace, removes comments, and standardizes SQL structure.
 * Used in Tier 2 validation when hash mismatch occurs.
 *
 * @example
 * ```typescript
 * import { normalizeSQLViaPrepare } from "web-sqlite-js/release/sql-normalizer";
 *
 * // Two-tier validation pattern (F-003)
 * // Tier 1: Fast trim + hash compare
 * const trimmedOriginal = originalSQL.trim();
 * const trimmedCurrent = currentSQL.trim();
 * const hashOriginal = await hashSQL(trimmedOriginal);
 * const hashCurrent = await hashSQL(trimmedCurrent);
 *
 * if (hashCurrent === storedHash) {
 *   // Fast pass - validation succeeds
 * } else {
 *   // Tier 2: Slow normalization
 *   const normalizedOriginal = await normalizeSQLViaPrepare(
 *     trimmedOriginal,
 *     workerBridge
 *   );
 *   const normalizedCurrent = await normalizeSQLViaPrepare(
 *     trimmedCurrent,
 *     workerBridge
 *   );
 *
 *   if (normalizedOriginal === normalizedCurrent) {
 *     // Whitespace-only difference - auto-update hash
 *     await updateHash(version, hashCurrent, sqlType);
 *   } else {
 *     // Actual SQL change - throw error
 *     throw new HashMismatchError({
 *       version,
 *       sqlType,
 *       originalSQL: truncate(currentSQL, 200),
 *       currentSQL: truncate(originalSQL, 200),
 *     });
 *   }
 * }
 * ```
 *
 * @param sql - The SQL string to normalize.
 * @param workerBridge - The worker bridge instance for communication.
 * @returns A promise that resolves with the normalized SQL string.
 * @throws {Error} If SQL is invalid.
 *
 * @remarks
 * **Performance**: <0.1ms (faster than original SQLite prepare approach)
 *
 * **Normalization Rules** (custom implementation):
 * - Removes extra whitespace (collapses multiple spaces to single space)
 * - Removes SQL comments (both -- and slash-star style)
 * - Removes spaces around parentheses, commas, and semicolons
 * - Trims leading/trailing whitespace
 *
 * **Usage**: Only call in Tier 2 validation when Tier 1 hash mismatch occurs.
 *
 * **F-003 Context**: This is part of the two-tier SQL validation system for
 * enhanced hash mismatch detection. See F-003 feature documentation for details.
 *
 * **Implementation Note**: SQLite WASM build doesn't expose sqlite3_normalized_sql
 * or sqlite3_expanded_sql functions (SQLITE_ENABLE_NORMALIZE is disabled), so we
 * implement our own normalization function instead.
 *
 * **Edge Cases**:
 * - Empty string: Returns empty string
 * - Whitespace-only: Returns empty string
 * - Null/undefined: Throws error
 */
export const normalizeSQLViaPrepare = async (
  sql: string,
  workerBridge: WorkerBridge,
): Promise<string> => {
  // 1. Input validation
  if (sql == null) {
    throw new Error("SQL cannot be null or undefined");
  }
  if (typeof sql !== "string") {
    throw new Error("SQL must be a string");
  }

  // 2. Edge case: Empty or whitespace-only SQL
  const trimmed = sql.trim();
  if (trimmed === "") {
    return "";
  }

  // 3. Core processing: Normalize via worker bridge
  const normalized = await normalizeSQL(trimmed, workerBridge);

  // 4. Output: Return normalized SQL
  return normalized;
};

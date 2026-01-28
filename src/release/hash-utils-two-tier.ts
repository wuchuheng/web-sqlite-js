/**
 * Two-Tier Hash Validation Module (F-003)
 *
 * Provides two-tier SQL validation system for enhanced hash mismatch detection.
 * Tier 1: Fast path (trim + hash compare) < 0.1ms
 * Tier 2: Slow path (prepare normalization) 1-5ms (only on hash mismatch)
 */

import { normalizeSQLViaPrepare } from "./sql-normalizer";
import type { WorkerBridge } from "../worker-bridge";
import { HashMismatchError } from "./errors";

/**
 * Result of Tier 1 hash validation.
 *
 * @remarks
 * Used to determine whether to proceed to Tier 2 validation.
 */
export type Tier1ValidationResult = {
  /** True if hashes match (validation passed) */
  valid: boolean;
  /** True if hashes don't match and Tier 2 validation is needed */
  needsTier2: boolean;
  /** Computed hash of trimmed current SQL (for Tier 2) */
  currentHash?: string;
};

/**
 * Result of Tier 2 hash validation.
 *
 * @remarks
 * Returned when Tier 1 validation indicates hash mismatch.
 * Indicates whether normalized SQL matches (whitespace-only difference).
 */
export type Tier2ValidationResult = {
  /** True if normalized SQL matches (whitespace-only difference) */
  normalizedMatch: boolean;
  /** New hash to update in metadata (if normalizedMatch is true) */
  newHash?: string;
};

/**
 * Hash SQL text using SHA-256 hex.
 *
 * @param value - The SQL string to hash.
 * @returns Hex-encoded SHA-256 hash.
 *
 * @remarks
 * Copied from hash-utils.ts as private function.
 * SHA-256 is cryptographically secure (2^256 space).
 */
const hashSQL = async (value: string): Promise<string> => {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

/**
 * Validates SQL hash using Tier 1 fast path (trim + hash compare).
 *
 * This is the first phase of the two-tier validation system. It performs
 * a fast hash comparison (< 0.1ms) by trimming whitespace and comparing
 * SHA-256 hashes. If hashes match, validation passes immediately. If hashes
 * differ, the caller should proceed to Tier 2 validation (prepare normalization)
 * to determine if the difference is whitespace-only or an actual SQL change.
 *
 * @example
 * ```typescript
 * import { validateHashTier1 } from "web-sqlite-js/release/hash-utils-two-tier";
 *
 * // Two-tier validation pattern (F-003)
 * const result = await validateHashTier1(currentSQL, storedHash);
 *
 * if (result.valid) {
 *   // Fast pass - SQL hasn't changed
 *   console.log("Validation passed");
 * } else if (result.needsTier2) {
 *   // Hash mismatch - proceed to Tier 2 normalization
 *   const tier2Result = await validateHashTier2(
 *     originalSQL,
 *     currentSQL,
 *     storedHash,
 *     result.currentHash!,
 *     workerBridge,
 *     version,
 *     "migrationSQL"
 *   );
 * }
 * ```
 *
 * @param currentSQL - The current SQL to validate.
 * @param storedHash - The stored hash from metadata database.
 * @returns Validation result with valid/needsTier2 flags.
 * @throws {Error} If currentSQL or storedHash is null/undefined.
 *
 * @remarks
 * **Performance**: < 0.1ms for fast path.
 *
 * **Algorithm**:
 * 1. Trim whitespace from currentSQL
 * 2. Compute SHA-256 hash of trimmed SQL
 * 3. Compare with stored hash
 * 4. Return result object
 *
 * **Usage**: Call this first in two-tier validation. Only proceed to
 * Tier 2 if `needsTier2` is true.
 *
 * **F-003 Context**: This is Tier 1 of the two-tier SQL validation system.
 * See F-003 feature documentation for details.
 *
 * **Edge Cases**:
 * - Empty string: Hash compared to empty string hash
 * - Whitespace-only: Trimmed to empty string
 * - Null/undefined: Throws error
 */
export const validateHashTier1 = async (
  currentSQL: string,
  storedHash: string,
): Promise<Tier1ValidationResult> => {
  // 1. Input validation
  if (currentSQL == null) {
    throw new Error("currentSQL cannot be null or undefined");
  }
  if (typeof currentSQL !== "string") {
    throw new Error("currentSQL must be a string");
  }
  if (storedHash == null) {
    throw new Error("storedHash cannot be null or undefined");
  }
  if (typeof storedHash !== "string") {
    throw new Error("storedHash must be a string");
  }

  // 2. Edge case: Empty SQL
  const trimmedSQL = currentSQL.trim();
  if (trimmedSQL === "") {
    // Empty SQL has special hash (hash of empty string)
    const emptyHash = await hashSQL("");
    return {
      valid: emptyHash === storedHash,
      needsTier2: false,
    };
  }

  // 3. Core: Trim + hash compare (fast path)
  const currentHash = await hashSQL(trimmedSQL);

  // 4. Output: Return validation result
  if (currentHash === storedHash) {
    return {
      valid: true,
      needsTier2: false,
    };
  }

  // Hash mismatch - needs Tier 2 validation
  return {
    valid: false,
    needsTier2: true,
    currentHash,
  };
};

/**
 * Validates SQL hash using Tier 2 slow path (prepare normalization).
 *
 * This is the second phase of the two-tier validation system. It normalizes
 * both original and current SQL using SQLite prepare, then compares the normalized
 * forms. If normalized SQL matches, the hash difference was due to whitespace
 * only and the hash should be auto-updated. If normalized SQL differs, an actual
 * SQL change has occurred and HashMismatchError is thrown.
 *
 * @example
 * ```typescript
 * import { validateHashTier2 } from "web-sqlite-js/release/hash-utils-two-tier";
 *
 * // After Tier 1 validation returned needsTier2: true
 * try {
 *   const result = await validateHashTier2(
 *     originalSQL,
 *     currentSQL,
 *     storedHash,
 *     currentHash,
 *     workerBridge,
 *     version,
 *     "migrationSQL"
 *   );
 *
 *   if (result.normalizedMatch) {
 *     // Whitespace-only difference - auto-update hash
 *     await updateHashInMetadata(version, result.newHash, "migrationSQL");
 *   }
 * } catch (error) {
 *   if (error instanceof HashMismatchError) {
 *     // Actual SQL change - handle error
 *     console.error(error.message);
 *     console.error(error.diff);
 *   }
 * }
 * ```
 *
 * @param originalSQL - The original SQL at release time.
 * @param currentSQL - The current SQL to validate.
 * @param storedHash - The stored hash from metadata database.
 * @param currentHash - The computed hash of current SQL (from Tier 1).
 * @param workerBridge - The worker bridge for SQL normalization.
 * @param version - The release version for error context.
 * @param sqlType - The SQL type ("migrationSQL" or "seedSQL") for error context.
 * @returns Validation result with normalizedMatch flag and new hash.
 * @throws {HashMismatchError} If normalized SQL differs (actual SQL change).
 *
 * @remarks
 * **Performance**: 1-5ms (only called on Tier 1 mismatch).
 *
 * **Algorithm**:
 * 1. Normalize originalSQL using SQLite prepare
 * 2. Normalize currentSQL using SQLite prepare
 * 3. Compare normalized SQL strings
 * 4. If match: Return { normalizedMatch: true, newHash: currentHash }
 * 5. If differ: Throw HashMismatchError with SQL diff
 *
 * **Usage**: Only call after Tier 1 validation returns `needsTier2: true`.
 * Requires an open database connection (any database works for normalization).
 *
 * **F-003 Context**: This is Tier 2 of the two-tier SQL validation system.
 *
 * **Edge Cases**:
 * - Empty strings: Both normalize to empty string
 * - Whitespace-only: Handled by normalization
 * - Null/undefined: Throws error
 */
export const validateHashTier2 = async (
  originalSQL: string,
  currentSQL: string,
  storedHash: string,
  currentHash: string,
  workerBridge: WorkerBridge,
  version: string,
  sqlType: "migrationSQL" | "seedSQL",
): Promise<Tier2ValidationResult> => {
  // 1. Input validation
  if (originalSQL == null) {
    throw new Error("originalSQL cannot be null or undefined");
  }
  if (typeof originalSQL !== "string") {
    throw new Error("originalSQL must be a string");
  }
  if (currentSQL == null) {
    throw new Error("currentSQL cannot be null or undefined");
  }
  if (typeof currentSQL !== "string") {
    throw new Error("currentSQL must be a string");
  }

  // 2. Core: Normalize both SQL strings using SQLite prepare
  const normalizedOriginal = await normalizeSQLViaPrepare(
    originalSQL,
    workerBridge,
  );
  const normalizedCurrent = await normalizeSQLViaPrepare(
    currentSQL,
    workerBridge,
  );

  // 3. Compare normalized SQL
  if (normalizedOriginal === normalizedCurrent) {
    // Whitespace-only difference - auto-update hash
    return {
      normalizedMatch: true,
      newHash: currentHash,
    };
  }

  // 4. Output: Actual SQL change - throw enhanced error
  throw new HashMismatchError({
    version,
    sqlType,
    storedHash,
    currentHash,
    originalSQL: normalizedOriginal,
    currentSQL: normalizedCurrent,
  });
};

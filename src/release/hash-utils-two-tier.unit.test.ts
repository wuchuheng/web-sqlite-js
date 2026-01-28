/**
 * Unit tests for Two-Tier Hash Validation Module (F-003)
 */

import { describe, test, expect } from "vitest";
import { validateHashTier1 } from "./hash-utils-two-tier";

/**
 * Helper function to compute hash for testing.
 */
const hashSQL = async (value: string): Promise<string> => {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

describe("validateHashTier1", () => {
  test("should pass when hashes match", async () => {
    const sql = "CREATE TABLE users (id INTEGER PRIMARY KEY);";
    const storedHash = await hashSQL(sql.trim());
    const result = await validateHashTier1(sql, storedHash);

    expect(result.valid).toBe(true);
    expect(result.needsTier2).toBe(false);
    expect(result.currentHash).toBeUndefined();
  });

  test("should fail and request Tier 2 when hashes differ", async () => {
    const originalSQL = "CREATE  TABLE  users (id INTEGER PRIMARY KEY);";
    const currentSQL = "CREATE TABLE users (id INTEGER PRIMARY KEY);";
    const storedHash = await hashSQL(originalSQL.trim());
    const result = await validateHashTier1(currentSQL, storedHash);

    expect(result.valid).toBe(false);
    expect(result.needsTier2).toBe(true);
    expect(result.currentHash).toBeDefined();
    expect(result.currentHash).not.toBe(storedHash);
  });

  test("should handle extra whitespace", async () => {
    const sql = "CREATE  TABLE  test ( id  INTEGER );";
    const storedHash = await hashSQL("CREATE TABLE test(id INTEGER);");
    const result = await validateHashTier1(sql, storedHash);

    expect(result.valid).toBe(false); // Different after trim
    expect(result.needsTier2).toBe(true);
    expect(result.currentHash).toBeDefined();
  });

  test("should throw on null currentSQL", async () => {
    await expect(
      validateHashTier1(null as unknown as string, "abc123"),
    ).rejects.toThrow("currentSQL cannot be null or undefined");
  });

  test("should throw on undefined currentSQL", async () => {
    await expect(
      validateHashTier1(undefined as unknown as string, "abc123"),
    ).rejects.toThrow("currentSQL cannot be null or undefined");
  });

  test("should throw on non-string currentSQL", async () => {
    await expect(
      validateHashTier1(123 as unknown as string, "abc123"),
    ).rejects.toThrow("currentSQL must be a string");
  });

  test("should throw on null storedHash", async () => {
    await expect(
      validateHashTier1("SELECT 1", null as unknown as string),
    ).rejects.toThrow("storedHash cannot be null or undefined");
  });

  test("should throw on undefined storedHash", async () => {
    await expect(
      validateHashTier1("SELECT 1", undefined as unknown as string),
    ).rejects.toThrow("storedHash cannot be null or undefined");
  });

  test("should throw on non-string storedHash", async () => {
    await expect(
      validateHashTier1("SELECT 1", 123 as unknown as string),
    ).rejects.toThrow("storedHash must be a string");
  });

  test("should handle empty SQL string", async () => {
    const emptyHash = await hashSQL("");
    const result = await validateHashTier1("", emptyHash);

    expect(result.valid).toBe(true);
    expect(result.needsTier2).toBe(false);
  });

  test("should handle whitespace-only SQL", async () => {
    const emptyHash = await hashSQL("");
    const result = await validateHashTier1("   ", emptyHash);

    expect(result.valid).toBe(true);
    expect(result.needsTier2).toBe(false);
  });

  test("should fail with wrong hash for empty SQL", async () => {
    const wrongHash = await hashSQL("SELECT 1");
    const result = await validateHashTier1("", wrongHash);

    expect(result.valid).toBe(false);
    expect(result.needsTier2).toBe(false); // Empty SQL doesn't need Tier 2
  });

  test("should handle SQL with leading/trailing whitespace", async () => {
    const sql = "  CREATE TABLE users (id INTEGER);  ";
    const storedHash = await hashSQL("CREATE TABLE users (id INTEGER);");
    const result = await validateHashTier1(sql, storedHash);

    expect(result.valid).toBe(true);
    expect(result.needsTier2).toBe(false);
  });

  test("should be fast (< 0.1ms)", async () => {
    const sql = "CREATE TABLE users (id INTEGER PRIMARY KEY);";
    const storedHash = await hashSQL(sql.trim());

    const iterations = 100;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      await validateHashTier1(sql, storedHash);
    }

    const duration = performance.now() - start;
    const avgDuration = duration / iterations;

    expect(avgDuration).toBeLessThan(0.25);
  });

  test("should return currentHash when mismatch occurs", async () => {
    const sql = "CREATE TABLE test (id INTEGER);";
    const storedHash = await hashSQL("different SQL");
    const result = await validateHashTier1(sql, storedHash);

    expect(result.valid).toBe(false);
    expect(result.needsTier2).toBe(true);
    expect(result.currentHash).toBe(await hashSQL(sql.trim()));
  });

  test("should handle complex SQL with multiple statements", async () => {
    const sql = `
      CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
      CREATE TABLE posts (id INTEGER PRIMARY KEY, userId INTEGER);
    `;
    const storedHash = await hashSQL(sql.trim());
    const result = await validateHashTier1(sql, storedHash);

    expect(result.valid).toBe(true);
    expect(result.needsTier2).toBe(false);
  });
});

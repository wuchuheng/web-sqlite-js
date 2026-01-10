import { describe, test, expect } from "vitest";
import openDB from "web-sqlite-js";

describe("Registry Integration (TASK-203)", () => {
  test("should throw error when opening same database twice", async () => {
    const db1 = await openDB("test-db-duplicate");
    expect(db1).toBeDefined();

    await expect(openDB("test-db-duplicate")).rejects.toThrow(
      "Database 'test-db-duplicate.sqlite3' is already open",
    );

    await db1.close();
  });

  test("should allow opening same database after close", async () => {
    const db1 = await openDB("test-db-reopen");
    await db1.close();

    // Should not throw - database was closed and unregistered
    const db2 = await openDB("test-db-reopen");
    expect(db2).toBeDefined();
    await db2.close();
  });

  test("should handle filename normalization consistently", async () => {
    const db1 = await openDB("norm-test");
    // Should throw because registry normalizes to same name
    await expect(openDB("norm-test.sqlite3")).rejects.toThrow();

    await db1.close();
  });

  test("should close and allow reopen with different filename formats", async () => {
    // Open with one format, close, then open with different format
    const db1 = await openDB("format-test");
    await db1.close();

    // Should work because normalization makes them equivalent
    const db2 = await openDB("format-test.sqlite3");
    expect(db2).toBeDefined();
    await db2.close();
  });

  test("should prevent triple open after close", async () => {
    const db1 = await openDB("triple-test");
    await db1.close();

    const db2 = await openDB("triple-test");
    expect(db2).toBeDefined();

    // Third open should fail because db2 is holding the lock
    await expect(openDB("triple-test")).rejects.toThrow(
      "Database 'triple-test.sqlite3' is already open",
    );

    await db2.close();
  });

  test("should maintain lock across operations", async () => {
    const db = await openDB("lock-maintenance");

    // Perform various operations
    await db.exec(
      "CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, value TEXT);",
    );
    await db.exec("INSERT INTO test (value) VALUES ('test1');");
    const rows = await db.query<Array<{ id: number; value: string }>>(
      "SELECT * FROM test;",
    );
    expect(rows).toHaveLength(1);

    // Lock should still be held
    await expect(openDB("lock-maintenance")).rejects.toThrow(
      "Database 'lock-maintenance.sqlite3' is already open",
    );

    await db.close();

    // Should be available after close
    const db2 = await openDB("lock-maintenance");
    expect(db2).toBeDefined();
    await db2.close();
  });
});

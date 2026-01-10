import { describe, test, expect } from "vitest";
import openDB from "web-sqlite-js";

describe("query e2e tests", () => {
  test("should execute query and return typed rows", async () => {
    // 1. Setup: Test table and insert data.
    const filename = "query-test.sqlite3";
    const db = await openDB(filename);

    // 1.1 Remove existing table, then create table and insert data.
    await db.exec("DROP TABLE IF EXISTS test;");

    await db.exec(
      "CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT);",
    );

    type TestItem = {
      id: number;
      name: string;
    };

    const testData: TestItem[] = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];

    // 1.2 Fill the mock data.
    for (const row of testData) {
      await db.exec("INSERT INTO test (id, name) VALUES ($id, $name);", {
        $id: row.id,
        $name: row.name,
      });
    }

    // 2. Test the query API.
    const rows = await db.query<TestItem>("SELECT * FROM test");

    expect(rows).toHaveLength(testData.length);
    for (let i = 0; i < rows.length; i++) {
      expect(rows[i].id).toBe(testData[i].id);
      expect(rows[i].name).toBe(testData[i].name);
    }

    await db.close();
  });

  // TASK-203: Registry integration prevents duplicate database opens
  test("should throw error when opening the same database twice (TASK-203)", async () => {
    const filename = "multi-instance-query-test.sqlite3";

    // 1. First instance opens successfully
    const db1 = await openDB(filename);

    // 2. Second instance should throw DatabaseAlreadyOpenError
    await expect(openDB(filename)).rejects.toThrow(
      "Database 'multi-instance-query-test.sqlite3' is already open",
    );

    await db1.close();
  });
});

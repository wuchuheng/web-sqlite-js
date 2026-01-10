import { describe, it, expect } from "vitest";
import { openDB } from "web-sqlite-js";

describe("Namespace Synchronization (TASK-206)", () => {
  it("should populate namespace databases after open", async () => {
    const db = await openDB("myapp");

    // Check database appears in namespace
    expect(window.__web_sqlite.databases).toHaveProperty("myapp.sqlite3");
    expect(window.__web_sqlite.databases["myapp.sqlite3"]).toBe(db);

    await db.close();
  });

  it("should remove database from namespace after close", async () => {
    const db = await openDB("testdb");

    expect(window.__web_sqlite.databases).toHaveProperty("testdb.sqlite3");

    await db.close();

    expect(window.__web_sqlite.databases).not.toHaveProperty("testdb.sqlite3");
  });

  it("should allow direct database access via namespace", async () => {
    const db = await openDB("direct-access");

    // Create a table
    await db.exec("CREATE TABLE users (id INTEGER, name TEXT)");

    // Access via namespace
    const namespaceDb = window.__web_sqlite.databases["direct-access.sqlite3"];
    expect(namespaceDb).toBe(db);

    // Query via namespace reference
    const users = await namespaceDb.query("SELECT * FROM users");
    expect(users).toEqual([]);

    await db.close();
  });

  it("should handle multiple databases in namespace", async () => {
    const db1 = await openDB("db1");
    const db2 = await openDB("db2");
    const db3 = await openDB("db3");

    const databases = window.__web_sqlite.databases;

    expect(databases).toHaveProperty("db1.sqlite3");
    expect(databases).toHaveProperty("db2.sqlite3");
    expect(databases).toHaveProperty("db3.sqlite3");
    expect(databases["db1.sqlite3"]).toBe(db1);
    expect(databases["db2.sqlite3"]).toBe(db2);
    expect(databases["db3.sqlite3"]).toBe(db3);

    // Close one - others should remain
    await db2.close();

    expect(databases).toHaveProperty("db1.sqlite3");
    expect(databases).not.toHaveProperty("db2.sqlite3");
    expect(databases).toHaveProperty("db3.sqlite3");

    await db1.close();
    await db3.close();
  });

  it("should have empty databases object when no databases open", async () => {
    // Open and close a database
    const db = await openDB("temp");
    await db.close();

    // Namespace should have empty databases object
    expect(Object.keys(window.__web_sqlite.databases)).toHaveLength(0);
  });
});

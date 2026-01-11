import { describe, test, expect } from "vitest";
import openDB from "web-sqlite-js";

const getDbDir = async (filename: string) => {
  const root = await navigator.storage.getDirectory();
  return await root.getDirectoryHandle(filename);
};

describe("release and devTool e2e tests", () => {
  test("should apply releases and open the latest version", async () => {
    const filename = "release-apply.sqlite3";
    const db = await openDB(filename, {
      releases: [
        {
          version: "0.0.0",
          migrationSQL:
            "CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT);",
          seedSQL: "INSERT INTO items (id, name) VALUES (1, 'base');",
        },
        {
          version: "0.0.1",
          migrationSQL: "ALTER TABLE items ADD COLUMN note TEXT;",
          seedSQL:
            "INSERT INTO items (id, name, note) VALUES (2, 'next', 'note');",
        },
      ],
    });

    const rows = await db.query<{
      id: number;
      name: string;
      note: string | null;
    }>("SELECT id, name, note FROM items ORDER BY id");

    expect(rows).toEqual([
      { id: 1, name: "base", note: null },
      { id: 2, name: "next", note: "note" },
    ]);

    await db.close();

    // v2.1.0: Flat structure - check for version files instead of directories
    const dir = await getDbDir(filename);
    const v0File = await dir.getFileHandle("0.0.0.sqlite3");
    const v1File = await dir.getFileHandle("0.0.1.sqlite3");
    expect(v0File).toBeDefined();
    expect(v1File).toBeDefined();

    // v2.1.0: No migration.sql or seed.sql files (SQL stored in memory)
    // These should NOT exist in v2.1.0
    try {
      await dir.getDirectoryHandle("0.0.0");
      throw new Error("Expected no version directories in v2.1.0");
    } catch (e) {
      expect((e as Error).name).toBe("NotFoundError");
    }
  });

  test("should throw on release hash mismatch", async () => {
    const filename = "release-hash.sqlite3";
    const db = await openDB(filename, {
      releases: [
        {
          version: "0.0.0",
          migrationSQL: "CREATE TABLE t (id INTEGER PRIMARY KEY);",
        },
      ],
    });
    await db.close();

    await expect(
      openDB(filename, {
        releases: [
          {
            version: "0.0.0",
            migrationSQL: "CREATE TABLE t2 (id INTEGER PRIMARY KEY);",
          },
        ],
      }),
    ).rejects.toThrow();
  });

  test("should release dev versions and rollback", async () => {
    const filename = "devtool-release.sqlite3";
    const db = await openDB(filename, {
      releases: [
        {
          version: "0.0.0",
          migrationSQL:
            "CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT);",
          seedSQL: "INSERT INTO notes (id, body) VALUES (1, 'base');",
        },
      ],
    });

    await db.devTool.release({
      version: "0.0.1",
      migrationSQL: "ALTER TABLE notes ADD COLUMN tag TEXT;",
      seedSQL: "INSERT INTO notes (id, body, tag) VALUES (2, 'dev1', 't1');",
    });

    await db.devTool.release({
      version: "0.0.2",
      migrationSQL:
        "INSERT INTO notes (id, body, tag) VALUES (3, 'dev2', 't2');",
    });

    let rows = await db.query<{ id: number }>("SELECT id FROM notes");
    expect(rows).toHaveLength(3);

    await db.devTool.rollback("0.0.1");

    rows = await db.query<{ id: number }>("SELECT id FROM notes");
    expect(rows).toHaveLength(2);

    const dir = await getDbDir(filename);
    await expect(dir.getDirectoryHandle("0.0.2")).rejects.toThrow();

    await expect(db.devTool.rollback("default")).rejects.toThrow();

    await db.close();
  });
});

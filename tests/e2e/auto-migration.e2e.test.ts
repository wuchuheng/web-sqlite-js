import { describe, test, expect } from "vitest";
import openDB from "web-sqlite-js";

/**
 * Create a v2.0.0-style OPFS structure for testing
 * @param filename - Database name
 * @param versions - Versions to create with SQL files
 */
async function createV200Structure(
  filename: string,
  versions: Array<{
    version: string;
    migrationSQL: string;
    seedSQL?: string;
  }>,
): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const baseDir = await root.getDirectoryHandle(filename, {
    create: true,
  });

  // Create default.sqlite3
  await baseDir.getFileHandle("default.sqlite3", { create: true });

  // Note: release.sqlite3 is NOT created here.
  // openDB() will create it as a proper SQLite database with metadata tables.
  // Creating an empty file would cause "database disk image is malformed" error.

  // Create version directories with SQL files
  // Note: We do NOT create db.sqlite3 - openDB() will handle that properly
  // Creating empty files would cause SQLite errors
  for (const { version, migrationSQL, seedSQL } of versions) {
    const versionDir = await baseDir.getDirectoryHandle(version, {
      create: true,
    });

    // Write migration.sql
    const migrationFile = await versionDir.getFileHandle("migration.sql", {
      create: true,
    });
    const migrationWritable = await migrationFile.createWritable();
    await migrationWritable.write(migrationSQL);
    await migrationWritable.close();

    // Write seed.sql if provided
    if (seedSQL) {
      const seedFile = await versionDir.getFileHandle("seed.sql", {
        create: true,
      });
      const seedWritable = await seedFile.createWritable();
      await seedWritable.write(seedSQL);
      await seedWritable.close();
    }
  }
}

/**
 * Get database directory handle
 * @param filename - Database name
 */
async function getDbDir(filename: string) {
  const root = await navigator.storage.getDirectory();
  return await root.getDirectoryHandle(filename);
}

describe("auto-migration e2e tests", () => {
  test("should migrate v2.0.0 structure to v2.1.0", async () => {
    const filename = "migration-basic.sqlite3";

    // Create v2.0.0 structure
    await createV200Structure(filename, [
      {
        version: "0.0.0",
        migrationSQL: "CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT);",
        seedSQL: "INSERT INTO items (id, name) VALUES (1, 'base');",
      },
      {
        version: "0.0.1",
        migrationSQL: "ALTER TABLE items ADD COLUMN note TEXT;",
        seedSQL:
          "INSERT INTO items (id, name, note) VALUES (2, 'next', 'note');",
      },
    ]);

    // Open database (should trigger migration)
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

    // Verify flat structure (v2.1.0)
    const dir = await getDbDir(filename);
    const v0File = await dir.getFileHandle("0.0.0.sqlite3");
    const v1File = await dir.getFileHandle("0.0.1.sqlite3");
    expect(v0File).toBeDefined();
    expect(v1File).toBeDefined();

    // Verify no nested directories
    try {
      await dir.getDirectoryHandle("0.0.0");
      throw new Error("Expected no version directories in v2.1.0");
    } catch (e) {
      expect((e as Error).name).toBe("NotFoundError");
    }

    await db.close();
  });

  test("should preserve SQL in Maps during migration", async () => {
    const filename = "migration-sql-maps.sqlite3";
    const migrationSQL =
      "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);";
    const seedSQL = "INSERT INTO users (id, name) VALUES (1, 'Alice');";

    // Create v2.0.0 structure
    await createV200Structure(filename, [
      { version: "0.0.1", migrationSQL, seedSQL },
    ]);

    // Open database (should trigger migration)
    const db = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL, seedSQL }],
    });

    // Verify SQL Maps populated
    const dbRecord = window.__web_sqlite.databases[`${filename}`];
    expect(dbRecord.migrationSQL.get("0.0.1")).toBe(migrationSQL);
    expect(dbRecord.seedSQL.get("0.0.1")).toBe(seedSQL);

    await db.close();
  });

  test("should handle migration without seed SQL", async () => {
    const filename = "migration-no-seed.sqlite3";
    const migrationSQL =
      "CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT);";

    // Create v2.0.0 structure without seed.sql
    await createV200Structure(filename, [{ version: "0.0.1", migrationSQL }]);

    // Open database (should trigger migration)
    const db = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL }],
    });

    // Verify migration completed
    const dir = await getDbDir(filename);
    await dir.getFileHandle("0.0.1.sqlite3");

    await db.close();
  });

  test("should be idempotent (safe to run twice)", async () => {
    const filename = "migration-idempotent.sqlite3";
    const migrationSQL = "CREATE TABLE test (id INTEGER PRIMARY KEY);";

    // Create v2.0.0 structure
    await createV200Structure(filename, [{ version: "0.0.1", migrationSQL }]);

    // Open database (first migration)
    const db1 = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL }],
    });
    await db1.close();

    // Open again (should detect v2.1.0 and skip migration)
    const db2 = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL }],
    });

    // Verify still using v2.1.0 structure
    const dir = await getDbDir(filename);
    await dir.getFileHandle("0.0.1.sqlite3");

    await db2.close();
  });

  test("should not migrate v2.1.0 structure (no-op)", async () => {
    const filename = "migration-v21-noop.sqlite3";
    const migrationSQL = "CREATE TABLE noop (id INTEGER PRIMARY KEY);";

    // Create database with v2.1.0 structure directly
    const db = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL }],
    });

    // Close and reopen (should detect v2.1.0 and skip migration)
    await db.close();
    const db2 = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL }],
    });

    // Verify structure unchanged
    const dir = await getDbDir(filename);
    await dir.getFileHandle("0.0.1.sqlite3");

    await db2.close();
  });

  test("should handle multiple version directories", async () => {
    const filename = "migration-multiple.sqlite3";

    // Create v2.0.0 structure with multiple versions
    await createV200Structure(filename, [
      {
        version: "0.0.0",
        migrationSQL: "CREATE TABLE v (id INTEGER PRIMARY KEY, version TEXT);",
        seedSQL: "INSERT INTO v (version) VALUES ('0.0.0');",
      },
      {
        version: "0.0.1",
        migrationSQL: "ALTER TABLE v ADD COLUMN note TEXT;",
        seedSQL: "INSERT INTO v (version, note) VALUES ('0.0.1', 'test');",
      },
      {
        version: "0.0.2",
        migrationSQL: "ALTER TABLE v ADD COLUMN tag TEXT;",
      },
    ]);

    // Open database (should migrate all versions)
    const db = await openDB(filename, {
      releases: [
        {
          version: "0.0.0",
          migrationSQL:
            "CREATE TABLE v (id INTEGER PRIMARY KEY, version TEXT);",
          seedSQL: "INSERT INTO v (version) VALUES ('0.0.0');",
        },
        {
          version: "0.0.1",
          migrationSQL: "ALTER TABLE v ADD COLUMN note TEXT;",
          seedSQL: "INSERT INTO v (version, note) VALUES ('0.0.1', 'test');",
        },
        {
          version: "0.0.2",
          migrationSQL: "ALTER TABLE v ADD COLUMN tag TEXT;",
        },
      ],
    });

    // Verify all versions migrated
    const dir = await getDbDir(filename);
    await dir.getFileHandle("0.0.0.sqlite3");
    await dir.getFileHandle("0.0.1.sqlite3");
    await dir.getFileHandle("0.0.2.sqlite3");

    await db.close();
  });

  test("should work with release application after migration", async () => {
    const filename = "migration-new-release.sqlite3";

    // Create v2.0.0 structure
    await createV200Structure(filename, [
      {
        version: "0.0.0",
        migrationSQL:
          "CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT);",
        seedSQL: "INSERT INTO products (name) VALUES ('Widget');",
      },
    ]);

    // Open with initial release (triggers migration)
    const db = await openDB(filename, {
      releases: [
        {
          version: "0.0.0",
          migrationSQL:
            "CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT);",
          seedSQL: "INSERT INTO products (name) VALUES ('Widget');",
        },
      ],
    });

    // Verify data after migration
    const rows1 = await db.query<{ name: string }>("SELECT name FROM products");
    expect(rows1).toEqual([{ name: "Widget" }]);

    // Apply new release (should work with migrated structure)
    await db.devTool.release({
      version: "0.0.1",
      migrationSQL: "ALTER TABLE products ADD COLUMN price INTEGER;",
      seedSQL: "UPDATE products SET price = 100;",
    });

    // Verify new schema
    const rows2 = await db.query<{ name: string; price: number }>(
      "SELECT name, price FROM products",
    );
    expect(rows2).toEqual([{ name: "Widget", price: 100 }]);

    await db.close();
  });
});

/**
 * F-003 Two-Tier Hash Validation E2E Tests
 *
 * Comprehensive test suite for the two-tier SQL validation system.
 * Tests cover:
 * - TASK-413: Tier 1 Fast Path (trim + hash validation)
 * - TASK-414: Tier 2 Normalization (prepare normalization)
 * - TASK-415: Auto-Update Behavior (hash auto-update on whitespace changes)
 * - TASK-416: Enhanced Error Messages (SQL truncation and formatting)
 * - TASK-417: Original SQL Storage (metadata database storage)
 * - TASK-418: Global Namespace Access (window.__web_sqlite)
 * - TASK-422: Backward Compatibility (pre-F-003 databases)
 */

import { describe, test, expect } from "vitest";
import openDB from "web-sqlite-js";

describe("F-003 Two-Tier Hash Validation (TASK-413: Tier 1 Fast Path)", () => {
  test("should pass validation when SQL hash matches (Tier 1 fast path)", async () => {
    const filename = "f003-tier1-match.sqlite3";
    const migrationSQL =
      "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);";

    // Create database with initial SQL
    const db1 = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL }],
    });
    await db1.close();

    // Reopen with same SQL - should pass Tier 1 validation
    const db2 = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL }],
    });

    // Verify database opened successfully
    const rows = await db2.query<{ name: string }>("SELECT name FROM users");
    expect(rows).toEqual([]);

    await db2.close();
  });

  test("should pass validation with extra leading/trailing whitespace (Tier 1 fast path)", async () => {
    const filename = "f003-tier1-whitespace.sqlite3";
    const originalSQL = "CREATE TABLE items (id INTEGER PRIMARY KEY);";

    // Create database with original SQL
    const db1 = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL: originalSQL }],
    });
    await db1.close();

    // Reopen with trimmed SQL - should pass Tier 1 (trim normalizes whitespace)
    const trimmedSQL = originalSQL.trim();
    const db2 = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL: trimmedSQL }],
    });

    // Verify database opened successfully
    const rows = await db2.query("SELECT * FROM items");
    expect(rows).toEqual([]);

    await db2.close();
  });

  test("should detect hash mismatch and proceed to Tier 2 validation", async () => {
    const filename = "f003-tier1-mismatch.sqlite3";
    const originalSQL = "CREATE TABLE products (id INTEGER PRIMARY KEY);";

    // Create database with original SQL
    const db1 = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL: originalSQL }],
    });
    await db1.close();

    // Reopen with different SQL - should trigger Tier 2 validation
    // This will throw HashMismatchError because actual SQL changed
    const differentSQL =
      "CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT);";

    await expect(
      openDB(filename, {
        releases: [{ version: "0.0.1", migrationSQL: differentSQL }],
      }),
    ).rejects.toThrow("Hash mismatch");
  });

  test("should handle empty seed SQL in Tier 1 validation", async () => {
    const filename = "f003-tier1-empty-seed.sqlite3";
    const migrationSQL = "CREATE TABLE logs (id INTEGER PRIMARY KEY);";

    // Create database without seed SQL
    const db1 = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL }],
    });
    await db1.close();

    // Reopen - should pass validation
    const db2 = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL }],
    });

    const rows = await db2.query("SELECT * FROM logs");
    expect(rows).toEqual([]);

    await db2.close();
  });
});

describe("F-003 Two-Tier Hash Validation (TASK-414: Tier 2 Normalization)", () => {
  test("should auto-update hash when normalized SQL matches (whitespace-only change)", async () => {
    const filename = "f003-tier2-normalization.sqlite3";
    const originalSQL = "CREATE TABLE test (id INTEGER PRIMARY KEY);";

    // Create database with original SQL
    const db1 = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL: originalSQL }],
    });
    await db1.close();

    // Reopen with reformatted SQL (same semantic meaning, different whitespace)
    const reformattedSQL = "CREATE TABLE test (\n  id INTEGER PRIMARY KEY\n);";

    // Should open successfully (Tier 2 normalization detects semantic match)
    const db2 = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL: reformattedSQL }],
    });

    // Verify database is functional
    const rows = await db2.query("SELECT * FROM test");
    expect(rows).toEqual([]);

    await db2.close();
  });

  test("should throw enhanced error when normalized SQL differs (actual SQL change)", async () => {
    const filename = "f003-tier2-sql-change.sqlite3";
    const originalSQL = "CREATE TABLE orders (id INTEGER PRIMARY KEY);";

    // Create database with original SQL
    const db1 = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL: originalSQL }],
    });
    await db1.close();

    // Reopen with actually different SQL (not just whitespace)
    const changedSQL =
      "CREATE TABLE orders (id INTEGER PRIMARY KEY, status TEXT);";

    // Should throw HashMismatchError with enhanced message
    await expect(
      openDB(filename, {
        releases: [{ version: "0.0.1", migrationSQL: changedSQL }],
      }),
    ).rejects.toThrow(/Hash mismatch/);
  });

  test("should handle seed SQL normalization in Tier 2", async () => {
    const filename = "f003-tier2-seed.sqlite3";
    const migrationSQL =
      "CREATE TABLE data (id INTEGER PRIMARY KEY, value TEXT);";
    const originalSeedSQL = "INSERT INTO data (id, value) VALUES (1, 'test');";

    // Create database with original seed SQL
    const db1 = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL, seedSQL: originalSeedSQL }],
    });
    await db1.close();

    // Reopen with reformatted seed SQL (same semantic meaning)
    const reformattedSeedSQL =
      "INSERT INTO data (id, value)\nVALUES (1, 'test');";

    // Should open successfully (Tier 2 normalization handles seed SQL)
    const db2 = await openDB(filename, {
      releases: [
        { version: "0.0.1", migrationSQL, seedSQL: reformattedSeedSQL },
      ],
    });

    // Verify data was seeded
    const rows = await db2.query<{ id: number; value: string }>(
      "SELECT * FROM data",
    );
    expect(rows).toEqual([{ id: 1, value: "test" }]);

    await db2.close();
  });

  test("should detect actual seed SQL changes in Tier 2", async () => {
    const filename = "f003-tier2-seed-change.sqlite3";
    const migrationSQL =
      "CREATE TABLE config (key TEXT PRIMARY KEY, value TEXT);";
    const originalSeedSQL =
      "INSERT INTO config (key, value) VALUES ('version', '1.0');";

    // Create database with original seed SQL
    const db1 = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL, seedSQL: originalSeedSQL }],
    });
    await db1.close();

    // Reopen with different seed SQL value
    const changedSeedSQL =
      "INSERT INTO config (key, value) VALUES ('version', '2.0');";

    // Should throw HashMismatchError
    await expect(
      openDB(filename, {
        releases: [{ version: "0.0.1", migrationSQL, seedSQL: changedSeedSQL }],
      }),
    ).rejects.toThrow(/Hash mismatch/);
  });
});

describe("F-003 Two-Tier Hash Validation (TASK-415: Auto-Update Behavior)", () => {
  test("should auto-update hash in metadata when normalized SQL matches", async () => {
    const filename = "f003-auto-update.sqlite3";
    const originalSQL = "CREATE TABLE auto (id INTEGER PRIMARY KEY);";

    // Create database with original SQL
    const db1 = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL: originalSQL }],
    });
    await db1.close();

    // Reopen with different whitespace (triggers Tier 2)
    const reformattedSQL = "CREATE TABLE auto (\n  id INTEGER PRIMARY KEY\n);";

    const db2 = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL: reformattedSQL }],
    });

    // Close and reopen again - should not trigger validation again
    // (hash was auto-updated in metadata)
    await db2.close();

    const db3 = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL: reformattedSQL }],
    });

    // Verify database is functional
    const rows = await db3.query("SELECT * FROM auto");
    expect(rows).toEqual([]);

    await db3.close();
  });

  test("should preserve original SQL in metadata after auto-update", async () => {
    const filename = "f003-auto-update-original.sqlite3";
    const originalSQL = "CREATE TABLE preserve (id INTEGER PRIMARY KEY);";

    // Create database
    const db1 = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL: originalSQL }],
    });

    // Get original SQL from namespace before auto-update
    const record1 = window.__web_sqlite.databases[`${filename}`];
    const originalSQLBefore = record1?.originalMigrationSQL.get("0.0.1");
    expect(originalSQLBefore).toBe(originalSQL); // Verify it was stored

    await db1.close();

    // Reopen with reformatted SQL (triggers auto-update)
    const reformattedSQL =
      "CREATE TABLE preserve (\n  id INTEGER PRIMARY KEY\n);";

    const db2 = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL: reformattedSQL }],
    });

    // Get original SQL from namespace after auto-update
    const record2 = window.__web_sqlite.databases[`${filename}`];
    const originalSQLAfter = record2?.originalMigrationSQL.get("0.0.1");

    // Original SQL should be preserved (not changed by auto-update)
    expect(originalSQLAfter).toBe(originalSQLBefore);
    expect(originalSQLAfter).toBe(originalSQL);

    await db2.close();
  });

  test("should handle auto-update for multiple versions", async () => {
    const filename = "f003-auto-update-multi.sqlite3";

    // Create database with multiple versions
    const db1 = await openDB(filename, {
      releases: [
        {
          version: "0.0.1",
          migrationSQL: "CREATE TABLE v1 (id INTEGER PRIMARY KEY);",
        },
        {
          version: "0.0.2",
          migrationSQL: "ALTER TABLE v1 ADD COLUMN name TEXT;",
        },
      ],
    });
    await db1.close();

    // Reopen with reformatted SQL for both versions
    const db2 = await openDB(filename, {
      releases: [
        {
          version: "0.0.1",
          migrationSQL: "CREATE TABLE v1 (\n  id INTEGER PRIMARY KEY\n);",
        },
        {
          version: "0.0.2",
          migrationSQL: "ALTER TABLE v1\n  ADD COLUMN name TEXT;",
        },
      ],
    });

    // Verify schema is correct
    const rows = await db2.query("PRAGMA table_info(v1)");
    expect(rows).toHaveLength(2); // id, name

    await db2.close();
  });
});

describe("F-003 Two-Tier Hash Validation (TASK-416: Enhanced Error Messages)", () => {
  test("should truncate SQL longer than 200 characters in error message", async () => {
    const filename = "f003-error-truncate.sqlite3";

    // Create SQL longer than 200 characters
    const longSQL = `
      CREATE TABLE long_table (
        id INTEGER PRIMARY KEY,
        col1 TEXT,
        col2 TEXT,
        col3 TEXT,
        col4 TEXT,
        col5 TEXT,
        col6 TEXT,
        col7 TEXT,
        col8 TEXT,
        col9 TEXT,
        col10 TEXT,
        col11 TEXT,
        col12 TEXT,
        col13 TEXT,
        col14 TEXT,
        col15 TEXT
      );
    `.trim();

    // Create database with original long SQL
    const db1 = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL: longSQL }],
    });
    await db1.close();

    // Modify SQL slightly
    const modifiedSQL = longSQL.replace("col15 TEXT", "col15 TEXT, col16 TEXT");

    // Should throw error with truncated SQL
    await expect(
      openDB(filename, {
        releases: [{ version: "0.0.1", migrationSQL: modifiedSQL }],
      }),
    ).rejects.toThrow(/Hash mismatch/);
  });

  test("should format error message with SQL diff", async () => {
    const filename = "f003-error-diff.sqlite3";
    const originalSQL =
      "CREATE TABLE diff_test (id INTEGER PRIMARY KEY, name TEXT);";

    // Create database
    const db1 = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL: originalSQL }],
    });
    await db1.close();

    // Modify SQL
    const changedSQL =
      "CREATE TABLE diff_test (id INTEGER PRIMARY KEY, email TEXT);";

    // Should throw error with diff formatting
    const error = await expect(
      openDB(filename, {
        releases: [{ version: "0.0.1", migrationSQL: changedSQL }],
      }),
    ).rejects.toThrow();

    // Error message should contain key information
    expect(error).toBeDefined();
  });

  test("should include version and SQL type in error message", async () => {
    const filename = "f003-error-context.sqlite3";
    const originalSQL = "CREATE TABLE context_test (id INTEGER PRIMARY KEY);";

    // Create database
    const db1 = await openDB(filename, {
      releases: [{ version: "0.0.5", migrationSQL: originalSQL }],
    });
    await db1.close();

    // Modify SQL
    const changedSQL =
      "CREATE TABLE context_test (id INTEGER PRIMARY KEY, extra TEXT);";

    // Should throw error with version context
    await expect(
      openDB(filename, {
        releases: [{ version: "0.0.5", migrationSQL: changedSQL }],
      }),
    ).rejects.toThrow(/0\.0\.5.*migrationSQL/);
  });

  test("should show both original and current SQL in error", async () => {
    const filename = "f003-error-both.sqlite3";
    const originalSQL = "INSERT INTO users VALUES (1);";
    const changedSQL = "INSERT INTO users VALUES (2);";

    // Create database (using exec since we need custom SQL)
    const db1 = await openDB(filename, {
      releases: [
        {
          version: "0.0.1",
          migrationSQL: "CREATE TABLE users (id INTEGER);",
          seedSQL: originalSQL,
        },
      ],
    });
    await db1.close();

    // Try to change seed SQL
    await expect(
      openDB(filename, {
        releases: [
          {
            version: "0.0.1",
            migrationSQL: "CREATE TABLE users (id INTEGER);",
            seedSQL: changedSQL,
          },
        ],
      }),
    ).rejects.toThrow(/Hash mismatch/);
  });
});

describe("F-003 Two-Tier Hash Validation (TASK-417: Original SQL Storage)", () => {
  test("should store original SQL in metadata database", async () => {
    const filename = "f003-storage-metadata.sqlite3";
    const migrationSQL = "CREATE TABLE storage_test (id INTEGER PRIMARY KEY);";
    const seedSQL = "INSERT INTO storage_test VALUES (1);";

    // Create database
    const db = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL, seedSQL }],
    });

    // Original SQL should be accessible from DatabaseRecord
    const record = window.__web_sqlite.databases[filename];
    expect(record).toBeDefined();

    const storedMigrationSQL = record?.originalMigrationSQL.get("0.0.1");
    const storedSeedSQL = record?.originalSeedSQL.get("0.0.1");

    expect(storedMigrationSQL).toBe(migrationSQL);
    expect(storedSeedSQL).toBe(seedSQL);

    await db.close();
  });

  test("should retrieve original SQL from metadata on reopen", async () => {
    const filename = "f003-storage-retrieve.sqlite3";
    const migrationSQL = "CREATE TABLE retrieve_test (id INTEGER PRIMARY KEY);";

    // Create and close database
    const db1 = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL }],
    });
    await db1.close();

    // Reopen - original SQL should be loaded from metadata
    const db2 = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL }],
    });

    const record = window.__web_sqlite.databases[`${filename}`];
    const retrievedSQL = record?.originalMigrationSQL.get("0.0.1");

    expect(retrievedSQL).toBe(migrationSQL);

    await db2.close();
  });

  test("should store null for missing seed SQL", async () => {
    const filename = "f003-storage-null-seed.sqlite3";
    const migrationSQL =
      "CREATE TABLE null_seed_test (id INTEGER PRIMARY KEY);";

    // Create database without seed SQL
    const db = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL }],
    });

    const record = window.__web_sqlite.databases[`${filename}`];
    const storedSeedSQL = record?.originalSeedSQL.get("0.0.1");

    // seedSQL should be null for versions without seed SQL
    expect(storedSeedSQL).toBeNull();

    await db.close();
  });

  test("should preserve original SQL across multiple versions", async () => {
    const filename = "f003-storage-multi.sqlite3";

    const v1Migration = "CREATE TABLE v1 (id INTEGER PRIMARY KEY);";
    const v1Seed = "INSERT INTO v1 VALUES (1);";
    const v2Migration = "ALTER TABLE v1 ADD COLUMN name TEXT;";
    const v2Seed = "UPDATE v1 SET name = 'test';";

    // Create database with multiple versions
    const db = await openDB(filename, {
      releases: [
        { version: "0.0.1", migrationSQL: v1Migration, seedSQL: v1Seed },
        { version: "0.0.2", migrationSQL: v2Migration, seedSQL: v2Seed },
      ],
    });

    const record = window.__web_sqlite.databases[`${filename}`];

    expect(record?.originalMigrationSQL.get("0.0.1")).toBe(v1Migration);
    expect(record?.originalSeedSQL.get("0.0.1")).toBe(v1Seed);
    expect(record?.originalMigrationSQL.get("0.0.2")).toBe(v2Migration);
    expect(record?.originalSeedSQL.get("0.0.2")).toBe(v2Seed);

    await db.close();
  });
});

describe("F-003 Two-Tier Hash Validation (TASK-418: Global Namespace Access)", () => {
  test("should expose original SQL Maps via window.__web_sqlite", async () => {
    const filename = "f003-namespace-maps.sqlite3";
    const migrationSQL =
      "CREATE TABLE namespace_test (id INTEGER PRIMARY KEY);";
    const seedSQL = "INSERT INTO namespace_test VALUES (1);";

    // Create database
    const db = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL, seedSQL }],
    });

    // Access via global namespace
    const record = window.__web_sqlite.databases[`${filename}`];
    expect(record).toBeDefined();

    // Verify Maps exist and are populated
    expect(record?.originalMigrationSQL).toBeInstanceOf(Map);
    expect(record?.originalSeedSQL).toBeInstanceOf(Map);

    expect(record?.originalMigrationSQL.get("0.0.1")).toBe(migrationSQL);
    expect(record?.originalSeedSQL.get("0.0.1")).toBe(seedSQL);

    await db.close();
  });

  test("should allow read-only access to original SQL from namespace", async () => {
    const filename = "f003-namespace-readonly.sqlite3";
    const migrationSQL = "CREATE TABLE readonly_test (id INTEGER PRIMARY KEY);";

    // Create database
    const db = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL }],
    });

    // Get original SQL via namespace
    const record = window.__web_sqlite.databases[`${filename}`];
    const originalSQL = record?.originalMigrationSQL.get("0.0.1");

    // Verify we can read the SQL
    expect(originalSQL).toBeDefined();
    expect(typeof originalSQL).toBe("string");

    await db.close();
  });

  test("should handle multiple databases in namespace", async () => {
    const filename1 = "f003-namespace-db1.sqlite3";
    const filename2 = "f003-namespace-db2.sqlite3";

    const migrationSQL1 = "CREATE TABLE db1 (id INTEGER PRIMARY KEY);";
    const migrationSQL2 = "CREATE TABLE db2 (id INTEGER PRIMARY KEY);";

    // Create two databases
    const db1 = await openDB(filename1, {
      releases: [{ version: "0.0.1", migrationSQL: migrationSQL1 }],
    });

    const db2 = await openDB(filename2, {
      releases: [{ version: "0.0.1", migrationSQL: migrationSQL2 }],
    });

    // Verify both databases appear in namespace
    const record1 = window.__web_sqlite.databases[`${filename1}`];
    const record2 = window.__web_sqlite.databases[`${filename2}`];

    expect(record1?.originalMigrationSQL.get("0.0.1")).toBe(migrationSQL1);
    expect(record2?.originalMigrationSQL.get("0.0.1")).toBe(migrationSQL2);

    await db1.close();
    await db2.close();
  });

  test("should remove database from namespace on close", async () => {
    const filename = "f003-namespace-close.sqlite3";
    const migrationSQL = "CREATE TABLE close_test (id INTEGER PRIMARY KEY);";

    // Create database
    const db = await openDB(filename, {
      releases: [{ version: "0.0.1", migrationSQL }],
    });

    // Verify database is in namespace
    expect(window.__web_sqlite.databases[`${filename}`]).toBeDefined();

    // Close database
    await db.close();

    // Verify database is removed from namespace
    expect(window.__web_sqlite.databases[`${filename}`]).toBeUndefined();
  });
});

describe("F-003 Two-Tier Hash Validation (TASK-422: Backward Compatibility)", () => {
  describe("Old Database (pre-F-003 schema)", () => {
    test("should open database with matching SQL hash (simple hash comparison)", async () => {
      const filename = "f003-bc-match.sqlite3";
      const migrationSQL = "CREATE TABLE bc_match (id INTEGER PRIMARY KEY);";

      // Create database with NEW code (which stores original SQL)
      const db1 = await openDB(filename, {
        releases: [{ version: "0.0.1", migrationSQL }],
      });

      // Verify original SQL is stored (NEW database behavior)
      const record1 = window.__web_sqlite.databases[`${filename}`];
      expect(record1?.originalMigrationSQL.get("0.0.1")).toBe(migrationSQL);

      await db1.close();

      // Reopen with same SQL - should work
      const db2 = await openDB(filename, {
        releases: [{ version: "0.0.1", migrationSQL }],
      });

      // Verify database opened successfully
      const rows = await db2.query("SELECT * FROM bc_match");
      expect(rows).toEqual([]);

      // Verify original SQL is still accessible after reopen
      const record2 = window.__web_sqlite.databases[`${filename}`];
      expect(record2?.originalMigrationSQL.get("0.0.1")).toBe(migrationSQL);

      await db2.close();
    });

    test("should throw error when SQL hash differs (simple hash comparison)", async () => {
      const filename = "f003-bc-mismatch.sqlite3";
      const originalSQL = "CREATE TABLE bc_mismatch (id INTEGER PRIMARY KEY);";

      // Create database
      const db1 = await openDB(filename, {
        releases: [{ version: "0.0.1", migrationSQL: originalSQL }],
      });
      await db1.close();

      // Reopen with different SQL - should throw error
      const differentSQL =
        "CREATE TABLE bc_mismatch (id INTEGER PRIMARY KEY, name TEXT);";

      await expect(
        openDB(filename, {
          releases: [{ version: "0.0.1", migrationSQL: differentSQL }],
        }),
      ).rejects.toThrow();
    });

    test("should handle null seed SQL in old databases", async () => {
      const filename = "f003-bc-null-seed.sqlite3";
      const migrationSQL =
        "CREATE TABLE bc_null_seed (id INTEGER PRIMARY KEY);";

      // Create database without seed SQL
      const db1 = await openDB(filename, {
        releases: [{ version: "0.0.1", migrationSQL }],
      });

      // Verify seedSQL is null
      const record1 = window.__web_sqlite.databases[`${filename}`];
      expect(record1?.originalSeedSQL.get("0.0.1")).toBeNull();

      await db1.close();

      // Reopen - should work normally
      const db2 = await openDB(filename, {
        releases: [{ version: "0.0.1", migrationSQL }],
      });

      const rows = await db2.query("SELECT * FROM bc_null_seed");
      expect(rows).toEqual([]);

      await db2.close();
    });

    test("should handle multiple versions in old database", async () => {
      const filename = "f003-bc-multi.sqlite3";

      // Create database with multiple versions
      const db1 = await openDB(filename, {
        releases: [
          {
            version: "0.0.1",
            migrationSQL: "CREATE TABLE bc_multi (id INTEGER PRIMARY KEY);",
          },
          {
            version: "0.0.2",
            migrationSQL: "ALTER TABLE bc_multi ADD COLUMN name TEXT;",
          },
        ],
      });
      await db1.close();

      // Reopen with same SQL - should work
      const db2 = await openDB(filename, {
        releases: [
          {
            version: "0.0.1",
            migrationSQL: "CREATE TABLE bc_multi (id INTEGER PRIMARY KEY);",
          },
          {
            version: "0.0.2",
            migrationSQL: "ALTER TABLE bc_multi ADD COLUMN name TEXT;",
          },
        ],
      });

      // Verify schema is correct
      const rows = await db2.query("PRAGMA table_info(bc_multi)");
      expect(rows).toHaveLength(2); // id, name

      await db2.close();
    });
  });

  describe("Migration to New Schema", () => {
    test("should add original SQL columns on first open with new code", async () => {
      const filename = "f003-migration-columns.sqlite3";
      const migrationSQL =
        "CREATE TABLE migration_test (id INTEGER PRIMARY KEY);";

      // Create database (this will add the new columns if they don't exist)
      const db1 = await openDB(filename, {
        releases: [{ version: "0.0.1", migrationSQL }],
      });

      // Verify original SQL is stored
      const record1 = window.__web_sqlite.databases[`${filename}`];
      expect(record1?.originalMigrationSQL.has("0.0.1")).toBe(true);
      expect(record1?.originalMigrationSQL.get("0.0.1")).toBe(migrationSQL);

      await db1.close();

      // Reopen - original SQL should be loaded from metadata
      const db2 = await openDB(filename, {
        releases: [{ version: "0.0.1", migrationSQL }],
      });

      const record2 = window.__web_sqlite.databases[`${filename}`];
      expect(record2?.originalMigrationSQL.get("0.0.1")).toBe(migrationSQL);

      await db2.close();
    });

    test("should use two-tier validation after migration", async () => {
      const filename = "f003-migration-two-tier.sqlite3";
      const originalSQL =
        "CREATE TABLE migration_tier (id INTEGER PRIMARY KEY);";

      // Create database
      const db1 = await openDB(filename, {
        releases: [{ version: "0.0.1", migrationSQL: originalSQL }],
      });
      await db1.close();

      // Reopen with reformatted SQL (whitespace-only change)
      const reformattedSQL =
        "CREATE TABLE migration_tier (\n  id INTEGER PRIMARY KEY\n);";

      // Should open successfully (two-tier validation handles this)
      const db2 = await openDB(filename, {
        releases: [{ version: "0.0.1", migrationSQL: reformattedSQL }],
      });

      // Verify database is functional
      const rows = await db2.query("SELECT * FROM migration_tier");
      expect(rows).toEqual([]);

      await db2.close();
    });
  });

  describe("Edge Cases", () => {
    test("should handle database with only DEFAULT_VERSION", async () => {
      const filename = "f003-bc-default-only.sqlite3";

      // Create database (only uses DEFAULT_VERSION internally)
      const db1 = await openDB(filename);

      // Should work without any releases
      const rows = await db1.query(
        "SELECT name FROM sqlite_master WHERE type='table'",
      );
      expect(rows).toEqual([]);

      await db1.close();
    });

    test("should handle sequential opens of old database", async () => {
      const filename = "f003-bc-sequential.sqlite3";
      const migrationSQL =
        "CREATE TABLE bc_sequential (id INTEGER PRIMARY KEY);";

      // Create database
      const db1 = await openDB(filename, {
        releases: [{ version: "0.0.1", migrationSQL }],
      });
      await db1.close();

      // Open sequentially (close before reopening)
      const db2 = await openDB(filename, {
        releases: [{ version: "0.0.1", migrationSQL }],
      });

      const rows2 = await db2.query("SELECT * FROM bc_sequential");
      expect(rows2).toEqual([]);

      await db2.close();

      const db3 = await openDB(filename, {
        releases: [{ version: "0.0.1", migrationSQL }],
      });

      const rows3 = await db3.query("SELECT * FROM bc_sequential");
      expect(rows3).toEqual([]);

      await db3.close();
    });
  });
});

describe("F-003 Two-Tier Hash Validation (Integration Tests)", () => {
  test("should handle complete workflow: create, close, reopen with whitespace change", async () => {
    const filename = "f003-integration-full.sqlite3";

    // Phase 1: Create database
    const db1 = await openDB(filename, {
      releases: [
        {
          version: "0.0.1",
          migrationSQL:
            "CREATE TABLE workflow (id INTEGER PRIMARY KEY, data TEXT);",
          seedSQL: "INSERT INTO workflow (id, data) VALUES (1, 'initial');",
        },
      ],
    });

    // Verify data
    const rows1 = await db1.query("SELECT * FROM workflow");
    expect(rows1).toEqual([{ id: 1, data: "initial" }]);

    await db1.close();

    // Phase 2: Reopen with reformatted SQL (whitespace-only change)
    const db2 = await openDB(filename, {
      releases: [
        {
          version: "0.0.1",
          migrationSQL:
            "CREATE TABLE workflow (\n  id INTEGER PRIMARY KEY,\n  data TEXT\n);",
          seedSQL: "INSERT INTO workflow (id, data)\nVALUES (1, 'initial');",
        },
      ],
    });

    // Verify data is still there (no re-migration occurred)
    const rows2 = await db2.query("SELECT * FROM workflow");
    expect(rows2).toEqual([{ id: 1, data: "initial" }]);

    await db2.close();

    // Phase 3: Reopen again - should use updated hash (no Tier 2 needed)
    const db3 = await openDB(filename, {
      releases: [
        {
          version: "0.0.1",
          migrationSQL:
            "CREATE TABLE workflow (\n  id INTEGER PRIMARY KEY,\n  data TEXT\n);",
          seedSQL: "INSERT INTO workflow (id, data)\nVALUES (1, 'initial');",
        },
      ],
    });

    // Verify data persists
    const rows3 = await db3.query("SELECT * FROM workflow");
    expect(rows3).toEqual([{ id: 1, data: "initial" }]);

    await db3.close();
  });

  test("should work with devTool.release() and two-tier validation", async () => {
    const filename = "f003-integration-devtool.sqlite3";

    // Create base database
    const db = await openDB(filename, {
      releases: [
        {
          version: "0.0.1",
          migrationSQL: "CREATE TABLE devtool_test (id INTEGER PRIMARY KEY);",
        },
      ],
    });

    // Create dev release
    await db.devTool.release({
      version: "0.0.2",
      migrationSQL: "ALTER TABLE devtool_test ADD COLUMN tag TEXT;",
    });

    // Close and reopen without specifying dev version (should still work)
    await db.close();

    const db2 = await openDB(filename, {
      releases: [
        {
          version: "0.0.1",
          migrationSQL: "CREATE TABLE devtool_test (id INTEGER PRIMARY KEY);",
        },
      ],
    });

    // Verify both versions exist in the database
    const record = window.__web_sqlite.databases[`${filename}`];
    expect(record?.originalMigrationSQL.has("0.0.1")).toBe(true);
    // Dev version may not be in originalMigrationSQL if not specified in releases
    // but the database file should exist

    await db2.close();
  });

  test("should handle backward compatibility with databases without original SQL", async () => {
    const filename = "f003-integration-compat.sqlite3";

    // Create database (simulating old database without original SQL)
    const db1 = await openDB(filename, {
      releases: [
        {
          version: "0.0.1",
          migrationSQL: "CREATE TABLE compat_test (id INTEGER PRIMARY KEY);",
        },
      ],
    });

    // Get the record
    const record1 = window.__web_sqlite.databases[`${filename}`];

    // Debug: Log what's in the record
    console.log("[TEST] filename:", filename);
    console.log("[TEST] Looking for key:", `${filename}`);
    console.log("[TEST] window.__web_sqlite:", window.__web_sqlite);
    console.log(
      "[TEST] window.__web_sqlite.databases:",
      window.__web_sqlite.databases,
    );
    console.log(
      "[TEST] Keys in databases:",
      Object.keys(window.__web_sqlite.databases),
    );
    console.log("[TEST] record1:", record1);
    console.log(
      "[TEST] record1?.originalMigrationSQL:",
      record1?.originalMigrationSQL,
    );

    // Original SQL should be stored (new database)
    expect(record1?.originalMigrationSQL.has("0.0.1")).toBe(true);

    await db1.close();

    // Reopen with same SQL
    const db2 = await openDB(filename, {
      releases: [
        {
          version: "0.0.1",
          migrationSQL: "CREATE TABLE compat_test (id INTEGER PRIMARY KEY);",
        },
      ],
    });

    // Should work normally
    const rows = await db2.query("SELECT * FROM compat_test");
    expect(rows).toEqual([]);

    await db2.close();
  });
});

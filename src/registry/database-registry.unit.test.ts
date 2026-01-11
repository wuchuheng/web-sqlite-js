import { describe, it, expect, beforeEach } from "vitest";
import {
  DatabaseRegistry,
  normalizeDatabaseName,
  DatabaseAlreadyOpenError,
} from "./database-registry";
import type { DBInterface, DatabaseRecord } from "../types/DB";

/**
 * Mock database record for testing (v2.1.0).
 * Creates a DatabaseRecord with SQL Maps and a mock DBInterface.
 */
const createMockDB = (_name: string): DatabaseRecord => {
  const db: DBInterface = {
    exec: async () => ({ changes: 0, lastInsertRowid: 0 }),
    query: async () => [],
    transaction: async <T>() => undefined as T,
    close: async () => undefined,
    onLog: () => () => {
      // Placeholder cancel function
    },
    devTool: {
      release: async () => undefined,
      rollback: async () => undefined,
    },
  };
  return {
    migrationSQL: new Map(),
    seedSQL: new Map(),
    db,
  };
};

describe("DatabaseRegistry", () => {
  beforeEach(() => {
    // Clear registry before each test
    DatabaseRegistry._clear();
  });

  describe("normalizeDatabaseName", () => {
    it("should append .sqlite3 suffix if not present", () => {
      expect(normalizeDatabaseName("myapp")).toBe("myapp.sqlite3");
      expect(normalizeDatabaseName("demo")).toBe("demo.sqlite3");
    });

    it("should not append .sqlite3 if already present", () => {
      expect(normalizeDatabaseName("myapp.sqlite3")).toBe("myapp.sqlite3");
      expect(normalizeDatabaseName("demo.sqlite3")).toBe("demo.sqlite3");
    });

    it("should trim whitespace", () => {
      expect(normalizeDatabaseName("  myapp  ")).toBe("myapp.sqlite3");
      expect(normalizeDatabaseName("\tmyapp\n")).toBe("myapp.sqlite3");
    });

    it("should handle both suffix and whitespace", () => {
      expect(normalizeDatabaseName("  myapp.sqlite3  ")).toBe("myapp.sqlite3");
    });
  });

  describe("register", () => {
    it("should register a database instance", () => {
      const db = createMockDB("test");
      DatabaseRegistry.register("test", db);

      expect(DatabaseRegistry.has("test")).toBe(true);
      expect(DatabaseRegistry.get("test")).toBe(db);
    });

    it("should normalize database names", () => {
      const db = createMockDB("test");
      DatabaseRegistry.register("test", db);

      expect(DatabaseRegistry.has("test.sqlite3")).toBe(true);
    });

    it("should throw if database already registered", () => {
      const db1 = createMockDB("test1");
      const db2 = createMockDB("test2");

      DatabaseRegistry.register("test", db1);

      expect(() => DatabaseRegistry.register("test", db2)).toThrow(
        DatabaseAlreadyOpenError,
      );
      expect(() => DatabaseRegistry.register("test", db2)).toThrow(
        "Database 'test.sqlite3' is already open",
      );
    });

    it("should allow registering different database names", () => {
      const db1 = createMockDB("db1");
      const db2 = createMockDB("db2");

      DatabaseRegistry.register("db1", db1);
      DatabaseRegistry.register("db2", db2);

      expect(DatabaseRegistry.has("db1")).toBe(true);
      expect(DatabaseRegistry.has("db2")).toBe(true);
      expect(DatabaseRegistry.list()).toHaveLength(2);
    });
  });

  describe("unregister", () => {
    it("should unregister a database instance", () => {
      const db = createMockDB("test");
      DatabaseRegistry.register("test", db);

      DatabaseRegistry.unregister("test");

      expect(DatabaseRegistry.has("test")).toBe(false);
      expect(DatabaseRegistry.get("test")).toBeUndefined();
    });

    it("should normalize database names", () => {
      const db = createMockDB("test");
      DatabaseRegistry.register("test.sqlite3", db);

      DatabaseRegistry.unregister("test");

      expect(DatabaseRegistry.has("test.sqlite3")).toBe(false);
    });

    it("should not throw when unregistering non-existent database", () => {
      expect(() => DatabaseRegistry.unregister("nonexistent")).not.toThrow();
    });
  });

  describe("get", () => {
    it("should return registered database instance", () => {
      const db = createMockDB("test");
      DatabaseRegistry.register("test", db);

      const result = DatabaseRegistry.get("test");

      expect(result).toBe(db);
    });

    it("should return undefined for non-existent database", () => {
      const result = DatabaseRegistry.get("nonexistent");

      expect(result).toBeUndefined();
    });

    it("should normalize database names", () => {
      const db = createMockDB("test");
      DatabaseRegistry.register("test", db);

      expect(DatabaseRegistry.get("test.sqlite3")).toBe(db);
    });
  });

  describe("has", () => {
    it("should return true for registered database", () => {
      const db = createMockDB("test");
      DatabaseRegistry.register("test", db);

      expect(DatabaseRegistry.has("test")).toBe(true);
    });

    it("should return false for non-existent database", () => {
      expect(DatabaseRegistry.has("nonexistent")).toBe(false);
    });

    it("should normalize database names", () => {
      const db = createMockDB("test");
      DatabaseRegistry.register("test.sqlite3", db);

      expect(DatabaseRegistry.has("test")).toBe(true);
    });
  });

  describe("list", () => {
    it("should return empty array when no databases registered", () => {
      const result = DatabaseRegistry.list();

      expect(result).toEqual([]);
    });

    it("should return all registered database names", () => {
      const db1 = createMockDB("db1");
      const db2 = createMockDB("db2");
      const db3 = createMockDB("db3");

      DatabaseRegistry.register("db1", db1);
      DatabaseRegistry.register("db2", db2);
      DatabaseRegistry.register("db3", db3);

      const result = DatabaseRegistry.list();

      expect(result).toHaveLength(3);
      expect(result).toContain("db1.sqlite3");
      expect(result).toContain("db2.sqlite3");
      expect(result).toContain("db3.sqlite3");
    });

    it("should return normalized names", () => {
      const db = createMockDB("test");
      DatabaseRegistry.register("test", db);

      const result = DatabaseRegistry.list();

      expect(result).toContain("test.sqlite3");
    });
  });

  describe("checkLock", () => {
    it("should not throw when database is not locked", () => {
      expect(() => DatabaseRegistry.checkLock("test")).not.toThrow();
    });

    it("should throw when database is already registered", () => {
      const db = createMockDB("test");
      DatabaseRegistry.register("test", db);

      expect(() => DatabaseRegistry.checkLock("test")).toThrow(
        DatabaseAlreadyOpenError,
      );
      expect(() => DatabaseRegistry.checkLock("test")).toThrow(
        "Database 'test.sqlite3' is already open",
      );
    });

    it("should normalize database names", () => {
      const db = createMockDB("test");
      DatabaseRegistry.register("test.sqlite3", db);

      expect(() => DatabaseRegistry.checkLock("test")).toThrow(
        DatabaseAlreadyOpenError,
      );
    });

    it("should allow same database name after unregister", () => {
      const db1 = createMockDB("test");
      DatabaseRegistry.register("test", db1);

      DatabaseRegistry.unregister("test");

      expect(() => DatabaseRegistry.checkLock("test")).not.toThrow();
    });
  });

  describe("acquireLock", () => {
    it("should acquire lock for available database", () => {
      expect(() => DatabaseRegistry.acquireLock("test")).not.toThrow();
    });

    it("should throw when lock is already held", () => {
      DatabaseRegistry.acquireLock("test");

      expect(() => DatabaseRegistry.acquireLock("test")).toThrow(
        DatabaseAlreadyOpenError,
      );
    });

    it("should normalize database names", () => {
      DatabaseRegistry.acquireLock("test");

      expect(() => DatabaseRegistry.acquireLock("test.sqlite3")).toThrow(
        DatabaseAlreadyOpenError,
      );
    });
  });

  describe("releaseLock", () => {
    it("should release acquired lock", () => {
      DatabaseRegistry.acquireLock("test");
      DatabaseRegistry.releaseLock("test");

      expect(() => DatabaseRegistry.checkLock("test")).not.toThrow();
    });

    it("should normalize database names", () => {
      DatabaseRegistry.acquireLock("test.sqlite3");
      DatabaseRegistry.releaseLock("test");

      expect(() => DatabaseRegistry.checkLock("test.sqlite3")).not.toThrow();
    });

    it("should not throw when releasing non-existent lock", () => {
      expect(() => DatabaseRegistry.releaseLock("nonexistent")).not.toThrow();
    });
  });

  describe("_clear", () => {
    it("should clear all databases and locks", () => {
      const db1 = createMockDB("db1");
      const db2 = createMockDB("db2");

      DatabaseRegistry.register("db1", db1);
      DatabaseRegistry.register("db2", db2);

      DatabaseRegistry._clear();

      expect(DatabaseRegistry.list()).toEqual([]);
      expect(DatabaseRegistry.has("db1")).toBe(false);
      expect(DatabaseRegistry.has("db2")).toBe(false);
    });
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { globalNamespace } from "../global/namespace";
import type { DatabaseChangeEvent } from "../types/global";

describe("DatabaseEventEmitter (via namespace)", () => {
  beforeEach(() => {
    // Clear subscribers by calling cancel on any previous registrations
    // Note: Since globalNamespace is a singleton, we need to be careful
    // We'll use a fresh callback for each test
  });

  it("should subscribe to events and receive cancel function", () => {
    const callback = vi.fn();
    const cancel = globalNamespace.onDatabaseChange(callback);

    expect(typeof cancel).toBe("function");

    // Cleanup
    cancel();
  });

  it("should emit event when database opened", () => {
    const callback = vi.fn();
    globalNamespace.onDatabaseChange(callback);

    const event: DatabaseChangeEvent = {
      action: "opened",
      dbName: "test.sqlite3",
      databases: ["test.sqlite3"],
    };

    globalNamespace._emitEvent(event);

    expect(callback).toHaveBeenCalledWith(event);
  });

  it("should emit event when database closed", () => {
    const callback = vi.fn();
    globalNamespace.onDatabaseChange(callback);

    const event: DatabaseChangeEvent = {
      action: "closed",
      dbName: "test.sqlite3",
      databases: ["test.sqlite3"],
    };

    globalNamespace._emitEvent(event);

    expect(callback).toHaveBeenCalledWith(event);
  });

  it("should support multiple subscribers", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const cancel1 = globalNamespace.onDatabaseChange(callback1);
    const cancel2 = globalNamespace.onDatabaseChange(callback2);

    const event: DatabaseChangeEvent = {
      action: "opened",
      dbName: "test.sqlite3",
      databases: ["test.sqlite3"],
    };

    globalNamespace._emitEvent(event);

    expect(callback1).toHaveBeenCalledWith(event);
    expect(callback2).toHaveBeenCalledWith(event);

    // Cleanup
    cancel1();
    cancel2();
  });

  it("should isolate subscriber errors", () => {
    const errorCallback = vi.fn(() => {
      throw new Error("Subscriber error");
    });
    const goodCallback = vi.fn();
    const cancel1 = globalNamespace.onDatabaseChange(errorCallback);
    const cancel2 = globalNamespace.onDatabaseChange(goodCallback);

    const event: DatabaseChangeEvent = {
      action: "opened",
      dbName: "test.sqlite3",
      databases: ["test.sqlite3"],
    };

    // Should not throw, good callback should still be called
    expect(() => globalNamespace._emitEvent(event)).not.toThrow();
    expect(errorCallback).toHaveBeenCalled();
    expect(goodCallback).toHaveBeenCalledWith(event);

    // Cleanup
    cancel1();
    cancel2();
  });

  it("should cancel subscription", () => {
    const callback = vi.fn();
    const cancel = globalNamespace.onDatabaseChange(callback);

    cancel();

    const event: DatabaseChangeEvent = {
      action: "opened",
      dbName: "test.sqlite3",
      databases: ["test.sqlite3"],
    };

    globalNamespace._emitEvent(event);

    expect(callback).not.toHaveBeenCalled();
  });

  it("should handle idempotent cancel", () => {
    const callback = vi.fn();
    const cancel = globalNamespace.onDatabaseChange(callback);

    // First cancel
    cancel();

    // Second cancel should not throw
    expect(() => cancel()).not.toThrow();
  });

  it("should update databases record", () => {
    const testDB: { close: () => Promise<void> } = {
      close: async () => {},
    };

    /* eslint-disable @typescript-eslint/no-explicit-any */
    globalNamespace._updateDatabases({
      "test.sqlite3": testDB as any,
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */

    expect(globalNamespace.databases["test.sqlite3"]).toBe(testDB);
  });

  it("should clear old databases when updating", () => {
    const db1: { close: () => Promise<void> } = { close: async () => {} };
    const db2: { close: () => Promise<void> } = { close: async () => {} };

    /* eslint-disable @typescript-eslint/no-explicit-any */
    globalNamespace._updateDatabases({
      "db1.sqlite3": db1 as any,
    });

    globalNamespace._updateDatabases({
      "db2.sqlite3": db2 as any,
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // Old database should be removed
    expect(globalNamespace.databases["db1.sqlite3"]).toBeUndefined();
    expect(globalNamespace.databases["db2.sqlite3"]).toBe(db2);
  });
});

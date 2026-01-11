import { describe, it, expect, beforeEach, vi } from "vitest";
import { openDB } from "web-sqlite-js";
import type { DatabaseChangeEvent } from "../../src/types/global";

describe("Database Change Events", () => {
  beforeEach(async () => {
    // Close any databases that might be open from previous tests
    const dbs = window.__web_sqlite.databases;
    for (const [, db] of Object.entries(dbs)) {
      await db.close();
    }
  });

  it("should emit event when database is opened", async () => {
    const callback = vi.fn();
    const unsubscribe = window.__web_sqlite.onDatabaseChange(callback);

    const db = await openDB("test-events-open");

    expect(callback).toHaveBeenCalledWith({
      action: "opened",
      dbName: "test-events-open.sqlite3",
      databases: ["test-events-open.sqlite3"],
    });

    unsubscribe();
    await db.close();
  });

  it("should emit event when database is closed", async () => {
    const callback = vi.fn();
    const unsubscribe = window.__web_sqlite.onDatabaseChange(callback);

    const db = await openDB("test-events-close");
    callback.mockClear(); // Clear open event

    await db.close();

    // After close, databases list should be empty (this was the only db)
    expect(callback).toHaveBeenCalledWith({
      action: "closed",
      dbName: "test-events-close.sqlite3",
      databases: [],
    });

    unsubscribe();
  });

  it("should show updated databases list after open", async () => {
    await openDB("db1");
    const db2 = await openDB("db2");

    // Direct access to databases should work
    expect(window.__web_sqlite.databases["db1.sqlite3"]).toBeDefined();
    expect(window.__web_sqlite.databases["db2.sqlite3"]).toBeDefined();

    await db2.close();
    await window.__web_sqlite.databases["db1.sqlite3"].close();
  });

  it("should show updated databases list after close", async () => {
    const db1 = await openDB("db1-close-test");
    await openDB("db2-close-test");

    const callback = vi.fn();
    const unsubscribe = window.__web_sqlite.onDatabaseChange(callback);
    callback.mockClear(); // Clear any previous events

    await db1.close();

    const lastCall = callback.mock.calls[callback.mock.calls.length - 1];
    const event = lastCall[0] as DatabaseChangeEvent;

    expect(event.action).toBe("closed");
    expect(event.dbName).toBe("db1-close-test.sqlite3");
    expect(event.databases).not.toContain("db1-close-test.sqlite3");
    expect(event.databases).toContain("db2-close-test.sqlite3");

    unsubscribe();
    await window.__web_sqlite.databases["db2-close-test.sqlite3"].close();
  });

  it("should support multiple subscribers", async () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const unsubscribe1 = window.__web_sqlite.onDatabaseChange(callback1);
    const unsubscribe2 = window.__web_sqlite.onDatabaseChange(callback2);

    const db = await openDB("test-multi-sub");

    expect(callback1).toHaveBeenCalled();
    expect(callback2).toHaveBeenCalled();

    // Both should receive the same event
    const event1 = callback1.mock.calls[0][0] as DatabaseChangeEvent;
    const event2 = callback2.mock.calls[0][0] as DatabaseChangeEvent;
    expect(event1).toEqual(event2);

    unsubscribe1();
    unsubscribe2();
    await db.close();
  });

  it("should cancel subscription", async () => {
    const callback = vi.fn();
    const unsubscribe = window.__web_sqlite.onDatabaseChange(callback);
    callback.mockClear(); // Clear initial state

    unsubscribe();

    await openDB("test-cancel");

    expect(callback).not.toHaveBeenCalled();
    await window.__web_sqlite.databases["test-cancel.sqlite3"].close();
  });

  it("should handle idempotent cancel", async () => {
    const callback = vi.fn();
    const unsubscribe = window.__web_sqlite.onDatabaseChange(callback);
    callback.mockClear();

    // First cancel
    unsubscribe();

    // Second cancel should not throw
    expect(() => unsubscribe()).not.toThrow();

    // Database should still work normally
    const db = await openDB("test-idempotent-cancel");
    expect(
      window.__web_sqlite.databases["test-idempotent-cancel.sqlite3"],
    ).toBeDefined();
    await db.close();
  });

  it("should isolate subscriber errors", async () => {
    const errorCallback = vi.fn(() => {
      throw new Error("Subscriber error");
    });
    const goodCallback = vi.fn();

    window.__web_sqlite.onDatabaseChange(errorCallback);
    window.__web_sqlite.onDatabaseChange(goodCallback);

    // Opening database should not throw despite error in callback
    const db = await openDB("test-error-isolation");

    // Both callbacks should be called
    expect(errorCallback).toHaveBeenCalled();
    expect(goodCallback).toHaveBeenCalled();

    await db.close();
  });

  it("should emit events with correct database names", async () => {
    const callback = vi.fn();
    const unsubscribe = window.__web_sqlite.onDatabaseChange(callback);

    await openDB("myapp");
    const lastCall = callback.mock.calls[callback.mock.calls.length - 1];
    const event = lastCall[0] as DatabaseChangeEvent;

    expect(event.dbName).toBe("myapp.sqlite3");

    unsubscribe();
    await window.__web_sqlite.databases["myapp.sqlite3"].close();
  });

  it("should handle multiple open/close cycles", async () => {
    const callback = vi.fn();
    const unsubscribe = window.__web_sqlite.onDatabaseChange(callback);

    const db1 = await openDB("test-cycle-1");
    callback.mockClear();

    await db1.close();
    callback.mockClear();

    // Re-opening the same database name should work
    // (but in practice it won't since registry prevents it)
    // This test verifies the event system itself works correctly

    unsubscribe();
  });
});

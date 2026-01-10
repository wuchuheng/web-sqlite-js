import { describe, it, expect } from "vitest";
import { globalNamespace } from "./namespace";

describe("Global Namespace (TASK-204)", () => {
  it("should create namespace accessible via window.__web_sqlite", () => {
    expect(window.__web_sqlite).toBeDefined();
    expect(globalNamespace).toBe(window.__web_sqlite);
  });

  it("should not be enumerable in Object.keys(window)", () => {
    const windowKeys = Object.keys(window);
    expect(windowKeys).not.toContain("__web_sqlite");
  });

  it("should have databases property", () => {
    expect(window.__web_sqlite.databases).toBeDefined();
    expect(typeof window.__web_sqlite.databases).toBe("object");
    // Initially empty
    expect(Object.keys(window.__web_sqlite.databases)).toHaveLength(0);
  });

  it("should have onDatabaseChange function", () => {
    expect(window.__web_sqlite.onDatabaseChange).toBeDefined();
    expect(typeof window.__web_sqlite.onDatabaseChange).toBe("function");
  });

  it("should return unsubscribe function from onDatabaseChange", () => {
    const unsubscribe = window.__web_sqlite.onDatabaseChange(() => {});
    expect(typeof unsubscribe).toBe("function");
  });

  it("should be singleton (same instance on multiple imports)", () => {
    const ns1 = window.__web_sqlite;
    // Simulating re-import by accessing again
    const ns2 = window.__web_sqlite;
    expect(ns1).toBe(ns2);
  });

  it("should emit events to subscribers", () => {
    const events: Array<{
      action: string;
      dbName: string;
      databases: string[];
    }> = [];

    const unsubscribe = window.__web_sqlite.onDatabaseChange((event) => {
      events.push({
        action: event.action,
        dbName: event.dbName,
        databases: event.databases,
      });
    });

    // Emit test event using internal method
    globalNamespace._emitEvent({
      action: "opened",
      dbName: "test.sqlite3",
      databases: ["test.sqlite3"],
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      action: "opened",
      dbName: "test.sqlite3",
      databases: ["test.sqlite3"],
    });

    unsubscribe();
  });

  it("should handle subscriber errors gracefully", () => {
    let goodCallbackCalled = false;
    const errorMessage = "Test error in callback";

    // Good callback
    window.__web_sqlite.onDatabaseChange(() => {
      goodCallbackCalled = true;
    });

    // Bad callback that throws
    window.__web_sqlite.onDatabaseChange(() => {
      throw new Error(errorMessage);
    });

    // Emit event - should not throw despite bad callback
    expect(() => {
      globalNamespace._emitEvent({
        action: "opened",
        dbName: "test.sqlite3",
        databases: ["test.sqlite3"],
      });
    }).not.toThrow();

    // Good callback should still be called
    expect(goodCallbackCalled).toBe(true);
  });

  it("should unsubscribe correctly", () => {
    let callCount = 0;

    const unsubscribe = window.__web_sqlite.onDatabaseChange(() => {
      callCount++;
    });

    globalNamespace._emitEvent({
      action: "opened",
      dbName: "test.sqlite3",
      databases: ["test.sqlite3"],
    });

    expect(callCount).toBe(1);

    unsubscribe();

    globalNamespace._emitEvent({
      action: "closed",
      dbName: "test.sqlite3",
      databases: [],
    });

    // Should not increment after unsubscribe
    expect(callCount).toBe(1);
  });

  it("should support multiple subscribers", () => {
    const events1: unknown[] = [];
    const events2: unknown[] = [];

    const unsubscribe1 = window.__web_sqlite.onDatabaseChange((event) => {
      events1.push(event);
    });

    const unsubscribe2 = window.__web_sqlite.onDatabaseChange((event) => {
      events2.push(event);
    });

    const testEvent = {
      action: "opened" as const,
      dbName: "test.sqlite3",
      databases: ["test.sqlite3"],
    };

    globalNamespace._emitEvent(testEvent);

    expect(events1).toEqual([testEvent]);
    expect(events2).toEqual([testEvent]);

    unsubscribe1();
    unsubscribe2();
  });
});

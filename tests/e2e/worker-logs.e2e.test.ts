import { describe, it, expect } from "vitest";
import { openDB } from "web-sqlite-js";

describe("Worker Log Forwarding (TASK-209)", () => {
  it("should dispatch debug logs for SQL execution", async () => {
    const logs: unknown[] = [];
    const db = await openDB("test-logs");

    const cancel = db.onLog((log) => {
      logs.push(log);
    });

    await db.exec("CREATE TABLE test (id INTEGER)");
    await db.exec("INSERT INTO test VALUES (1)");

    // Verify logs were dispatched
    const debugLogs = logs.filter(
      (log) => (log as { level: string }).level === "debug",
    );
    expect(debugLogs.length).toBeGreaterThan(0);

    // Verify log data structure
    const firstLog = debugLogs[0] as { level: string; data: unknown };
    expect(firstLog.level).toBe("debug");
    expect(typeof firstLog.data).toBe("object");

    cancel();
    await db.close();
  });

  it("should include SQL and timing in log data", async () => {
    const logs: unknown[] = [];
    const db = await openDB("test-logs-timing");

    const cancel = db.onLog((log) => {
      logs.push(log);
    });

    await db.exec("SELECT 1");

    const execLogs = logs.filter(
      (log: unknown) =>
        (log as { level: string }).level === "debug" &&
        typeof (log as { data: unknown }).data === "object" &&
        (log as { data: { sql?: string } }).data?.sql,
    );

    expect(execLogs.length).toBeGreaterThan(0);

    // Verify SQL is in the log data
    const firstExecLog = execLogs[0] as {
      level: string;
      data: { sql: string; duration: number; bind: unknown[] };
    };
    expect(firstExecLog.data.sql).toBe("SELECT 1");
    expect(typeof firstExecLog.data.duration).toBe("number");

    cancel();
    await db.close();
  });

  it("should dispatch logs for query operations", async () => {
    const logs: unknown[] = [];
    const db = await openDB("test-logs-query");

    const cancel = db.onLog((log) => {
      logs.push(log);
    });

    await db.exec("CREATE TABLE users (id INTEGER, name TEXT)");
    await db.exec("INSERT INTO users VALUES (1, 'Alice')");
    const rows = await db.query<{ id: number; name: string }>(
      "SELECT * FROM users",
    );

    // Verify query generated logs
    const debugLogs = logs.filter(
      (log) => (log as { level: string }).level === "debug",
    );
    expect(debugLogs.length).toBeGreaterThan(0);

    // Find query logs
    const queryLogs = debugLogs.filter((log) => {
      const data = (log as { data: { sql?: string } }).data;
      return data?.sql?.includes("SELECT");
    });
    expect(queryLogs.length).toBeGreaterThan(0);

    cancel();
    await db.close();
  });

  it("should support multiple log callbacks", async () => {
    const logs1: unknown[] = [];
    const logs2: unknown[] = [];
    const db = await openDB("test-logs-multiple");

    const cancel1 = db.onLog((log) => {
      logs1.push(log);
    });
    const cancel2 = db.onLog((log) => {
      logs2.push(log);
    });

    await db.exec("SELECT 1");

    // Both callbacks should receive logs
    expect(logs1.length).toBeGreaterThan(0);
    expect(logs2.length).toBeGreaterThan(0);
    expect(logs1.length).toBe(logs2.length);

    cancel1();
    cancel2();
    await db.close();
  });

  it("should stop dispatching after cancel", async () => {
    const logs: unknown[] = [];
    const db = await openDB("test-logs-cancel");

    const cancel = db.onLog((log) => {
      logs.push(log);
    });

    await db.exec("SELECT 1");
    const logsBeforeCancel = logs.length;

    cancel();

    await db.exec("SELECT 2");
    const logsAfterCancel = logs.length;

    // No new logs should be added after cancel
    expect(logsAfterCancel).toBe(logsBeforeCancel);

    await db.close();
  });
});

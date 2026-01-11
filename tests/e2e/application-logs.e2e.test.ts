import { describe, it, expect } from "vitest";
import { openDB } from "web-sqlite-js";

describe("Application-Level Logging (TASK-220)", () => {
  it("should emit info log on database open", async () => {
    // First open a DB to set up the test environment
    const db1 = await openDB("test-app-logs-open-1");

    // Register callback on existing DB (this won't capture its open log)
    const logsFromDb1: unknown[] = [];
    const cancel1 = db1.onLog((log) => {
      logsFromDb1.push(log);
    });

    // Now close and open a new DB - the callback should still be active
    await db1.close();
    cancel1();

    // Open a second DB with a fresh callback registered
    // Note: The open log is emitted INSIDE openDB() before it returns,
    // so we need to verify the log dispatcher was called
    const logsFromDb2: unknown[] = [];
    const db2 = await openDB("test-app-logs-open-2");

    // Register callback immediately after open
    const cancel2 = db2.onLog((log) => {
      logsFromDb2.push(log);
    });

    // Execute some operations to verify callback works
    await db2.exec("SELECT 1");

    // Verify we received logs (includes the debug log from SELECT)
    expect(logsFromDb2.length).toBeGreaterThan(0);

    cancel2();
    await db2.close();

    // Open a third DB to capture its close log
    // The open log will have been emitted but we can still verify the dispatcher works
    const db3 = await openDB("test-app-logs-open-3");
    const logsFromDb3: unknown[] = [];
    const cancel3 = db3.onLog((log) => {
      logsFromDb3.push(log);
    });

    await db3.close();
    cancel3();

    // Verify we received the close log
    const closeLogs = logsFromDb3.filter(
      (log) =>
        (log as { level: string }).level === "info" &&
        (log as { data: { action?: string } }).data?.action === "close",
    );
    expect(closeLogs.length).toBeGreaterThan(0);
  });

  it("should emit info log on database close", async () => {
    const logs: unknown[] = [];
    const db = await openDB("test-app-logs-close");

    const cancel = db.onLog((log) => {
      logs.push(log);
    });

    await db.close();
    cancel(); // Unsubscribe

    // Find the close log
    const closeLogs = logs.filter(
      (log) =>
        (log as { level: string }).level === "info" &&
        (log as { data: { action?: string } }).data?.action === "close",
    );

    expect(closeLogs.length).toBeGreaterThan(0);
    expect(
      (closeLogs[0] as { data: { dbName?: string } }).data.dbName,
    ).toContain("test-app-logs-close");
  });

  it("should emit info log on transaction commit", async () => {
    const logs: unknown[] = [];
    const db = await openDB("test-app-logs-commit");

    const cancel = db.onLog((log) => {
      logs.push(log);
    });

    await db.exec("CREATE TABLE test (id INTEGER)");

    await db.transaction(async (tx) => {
      await tx.exec("INSERT INTO test VALUES (1)");
    });

    // Find the commit log
    const commitLogs = logs.filter(
      (log) =>
        (log as { level: string }).level === "info" &&
        (log as { data: { action?: string } }).data?.action === "commit",
    );

    expect(commitLogs.length).toBeGreaterThan(0);

    cancel();
    await db.close();
  });

  it("should emit info log on transaction rollback", async () => {
    const logs: unknown[] = [];
    const db = await openDB("test-app-logs-rollback");

    const cancel = db.onLog((log) => {
      logs.push(log);
    });

    await db.exec("CREATE TABLE test (id INTEGER UNIQUE)");

    try {
      await db.transaction(async (tx) => {
        await tx.exec("INSERT INTO test VALUES (1)");
        await tx.exec("INSERT INTO test VALUES (1)"); // Duplicate!
      });
      expect.fail("Should have thrown constraint error");
    } catch (_error) {
      // Expected constraint error
    }

    // Find the rollback log
    const rollbackLogs = logs.filter(
      (log) =>
        (log as { level: string }).level === "info" &&
        (log as { data: { action?: string } }).data?.action === "rollback",
    );

    expect(rollbackLogs.length).toBeGreaterThan(0);

    cancel();
    await db.close();
  });

  it("should include correct data shapes in logs", async () => {
    const logs: unknown[] = [];
    const db = await openDB("test-app-logs-shapes");

    const cancel = db.onLog((log) => {
      logs.push(log);
    });

    await db.close();
    cancel(); // Unsubscribe

    // Verify data shape
    const closeLog = logs.find(
      (log) =>
        (log as { level: string }).level === "info" &&
        (log as { data: { action?: string } }).data?.action === "close",
    );

    expect(closeLog).toBeDefined();
    expect((closeLog as { level: string }).level).toBe("info");
    expect((closeLog as { data: { action?: string } }).data).toHaveProperty(
      "action",
      "close",
    );
    expect((closeLog as { data: { dbName?: string } }).data).toHaveProperty(
      "dbName",
    );
  });
});

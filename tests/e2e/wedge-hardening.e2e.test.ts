import { describe, it, expect } from 'vitest'
import { openDB } from 'web-sqlite-js'

/**
 * Regression coverage for the OPFS wedge hardening:
 *
 * 1. `xClose` in the async proxy now guards `closeSyncHandle` and always
 *    acknowledges the main thread (SQLITE_IOERR_CLOSE), so a handling
 *    exception can no longer leave `opRun` blocked on rc === -1 forever.
 * 2. `opRun` in sqlite3.mjs has a bounded wait (watchdog) that fails loudly
 *    instead of wedging the whole worker chain.
 * 3. The worker serializes messages (single-flight SAB protocol) and error
 *    logs are visible even when debug logging is disabled.
 * 4. The worker bridge rejects on worker silence instead of hanging forever.
 *
 * The exact synthetic trigger (a browser-invalidated FileSystemSyncAccessHandle
 * making close() throw) cannot be produced deterministically from a page; these
 * tests pin the observable guarantees around it: error log plumbing, loud
 * failures, and no deadlock under sustained idle-churn/concurrent use.
 */
describe('OPFS wedge hardening', () => {
  it('surfaces error-level logs through db.onLog when an operation fails, even with debug disabled', async () => {
    const logs: unknown[] = []
    const db = await openDB('wedge-error-logs.sqlite3', { debug: false })
    const cancel = db.onLog((log) => logs.push(log))

    await expect(db.exec('SELECT * FROM missing_table_xyz;')).rejects.toThrow()

    // The error log rides in the worker's error response; give it a tick.
    await new Promise((resolve) => setTimeout(resolve, 50))

    const errorLogs = logs.filter((log) => (log as { level: string }).level === 'error')
    expect(errorLogs.length).toBeGreaterThan(0)

    cancel()
    await db.close()
  })

  it('survives sustained transaction/query churn with idle gaps longer than the proxy idle timeout', async () => {
    const db = await openDB('wedge-stress.sqlite3', { debug: false })
    await db.exec('CREATE TABLE IF NOT EXISTS s (id INTEGER PRIMARY KEY, v TEXT)')

    for (let i = 0; i < 40; i += 1) {
      await db.transaction(async (tx) => {
        await tx.exec('INSERT INTO s (v) VALUES (?)', [`v${i}`])
      })
      const rows = await db.query<{ id: number }>('SELECT id FROM s')
      expect(rows.length).toBe(i + 1)
      // Idle gap: exceeds the proxy's asyncIdleWaitTime (150ms), forcing the
      // sync-handle close/reopen churn between operations.
      await new Promise((resolve) => setTimeout(resolve, 160))
    }

    await db.close()
  })

  it('keeps both databases healthy when two instances operate concurrently in one page', async () => {
    const a = await openDB('wedge-concurrent-a.sqlite3')
    const b = await openDB('wedge-concurrent-b.sqlite3')

    await a.exec('CREATE TABLE IF NOT EXISTS t (x INTEGER)')
    await b.exec('CREATE TABLE IF NOT EXISTS t (x INTEGER)')
    await a.exec('INSERT INTO t VALUES (1)')

    const rows = await b.query<{ x: number }>('SELECT * FROM t')
    expect(rows.length).toBe(0)

    await a.close()
    await b.close()
  })
})

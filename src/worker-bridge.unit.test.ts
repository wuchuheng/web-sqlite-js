import { describe, it, expect } from 'vitest'
import { createWorkerBridge } from './worker-bridge'
import { createLogDispatcher } from './logs/log-dispatcher'
import { SqliteEvent, type SqliteReqMsg } from './types/message'

/**
 * Minimal fake Worker used as a test seam via `workerFactory`.
 * Replaces the bundled inline worker so unit tests can simulate
 * worker silence, delayed responses, and unknown request ids.
 */
class FakeWorker {
  private handler: ((event: MessageEvent) => void) | null = null
  private responseDelayMs: number
  private respondUnknownId: boolean

  constructor(options: { responseDelayMs?: number; respondUnknownId?: boolean } = {}) {
    this.responseDelayMs = options.responseDelayMs ?? 0
    this.respondUnknownId = options.respondUnknownId ?? false
  }

  set onmessage(handler: ((event: MessageEvent) => void) | null) {
    this.handler = handler
  }

  get onmessage(): ((event: MessageEvent) => void) | null {
    return this.handler
  }

  postMessage(msg: unknown): void {
    const request = msg as SqliteReqMsg<unknown>
    const emit = () => {
      if (!this.handler) return
      let responseId = request.id
      if (this.respondUnknownId) {
        responseId = request.id + 10_000
      }
      this.handler({ data: { id: responseId, success: true, payload: undefined } } as MessageEvent)
    }
    if (this.responseDelayMs > 0) {
      setTimeout(emit, this.responseDelayMs)
    } else {
      emit()
    }
  }

  terminate(): void {
    this.handler = null
  }
}

function makeBridge(options: Parameters<typeof createWorkerBridge>[1]) {
  const dispatcher = createLogDispatcher()
  const logs: { level: string; data: unknown }[] = []
  dispatcher.register((log) => logs.push(log))
  const worker = new FakeWorker({
    responseDelayMs: (options as { factoryOptions?: { responseDelayMs?: number } })?.factoryOptions
      ?.responseDelayMs,
    respondUnknownId: (options as { factoryOptions?: { respondUnknownId?: boolean } })
      ?.factoryOptions?.respondUnknownId,
  })
  const bridge = createWorkerBridge(dispatcher, {
    timeoutMs: options?.timeoutMs ?? 100,
    workerFactory: () => worker as unknown as Worker,
  })
  return { bridge, dispatcher, logs, worker }
}

describe('createWorkerBridge message robustness', () => {
  it('resolves a normal request/response round trip', async () => {
    const { bridge } = makeBridge({})
    const result = await bridge.sendMsg<{ value: string }, { sql: string }>(SqliteEvent.QUERY, {
      sql: 'SELECT 1',
    })
    expect(result).toBeUndefined()
  })

  it(
    'rejects with a descriptive error when the worker never responds (timeout)',
    {
      timeout: 3_000,
    },
    async () => {
      // FakeWorker with responseDelayMs = Infinity simulates a wedged worker.
      const dispatcher = createLogDispatcher()
      const worker = new FakeWorker({ responseDelayMs: 60_000 }) as unknown as Worker
      const bridge = createWorkerBridge(dispatcher, {
        timeoutMs: 80,
        workerFactory: () => worker,
      })
      const start = Date.now()
      await expect(
        bridge.sendMsg<unknown, { sql: string }>(SqliteEvent.EXECUTE, { sql: 'SELECT 1' })
      ).rejects.toThrow(/did not respond within 80ms/)
      expect(Date.now() - start).toBeLessThan(3_000)
    }
  )

  it(
    'surfaces a warning log for a response with an unknown request id',
    {
      timeout: 3_000,
    },
    async () => {
      const dispatcher = createLogDispatcher()
      const logs: { level: string; data: { id?: number; message?: string } }[] = []
      dispatcher.register((log) => logs.push(log as never))
      const worker = new FakeWorker({ respondUnknownId: true }) as unknown as Worker
      const bridge = createWorkerBridge(dispatcher, {
        timeoutMs: 500,
        workerFactory: () => worker,
      })
      await expect(
        bridge.sendMsg<unknown, { sql: string }>(SqliteEvent.QUERY, { sql: 'SELECT 1' })
      ).rejects.toThrow(/did not respond within 500ms/)
      const relevant = logs.filter((log) => log.level === 'error' && log.data?.id != null)
      expect(relevant.length).toBeGreaterThan(0)
      expect(relevant[0].data?.message).toMatch(/unknown request id/i)
    }
  )

  it('keeps serving subsequent requests after an unknown-id response', async () => {
    const dispatcher = createLogDispatcher()
    const worker = new FakeWorker({ respondUnknownId: false }) as unknown as Worker
    const bridge = createWorkerBridge(dispatcher, {
      timeoutMs: 500,
      workerFactory: () => worker,
    })
    await bridge.sendMsg<unknown, { sql: string }>(SqliteEvent.QUERY, { sql: 'SELECT 1' })
    await expect(
      bridge.sendMsg<unknown, { sql: string }>(SqliteEvent.QUERY, { sql: 'SELECT 2' })
    ).resolves.toBeUndefined()
  })
})

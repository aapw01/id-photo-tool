import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  __setWorkerFactoryForTesting,
  detectCornersInWorker,
  getOpenCVWorker,
  rectifyInWorker,
} from './opencv-worker-client'
import type { WorkerRequest, WorkerResponse } from './opencv-worker-protocol'

/**
 * Hand-rolled Worker fake.
 *
 * - `respond` lets each test plug in the reply behavior per inbound
 *   message kind (e.g. emulate the OpenCV worker, an error path, or
 *   intentional non-response for timeout cases).
 * - Replies are flushed via `queueMicrotask` so test code can await
 *   the returned promise and observe the result in the next tick.
 * - `terminate()` is recorded so reset / cleanup paths can be
 *   asserted.
 */
class FakeWorker {
  private listeners = new Map<string, Set<(event: unknown) => void>>()
  readonly received: WorkerRequest[] = []
  terminated = false
  respond: (req: WorkerRequest) => WorkerResponse | null = () => null

  addEventListener(type: string, listener: (event: unknown) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(listener)
  }

  removeEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  postMessage(message: WorkerRequest): void {
    this.received.push(message)
    queueMicrotask(() => {
      const reply = this.respond(message)
      if (reply) this.dispatch('message', { data: reply })
    })
  }

  terminate(): void {
    this.terminated = true
  }

  dispatch(type: string, event: unknown): void {
    const bucket = this.listeners.get(type)
    if (!bucket) return
    for (const listener of bucket) listener(event)
  }
}

function installFakeWorker(): FakeWorker {
  const w = new FakeWorker()
  __setWorkerFactoryForTesting(() => w as unknown as Worker)
  // Default behavior: echo a ping:done so getOpenCVWorker resolves.
  w.respond = (req) => {
    if (req.type === 'ping') return { id: req.id, type: 'ping:done' }
    return null
  }
  return w
}

beforeEach(() => {
  // happy-dom does not expose a Worker constructor by default; stub
  // the global so the support check passes regardless of environment.
  vi.stubGlobal('Worker', FakeWorker)
})

afterEach(() => {
  __setWorkerFactoryForTesting(null)
  vi.unstubAllGlobals()
})

describe('getOpenCVWorker', () => {
  it('boots the worker, sends a ping, and resolves on pong', async () => {
    const fake = installFakeWorker()
    const worker = await getOpenCVWorker()
    expect(worker).toBe(fake)
    expect(fake.received.map((m) => m.type)).toEqual(['ping'])
  })

  it('caches the singleton across concurrent calls', async () => {
    installFakeWorker()
    const [a, b] = await Promise.all([getOpenCVWorker(), getOpenCVWorker()])
    expect(a).toBe(b)
  })

  it('rejects with OpenCVWorkerUnavailableError when Worker is missing', async () => {
    vi.unstubAllGlobals()
    __setWorkerFactoryForTesting(null)
    await expect(getOpenCVWorker()).rejects.toMatchObject({
      name: 'OpenCVWorkerUnavailableError',
    })
  })

  it('surfaces a ping error reply as OpenCVLoadError', async () => {
    const fake = installFakeWorker()
    fake.respond = (req) => ({
      id: req.id,
      type: 'error',
      payload: { message: 'boom' },
    })
    await expect(getOpenCVWorker()).rejects.toMatchObject({
      name: 'OpenCVLoadError',
      message: 'boom',
    })
  })
})

describe('detectCornersInWorker', () => {
  const quadFixture = {
    topLeft: { x: 1, y: 2 },
    topRight: { x: 3, y: 4 },
    bottomRight: { x: 5, y: 6 },
    bottomLeft: { x: 7, y: 8 },
  }

  it('round-trips a detect request and matches reply by id', async () => {
    const fake = installFakeWorker()
    fake.respond = (req) => {
      if (req.type === 'ping') return { id: req.id, type: 'ping:done' }
      if (req.type === 'detectCorners') {
        return {
          id: req.id,
          type: 'detectCorners:done',
          payload: { quad: quadFixture, detected: true },
        }
      }
      return null
    }
    const bitmap = {} as ImageBitmap
    const result = await detectCornersInWorker(bitmap)
    expect(result).toEqual({ quad: quadFixture, detected: true })
    expect(fake.received.map((m) => m.type)).toEqual(['ping', 'detectCorners'])
  })

  it('routes concurrent calls to the correct promise by message id', async () => {
    const fake = installFakeWorker()
    // Reply order intentionally reversed relative to send order to
    // prove we match by id rather than FIFO.
    const replies: WorkerResponse[] = []
    fake.respond = (req) => {
      if (req.type === 'ping') return { id: req.id, type: 'ping:done' }
      if (req.type === 'detectCorners') {
        const reply: WorkerResponse = {
          id: req.id,
          type: 'detectCorners:done',
          payload: {
            quad: quadFixture,
            detected: replies.length === 0, // first reply we generate → detected:true
          },
        }
        replies.unshift(reply) // unshift = newest first
        return reply
      }
      return null
    }
    const bitmap = {} as ImageBitmap
    const [a, b] = await Promise.all([detectCornersInWorker(bitmap), detectCornersInWorker(bitmap)])
    expect(a.detected).toBe(true)
    expect(b.detected).toBe(false)
  })

  it('propagates worker error replies as rejected promises', async () => {
    const fake = installFakeWorker()
    fake.respond = (req) => {
      if (req.type === 'ping') return { id: req.id, type: 'ping:done' }
      if (req.type === 'detectCorners') {
        return { id: req.id, type: 'error', payload: { message: 'cv died' } }
      }
      return null
    }
    await expect(detectCornersInWorker({} as ImageBitmap)).rejects.toThrow('cv died')
  })
})

describe('rectifyInWorker', () => {
  it('forwards args and returns the blob payload', async () => {
    const fake = installFakeWorker()
    const fakeBlob = new Blob(['rectified'], { type: 'image/png' })
    fake.respond = (req) => {
      if (req.type === 'ping') return { id: req.id, type: 'ping:done' }
      if (req.type === 'rectify') {
        return {
          id: req.id,
          type: 'rectify:done',
          payload: { blob: fakeBlob, width: 100, height: 200 },
        }
      }
      return null
    }
    const args = {
      bitmap: {} as ImageBitmap,
      quad: {
        topLeft: { x: 0, y: 0 },
        topRight: { x: 1, y: 0 },
        bottomRight: { x: 1, y: 1 },
        bottomLeft: { x: 0, y: 1 },
      },
      outputWidth: 100,
      outputHeight: 200,
    }
    const result = await rectifyInWorker(args)
    expect(result.blob).toBe(fakeBlob)
    expect(result.width).toBe(100)
    expect(result.height).toBe(200)
    const rectifyReq = fake.received.find((m) => m.type === 'rectify')
    expect(rectifyReq).toBeDefined()
    expect((rectifyReq as { payload: { outputWidth: number } }).payload.outputWidth).toBe(100)
  })
})

describe('worker reset', () => {
  it('terminates the previous worker when a new factory is installed', async () => {
    const first = installFakeWorker()
    await getOpenCVWorker()
    const second = installFakeWorker()
    // __setWorkerFactoryForTesting should have terminated `first`.
    expect(first.terminated).toBe(true)
    await getOpenCVWorker()
    expect(second.received[0]?.type).toBe('ping')
  })

  it('rejects in-flight requests when the worker emits a fatal error', async () => {
    const fake = installFakeWorker()
    let detectSeen!: () => void
    const detectPosted = new Promise<void>((resolve) => {
      detectSeen = resolve
    })
    fake.respond = (req) => {
      if (req.type === 'ping') return { id: req.id, type: 'ping:done' }
      if (req.type === 'detectCorners') {
        detectSeen()
        // No reply — we'll fire a fatal error instead.
        return null
      }
      return null
    }
    const pending = detectCornersInWorker({} as ImageBitmap)
    await detectPosted
    fake.dispatch('error', { message: 'simulated worker crash' })
    await expect(pending).rejects.toThrow(/simulated worker crash|OpenCV worker fatal/)
  })
})

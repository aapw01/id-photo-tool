/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createSegmentationClient,
  type SegmentationClient,
} from '@/features/segmentation/segmentation-client'
import type { SegmentRequest, SegmentResponse } from '@/features/segmentation/worker-protocol'

/**
 * Lightweight Worker stand-in: records every incoming postMessage and
 * exposes `emit()` to push synthetic responses back. Mirrors enough of
 * the Worker surface that segmentation-client doesn't notice.
 */
class FakeWorker {
  posted: SegmentRequest[] = []
  terminated = false
  private messageListeners: Array<(e: MessageEvent) => void> = []
  private errorListeners: Array<(e: ErrorEvent) => void> = []

  postMessage(data: SegmentRequest, _transfer?: Transferable[]) {
    void _transfer
    this.posted.push(data)
  }

  addEventListener(type: 'message' | 'error', listener: (e: never) => void) {
    if (type === 'message') {
      this.messageListeners.push(listener as (e: MessageEvent) => void)
    } else if (type === 'error') {
      this.errorListeners.push(listener as (e: ErrorEvent) => void)
    }
  }

  removeEventListener() {
    /* not used in tests */
  }

  terminate() {
    this.terminated = true
  }

  /** Push a synthetic response to the client. */
  emit(msg: SegmentResponse) {
    for (const l of this.messageListeners) {
      l({ data: msg } as MessageEvent)
    }
  }

  emitError(message: string) {
    for (const l of this.errorListeners) {
      l({ message } as ErrorEvent)
    }
  }
}

function makeBitmap(width: number, height: number): ImageBitmap {
  return { width, height, close: () => {} } as unknown as ImageBitmap
}

let fake: FakeWorker
let client: SegmentationClient

beforeEach(() => {
  // ImageData is not present in happy-dom by default; install a tiny polyfill.
  if (typeof (globalThis as { ImageData?: unknown }).ImageData === 'undefined') {
    ;(globalThis as { ImageData?: unknown }).ImageData = class {
      constructor(
        public data: Uint8ClampedArray,
        public width: number,
        public height: number,
      ) {}
    }
  }
  fake = new FakeWorker()
  client = createSegmentationClient(() => fake as unknown as Worker)
})

afterEach(() => {
  client.dispose()
})

describe('createSegmentationClient', () => {
  it('completes init when the worker emits `ready`', async () => {
    const onProgress = vi.fn()
    const initPromise = client.init({ onProgress })
    expect(fake.posted[0]?.type).toBe('init')
    const initId = fake.posted[0]!.id
    fake.emit({ type: 'progress', id: initId, phase: 'download', loaded: 50, total: 100 })
    fake.emit({ type: 'ready', id: initId, backend: 'webgpu' })
    const { backend } = await initPromise
    expect(backend).toBe('webgpu')
    expect(onProgress).toHaveBeenCalledWith({ phase: 'download', loaded: 50, total: 100 })
  })

  it('rejects with a normalized ClientError on `error` messages', async () => {
    const promise = client.init()
    const id = fake.posted[0]!.id
    fake.emit({
      type: 'error',
      id,
      kind: 'integrity',
      reason: 'sha mismatch',
    })
    await expect(promise).rejects.toEqual({ kind: 'integrity', reason: 'sha mismatch' })
  })

  it('forwards segment() and unpacks the result into an ImageData', async () => {
    const segPromise = client.segment(makeBitmap(8, 8))
    expect(fake.posted[0]?.type).toBe('segment')
    const id = fake.posted[0]!.id
    const mask = new Uint8ClampedArray(8 * 8 * 4)
    mask.fill(255)
    fake.emit({
      type: 'result',
      id,
      mask: mask.buffer,
      width: 8,
      height: 8,
      backend: 'wasm',
      durationMs: 12,
    })
    const result = await segPromise
    expect(result.mask.width).toBe(8)
    expect(result.mask.height).toBe(8)
    expect(result.mask.data.length).toBe(8 * 8 * 4)
    expect(result.backend).toBe('wasm')
    expect(result.durationMs).toBe(12)
  })

  it('multiplexes concurrent init + segment requests by id', async () => {
    const initP = client.init()
    const segP = client.segment(makeBitmap(2, 2))
    expect(fake.posted).toHaveLength(2)
    const initId = fake.posted[0]!.id
    const segId = fake.posted[1]!.id
    expect(initId).not.toBe(segId)

    // Reply to segment first, then init — order independent.
    const mask = new Uint8ClampedArray(2 * 2 * 4)
    fake.emit({
      type: 'result',
      id: segId,
      mask: mask.buffer,
      width: 2,
      height: 2,
      backend: 'webgpu',
      durationMs: 5,
    })
    fake.emit({ type: 'ready', id: initId, backend: 'webgpu' })

    await expect(initP).resolves.toEqual({ backend: 'webgpu' })
    await expect(segP).resolves.toMatchObject({ backend: 'webgpu', durationMs: 5 })
  })

  it('honors AbortSignal.aborted before send', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(client.segment(makeBitmap(1, 1), { signal: controller.signal })).rejects.toEqual({
      kind: 'unknown',
      reason: 'aborted',
    })
  })

  it('rejects every in-flight request when the worker errors', async () => {
    const p1 = client.init()
    const p2 = client.segment(makeBitmap(1, 1))
    fake.emitError('boom')
    await expect(p1).rejects.toMatchObject({ kind: 'unknown', reason: 'boom' })
    await expect(p2).rejects.toMatchObject({ kind: 'unknown', reason: 'boom' })
  })

  it('terminates the worker on dispose and rejects pending work', async () => {
    const p = client.init()
    client.dispose()
    await expect(p).rejects.toMatchObject({ kind: 'unknown' })
    expect(fake.terminated).toBe(true)
  })
})

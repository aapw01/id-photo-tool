import { describe, expect, it, vi } from 'vitest'
import {
  classifyError,
  createWorkerHandler,
  type WorkerHandlerDeps,
} from '@/features/segmentation/worker-router'
import type {
  SegmentSession,
  ProgressCallback,
  MaskBuffer,
} from '@/features/segmentation/segment-core'
import type { SegmentRequest, SegmentResponse } from '@/features/segmentation/worker-protocol'

function makeBitmap(width = 4, height = 4): ImageBitmap {
  return { width, height, close: vi.fn() } as unknown as ImageBitmap
}

function makeMask(width: number, height: number): MaskBuffer {
  return {
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
  }
}

interface Recorder {
  posts: SegmentResponse[]
  transfers: Transferable[][]
}

function makeRecorder(): { rec: Recorder; post: WorkerHandlerDeps['post'] } {
  const rec: Recorder = { posts: [], transfers: [] }
  return {
    rec,
    post: (msg, transfer) => {
      rec.posts.push(msg)
      rec.transfers.push(transfer ?? [])
    },
  }
}

describe('classifyError', () => {
  it('uses IntegrityError class name', () => {
    const err = new Error('sha mismatch')
    err.name = 'IntegrityError'
    expect(classifyError(err)).toEqual({ kind: 'integrity', reason: 'sha mismatch' })
  })

  it('uses ModelNetworkError class name', () => {
    const err = new Error('boom')
    err.name = 'ModelNetworkError'
    expect(classifyError(err)).toEqual({ kind: 'network', reason: 'boom' })
  })

  it('matches network keywords', () => {
    expect(classifyError(new Error('failed to fetch')).kind).toBe('network')
    expect(classifyError(new Error('CORS error')).kind).toBe('network')
    expect(classifyError(new Error('connect ECONNREFUSED')).kind).toBe('network')
  })

  it('matches inference keywords', () => {
    expect(classifyError(new Error('ort run failed')).kind).toBe('inference')
  })

  it('falls back to default kind', () => {
    expect(classifyError(new Error('nope'), 'init').kind).toBe('init')
    expect(classifyError('weird thing').kind).toBe('unknown')
  })
})

describe('createWorkerHandler', () => {
  it('routes init → ready with the session backend', async () => {
    const { rec, post } = makeRecorder()
    const fakeSession: SegmentSession = {
      backend: 'webgpu',
      async run() {
        return makeMask(4, 4)
      },
    }
    const load = vi.fn(async (opts: { onProgress?: ProgressCallback }) => {
      opts.onProgress?.('init', 1, 1)
      return fakeSession
    })
    const handler = createWorkerHandler({ post, load })
    handler({ type: 'init', id: 'a' })
    await new Promise((r) => setTimeout(r, 0))

    const ready = rec.posts.find((p) => p.type === 'ready')
    expect(ready).toMatchObject({ type: 'ready', id: 'a', backend: 'webgpu' })
    const progress = rec.posts.find((p) => p.type === 'progress')
    expect(progress?.type).toBe('progress')
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('memoises the session across requests (one load for two inits)', async () => {
    const { post } = makeRecorder()
    const load = vi.fn(
      async () =>
        ({
          backend: 'wasm',
          async run() {
            return makeMask(2, 2)
          },
        }) as SegmentSession,
    )
    const handler = createWorkerHandler({ post, load })
    handler({ type: 'init', id: 'a' })
    handler({ type: 'init', id: 'b' })
    await new Promise((r) => setTimeout(r, 0))
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('emits an integrity error when load throws IntegrityError', async () => {
    const { rec, post } = makeRecorder()
    const err = new Error('sha mismatch')
    err.name = 'IntegrityError'
    const load = vi.fn(async () => {
      throw err
    })
    const handler = createWorkerHandler({ post, load })
    handler({ type: 'init', id: 'x' })
    await new Promise((r) => setTimeout(r, 0))
    const errorMsg = rec.posts.find((p) => p.type === 'error')
    expect(errorMsg).toMatchObject({ kind: 'integrity', reason: 'sha mismatch', id: 'x' })
  })

  it('routes segment → result with the mask buffer transferred', async () => {
    const { rec, post } = makeRecorder()
    const session: SegmentSession = {
      backend: 'wasm',
      async run(bitmap: ImageBitmap) {
        return makeMask(bitmap.width, bitmap.height)
      },
    }
    const handler = createWorkerHandler({
      post,
      load: async () => session,
    })
    handler.__setSessionForTesting(session)
    const bitmap = makeBitmap(8, 8)
    handler({ type: 'segment', id: 'r', bitmap })
    await new Promise((r) => setTimeout(r, 0))

    const result = rec.posts.find((p) => p.type === 'result') as Extract<
      SegmentResponse,
      { type: 'result' }
    >
    expect(result).toBeDefined()
    expect(result.width).toBe(8)
    expect(result.height).toBe(8)
    expect(result.backend).toBe('wasm')
    expect(result.mask.byteLength).toBe(8 * 8 * 4)
    // Mask buffer should be marked as transferable
    expect(rec.transfers[rec.transfers.length - 1]).toContain(result.mask)
    expect(bitmap.close).toHaveBeenCalled()
  })

  it('classifies runSegment failures as inference errors', async () => {
    const { rec, post } = makeRecorder()
    const session: SegmentSession = {
      backend: 'wasm',
      async run() {
        throw new Error('ort run failed: invalid input')
      },
    }
    const handler = createWorkerHandler({
      post,
      load: async () => session,
    })
    handler.__setSessionForTesting(session)
    handler({ type: 'segment', id: 's', bitmap: makeBitmap() })
    await new Promise((r) => setTimeout(r, 0))

    const errorMsg = rec.posts.find((p) => p.type === 'error')
    expect(errorMsg).toMatchObject({ kind: 'inference', id: 's' })
  })

  it('emits an error response for an unknown message type', () => {
    const { rec, post } = makeRecorder()
    const handler = createWorkerHandler({ post })
    handler({ type: 'bogus' } as unknown as SegmentRequest)
    const errorMsg = rec.posts.find((p) => p.type === 'error')
    expect(errorMsg).toMatchObject({ kind: 'unknown', id: 'unknown' })
  })
})

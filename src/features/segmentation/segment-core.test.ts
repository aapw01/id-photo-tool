import { describe, expect, it, vi } from 'vitest'
import {
  loadSession,
  runSegment,
  type ProgressCallback,
  type SegmentSession,
} from '@/features/segmentation/segment-core'

/**
 * Minimal ImageBitmap stand-in for happy-dom — only `width`, `height`,
 * and `close()` are touched by segment-core / the worker entry.
 */
function makeBitmap(width: number, height: number): ImageBitmap {
  return { width, height, close: () => {} } as unknown as ImageBitmap
}

const FAKE_MODEL = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]).buffer

describe('loadSession', () => {
  it('returns a session and reports init progress when a modelBuffer is injected', async () => {
    const progress: Array<Parameters<ProgressCallback>> = []
    const session = await loadSession({
      modelBuffer: FAKE_MODEL,
      onProgress: (...args) => progress.push(args),
    })

    expect(session.backend).toBe('wasm')
    expect(progress.map(([phase]) => phase)).toContain('init')
  })

  it('tolerates a missing progress callback', async () => {
    await expect(loadSession({ modelBuffer: FAKE_MODEL })).resolves.toBeDefined()
  })
})

describe('runSegment', () => {
  it('produces a mask matching the input bitmap dimensions', async () => {
    const session = await loadSession({ modelBuffer: FAKE_MODEL })
    const bitmap = makeBitmap(128, 96)

    const { mask, durationMs, backend } = await runSegment(session, bitmap)

    expect(mask.width).toBe(128)
    expect(mask.height).toBe(96)
    expect(mask.data).toBeInstanceOf(Uint8Array)
    expect(mask.data.byteLength).toBe(128 * 96)
    expect(durationMs).toBeGreaterThanOrEqual(0)
    expect(backend).toBe('wasm')
  })

  it('fires the infer phase progress event', async () => {
    const session = await loadSession({ modelBuffer: FAKE_MODEL })
    const fn = vi.fn<ProgressCallback>()
    await runSegment(session, makeBitmap(8, 8), fn)
    expect(fn).toHaveBeenCalledWith('infer')
  })

  it('propagates errors from session.run', async () => {
    const failing: SegmentSession = {
      backend: 'webgpu',
      run: async () => {
        throw new Error('inference exploded')
      },
    }
    await expect(runSegment(failing, makeBitmap(2, 2))).rejects.toThrow('inference exploded')
  })
})

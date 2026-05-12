// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FaceDetectError, detectFace } from '@/features/crop/face-detect'
import {
  __resetFaceDetectorForTesting,
  __setTasksVisionModuleForTesting,
} from '@/features/crop/mediapipe-loader'

interface FakeBitmap {
  width: number
  height: number
  close?: () => void
}

const fakeBitmap = (w = 1000, h = 1500): ImageBitmap =>
  ({ width: w, height: h, close: () => {} }) as unknown as ImageBitmap

interface MpDetection {
  boundingBox?: { originX: number; originY: number; width: number; height: number }
  keypoints?: Array<{ x: number; y: number }>
  categories?: Array<{ score: number; index: number; categoryName: string }>
}

function installFakeModule(detect: (bm: FakeBitmap) => { detections: MpDetection[] }) {
  const createFromOptions = vi.fn(async () => ({ detect }))
  const forVisionTasks = vi.fn(async () => ({}))
  __setTasksVisionModuleForTesting({
    FaceDetector: { createFromOptions } as unknown as never,
    FilesetResolver: { forVisionTasks } as unknown as never,
  } as never)
  return { createFromOptions, forVisionTasks }
}

afterEach(() => {
  __resetFaceDetectorForTesting()
  vi.restoreAllMocks()
})

describe('detectFace', () => {
  beforeEach(() => {
    __resetFaceDetectorForTesting()
  })

  it('returns null when the detector finds no faces', async () => {
    installFakeModule(() => ({ detections: [] }))
    const result = await detectFace(fakeBitmap())
    expect(result).toBeNull()
  })

  it('returns the largest face with pixel-space bbox', async () => {
    installFakeModule(() => ({
      detections: [
        {
          boundingBox: { originX: 100, originY: 100, width: 50, height: 60 },
          keypoints: [{ x: 0.5, y: 0.5 }],
          categories: [{ score: 0.9, index: 0, categoryName: 'face' }],
        },
        {
          boundingBox: { originX: 400, originY: 200, width: 300, height: 400 },
          keypoints: [
            { x: 0.55, y: 0.4 },
            { x: 0.6, y: 0.42 },
          ],
          categories: [{ score: 0.95, index: 0, categoryName: 'face' }],
        },
      ],
    }))
    const result = await detectFace(fakeBitmap(1000, 1500))
    expect(result).not.toBeNull()
    expect(result!.bbox).toEqual({ x: 400, y: 200, w: 300, h: 400 })
    expect(result!.confidence).toBeCloseTo(0.95)
    // Keypoints were normalised → scaled to pixel space
    expect(result!.keypoints[0]).toEqual({ x: 550, y: 600 })
  })

  it('passes through keypoints already in pixel space', async () => {
    installFakeModule(() => ({
      detections: [
        {
          boundingBox: { originX: 100, originY: 100, width: 80, height: 80 },
          // Values > 1 → already pixel coordinates
          keypoints: [{ x: 140, y: 130 }],
          categories: [{ score: 0.88, index: 0, categoryName: 'face' }],
        },
      ],
    }))
    const result = await detectFace(fakeBitmap())
    expect(result!.keypoints[0]).toEqual({ x: 140, y: 130 })
  })

  it('wraps load failures in FaceDetectError(model-fetch)', async () => {
    __setTasksVisionModuleForTesting({
      FaceDetector: {
        createFromOptions: vi.fn(async () => {
          throw new Error('network down')
        }),
      } as unknown as never,
      FilesetResolver: {
        forVisionTasks: vi.fn(async () => ({})),
      } as unknown as never,
    } as never)
    await expect(detectFace(fakeBitmap())).rejects.toMatchObject({
      name: 'FaceDetectError',
      kind: 'model-fetch',
    })
  })

  it('wraps runtime failures in FaceDetectError(runtime)', async () => {
    installFakeModule(() => {
      throw new Error('detector blew up')
    })
    await expect(detectFace(fakeBitmap())).rejects.toBeInstanceOf(FaceDetectError)
    try {
      await detectFace(fakeBitmap())
    } catch (err) {
      expect((err as FaceDetectError).kind).toBe('runtime')
    }
  })

  it('reuses the cached detector across calls', async () => {
    const { createFromOptions } = installFakeModule(() => ({ detections: [] }))
    await detectFace(fakeBitmap())
    await detectFace(fakeBitmap())
    await detectFace(fakeBitmap())
    expect(createFromOptions).toHaveBeenCalledTimes(1)
  })

  it('throws FaceDetectError(timeout) when the loader hangs past the deadline', async () => {
    // Stub the module so createFromOptions never resolves — mimics the
    // jsDelivr / GCS CDN being unreachable in restricted networks.
    __setTasksVisionModuleForTesting({
      FaceDetector: {
        createFromOptions: vi.fn(() => new Promise(() => {})),
      } as unknown as never,
      FilesetResolver: {
        forVisionTasks: vi.fn(async () => ({})),
      } as unknown as never,
    } as never)

    vi.useFakeTimers()
    try {
      const promise = detectFace(fakeBitmap(), { timeoutMs: 50 })
      vi.advanceTimersByTime(60)
      await expect(promise).rejects.toMatchObject({
        name: 'FaceDetectError',
        kind: 'timeout',
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('resolves before the deadline when the detector is quick', async () => {
    installFakeModule(() => ({ detections: [] }))
    const result = await detectFace(fakeBitmap(), { timeoutMs: 1_000 })
    expect(result).toBeNull()
  })

  it('disables the timeout when opts.timeoutMs is 0', async () => {
    installFakeModule(() => ({ detections: [] }))
    // Just verifies the call returns rather than instrumenting timer
    // behaviour; the contract is that 0 = no race against a deadline.
    const result = await detectFace(fakeBitmap(), { timeoutMs: 0 })
    expect(result).toBeNull()
  })
})

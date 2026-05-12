// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  __resetMediaPipeSilencerForTesting,
  isMediaPipeBootNoise,
  silenceMediaPipeBootNoise,
} from './silence-mediapipe-noise'

describe('isMediaPipeBootNoise', () => {
  it('flags the OpenGL warning', () => {
    expect(isMediaPipeBootNoise('W0512 ... OpenGL error checking is disabled')).toBe(true)
  })

  it('flags the XNNPACK delegate INFO line', () => {
    expect(isMediaPipeBootNoise('INFO: Created TensorFlow Lite XNNPACK delegate for CPU.')).toBe(
      true,
    )
  })

  it('flags the feedback manager warning', () => {
    expect(
      isMediaPipeBootNoise(
        'W0512 ... Feedback manager requires a model with a single signature inference. Disabling support for feedback tensors.',
      ),
    ).toBe(true)
  })

  it('flags wasm internal stack traces', () => {
    expect(
      isMediaPipeBootNoise(
        'at Object.put_char (https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm/vision_wasm_internal.js:1404:9)',
      ),
    ).toBe(true)
  })

  it('does not flag application errors', () => {
    expect(isMediaPipeBootNoise('TypeError: Cannot read properties of undefined')).toBe(false)
    expect(isMediaPipeBootNoise('face detection timed out after 10000 ms')).toBe(false)
    expect(isMediaPipeBootNoise('')).toBe(false)
  })
})

describe('silenceMediaPipeBootNoise', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    __resetMediaPipeSilencerForTesting()
  })

  it('swallows known boot noise across log levels', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    silenceMediaPipeBootNoise()

    console.log('INFO: Created TensorFlow Lite XNNPACK delegate for CPU.')
    console.error('W0512 ... OpenGL error checking is disabled')

    expect(log).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it('lets unrelated messages through', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    silenceMediaPipeBootNoise()

    console.error('TypeError: real bug, must reach user')

    expect(error).toHaveBeenCalledWith('TypeError: real bug, must reach user')
  })

  it('is idempotent — calling it twice does not double-wrap console', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    silenceMediaPipeBootNoise()
    silenceMediaPipeBootNoise()

    console.error('a regular error')

    expect(error).toHaveBeenCalledTimes(1)
  })
})

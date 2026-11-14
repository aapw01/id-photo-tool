import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SEG_MODEL,
  MODEL_FALLBACK_URL,
  MODEL_SHA384,
  MODEL_URL,
  MODEL_VARIANT,
  MODEL_VARIANTS,
  ORT_BASE_URL,
} from '@/features/segmentation/runtime-config'

describe('runtime-config', () => {
  it('uses the active variant from ModelScope, with a same-origin fallback', () => {
    expect(MODEL_URL).toBe(MODEL_VARIANT.sources[0])
    expect(MODEL_FALLBACK_URL).toBe(`/_models/${MODEL_VARIANT.path}`)
  })

  it('MODEL_SHA384 mirrors the active variant', () => {
    expect(MODEL_SHA384).toBe(MODEL_VARIANT.sha384)
  })

  it('DEFAULT_SEG_MODEL is fp16 (the M9 quality-bump default)', () => {
    expect(DEFAULT_SEG_MODEL).toBe('modnet-fp16')
  })

  it('ORT_BASE_URL is a CDN base URL ending with /', () => {
    expect(ORT_BASE_URL).toMatch(/^https?:\/\/.+\/$/)
  })

  it('ORT_BASE_URL pins to an installed onnxruntime-web version (no `latest`)', () => {
    // Guards against a future package.json refactor that strips the version.
    expect(ORT_BASE_URL).not.toMatch(/latest/)
    expect(ORT_BASE_URL).toMatch(/onnxruntime-web@\d+\.\d+\.\d+/)
  })

  it('Both variants exist in MODEL_VARIANTS with proper shape', () => {
    expect(MODEL_VARIANTS['modnet-fp16'].approxBytes).toBeGreaterThan(11_000_000)
    expect(MODEL_VARIANTS['modnet-int8'].approxBytes).toBeLessThan(8_000_000)
  })
})

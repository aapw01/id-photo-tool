import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SEG_MODEL,
  MODEL_SHA384,
  MODEL_URL,
  MODEL_VARIANT,
  MODEL_VARIANTS,
  ORT_BASE_URL,
} from '@/features/segmentation/runtime-config'

describe('runtime-config', () => {
  it('MODEL_URL points at the active variant under /_models/', () => {
    expect(MODEL_URL).toMatch(/^\/?_models\/modnet\.(?:fp16|q)\.onnx$/)
  })

  it('MODEL_URL matches the active variant path', () => {
    expect(MODEL_URL).toMatch(new RegExp(`${MODEL_VARIANT.path}$`))
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

import { describe, expect, it } from 'vitest'
import { MODEL_URL, ORT_BASE_URL } from '@/features/segmentation/runtime-config'

describe('runtime-config', () => {
  it('MODEL_URL points at the static asset by default', () => {
    expect(MODEL_URL).toMatch(/modnet\.q\.onnx$/)
  })

  it('ORT_BASE_URL is a CDN base URL ending with /', () => {
    expect(ORT_BASE_URL).toMatch(/^https?:\/\/.+\/$/)
  })

  it('ORT_BASE_URL pins to an installed onnxruntime-web version (no `latest`)', () => {
    // Guards against a future package.json refactor that strips the version.
    expect(ORT_BASE_URL).not.toMatch(/latest/)
    expect(ORT_BASE_URL).toMatch(/onnxruntime-web@\d+\.\d+\.\d+/)
  })
})

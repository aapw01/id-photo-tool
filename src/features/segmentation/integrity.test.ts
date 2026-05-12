import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  IntegrityError,
  MODEL_FILENAME,
  MODEL_SHA384,
  verifyModel,
} from '@/features/segmentation/integrity'
import { MODEL_VARIANTS } from '@/features/segmentation/runtime-config'

const MODEL_PATH = resolve(import.meta.dirname, `../../../public/_models/${MODEL_FILENAME}`)

describe('verifyModel', () => {
  const sampleBuf = new TextEncoder().encode('hello pixfit').buffer

  it('rejects a buffer that does not match MODEL_SHA384', async () => {
    await expect(verifyModel(sampleBuf)).rejects.toBeInstanceOf(IntegrityError)
  })

  it('returns the buffer untouched when allowEmpty is set on a mismatch', async () => {
    // The buffer does not match, but allowEmpty only short-circuits when
    // MODEL_SHA384 itself is empty — so this still throws once we have a hash.
    if (!MODEL_SHA384) {
      const out = await verifyModel(sampleBuf, { allowEmpty: true })
      expect(out).toBe(sampleBuf)
    } else {
      await expect(verifyModel(sampleBuf, { allowEmpty: true })).rejects.toBeInstanceOf(
        IntegrityError,
      )
    }
  })

  it('accepts the real MODNet model that matches MODEL_SHA384', async () => {
    let buf: Buffer
    try {
      buf = await readFile(MODEL_PATH)
    } catch {
      // Model not fetched yet — skip rather than fail CI on fresh checkouts.
      console.warn(`[skip] ${MODEL_PATH} not found. Run \`pnpm models:fetch\`.`)
      return
    }
    const out = await verifyModel(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
    expect(out.byteLength).toBe(buf.byteLength)
  })

  it('rejects a single-byte tampered model', async () => {
    let buf: Buffer
    try {
      buf = await readFile(MODEL_PATH)
    } catch {
      return
    }
    const tampered = new Uint8Array(buf)
    tampered[0] = tampered[0]! ^ 0xff
    await expect(verifyModel(tampered.buffer)).rejects.toBeInstanceOf(IntegrityError)
  })
})

describe('MODEL_VARIANTS registry', () => {
  it('declares both modnet-fp16 (default) and modnet-int8 (fallback)', () => {
    expect(Object.keys(MODEL_VARIANTS).sort()).toEqual(['modnet-fp16', 'modnet-int8'])
  })

  it('every registered variant carries a non-empty sha384-* hash', () => {
    for (const variant of Object.values(MODEL_VARIANTS)) {
      expect(variant.sha384).toMatch(/^sha384-[A-Za-z0-9+/]+=*$/)
      expect(variant.path).toMatch(/\.onnx$/)
      expect(variant.approxBytes).toBeGreaterThan(1_000_000)
      expect(variant.sources.length).toBeGreaterThan(0)
    }
  })

  it('exposes the active variant via MODEL_SHA384 / MODEL_FILENAME', () => {
    const active = Object.values(MODEL_VARIANTS).find((v) => v.sha384 === MODEL_SHA384)
    expect(active).toBeDefined()
    expect(active!.path).toBe(MODEL_FILENAME)
  })
})

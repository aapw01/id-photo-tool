import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { IntegrityError, MODEL_SHA384, verifyModel } from '@/features/segmentation/integrity'

const MODEL_PATH = resolve(import.meta.dirname, '../../../public/_models/modnet.q.onnx')

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

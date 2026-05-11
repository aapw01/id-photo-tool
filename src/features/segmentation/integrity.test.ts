import { describe, expect, it } from 'vitest'
import { IntegrityError, verifyModel } from '@/features/segmentation/integrity'

describe('verifyModel', () => {
  const sampleBuf = new TextEncoder().encode('hello pixfit').buffer

  it('throws when MODEL_SHA384 is empty by default', async () => {
    await expect(verifyModel(sampleBuf)).rejects.toBeInstanceOf(IntegrityError)
  })

  it('returns the buffer untouched when allowEmpty is set', async () => {
    const out = await verifyModel(sampleBuf, { allowEmpty: true })
    expect(out).toBe(sampleBuf)
  })

  // Once MODEL_SHA384 is filled in by `pnpm models:fetch`, add a positive case:
  //   it('passes for a buffer matching MODEL_SHA384', async () => { ... })
  //   it('rejects a tampered buffer', async () => { ... })
})

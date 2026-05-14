import { describe, expect, it, vi } from 'vitest'

import {
  DocumentUploadError,
  loadDocumentImage,
  SCANNER_UPLOAD_LIMITS,
} from './load-document-image'

// happy-dom marks `createImageBitmap` as read-only on globalThis, so
// a plain assignment throws. We swap it via `Object.defineProperty`
// (matching how Vitest's `stubGlobal` works) and restore the
// descriptor after each test.
function patchImageBitmap(fake: typeof createImageBitmap) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap')
  Object.defineProperty(globalThis, 'createImageBitmap', {
    configurable: true,
    writable: true,
    value: fake,
  })
  return () => {
    if (original) {
      Object.defineProperty(globalThis, 'createImageBitmap', original)
    } else {
      // @ts-expect-error — restoring to undefined when no original existed
      delete globalThis.createImageBitmap
    }
  }
}

function makeFile(bytes: number, name: string, type: string): File {
  // happy-dom respects `size` when constructing from a typed-array, so
  // we hand it the right-sized buffer rather than mutating size after.
  return new File([new Uint8Array(bytes)], name, { type })
}

describe('loadDocumentImage', () => {
  it('rejects files larger than 20 MB', async () => {
    const oversize = makeFile(SCANNER_UPLOAD_LIMITS.maxBytes + 1, 'big.jpg', 'image/jpeg')
    await expect(loadDocumentImage(oversize)).rejects.toMatchObject({
      code: 'too_large',
      name: 'DocumentUploadError',
    })
  })

  it('rejects unsupported MIME / extensions', async () => {
    const pdf = makeFile(1024, 'note.pdf', 'application/pdf')
    await expect(loadDocumentImage(pdf)).rejects.toMatchObject({
      code: 'unsupported_type',
    })
  })

  it('accepts a file whose MIME is empty but extension is valid (Safari HEIC quirk)', async () => {
    const fakeBitmap = { width: 100, height: 100, close() {} } as unknown as ImageBitmap
    const restore = patchImageBitmap(vi.fn().mockResolvedValue(fakeBitmap))
    // Stand in a HEIC file but stub heic2any so we don't pull libheif
    // in the test environment.
    vi.doMock('heic2any', () => ({
      default: vi
        .fn()
        .mockResolvedValue(new Blob([new Uint8Array([0xff, 0xd8])], { type: 'image/jpeg' })),
    }))

    try {
      const file = makeFile(1024, 'IMG_1234.HEIC', '')
      const result = await loadDocumentImage(file)
      expect(result.convertedFromHeic).toBe(true)
      expect(result.decodedMime).toBe('image/jpeg')
      expect(result.bitmap).toBe(fakeBitmap)
    } finally {
      restore()
      vi.doUnmock('heic2any')
    }
  })

  it('surfaces a decode_failed error when createImageBitmap throws', async () => {
    const restore = patchImageBitmap(vi.fn().mockRejectedValue(new Error('corrupt jpeg')))
    try {
      const file = makeFile(1024, 'broken.jpg', 'image/jpeg')
      await expect(loadDocumentImage(file)).rejects.toMatchObject({
        code: 'decode_failed',
      })
    } finally {
      restore()
    }
  })

  it('passes through non-HEIC files unmodified', async () => {
    const fakeBitmap = { width: 100, height: 100, close() {} } as unknown as ImageBitmap
    const restore = patchImageBitmap(vi.fn().mockResolvedValue(fakeBitmap))
    try {
      const file = makeFile(1024, 'photo.jpg', 'image/jpeg')
      const result = await loadDocumentImage(file)
      expect(result.convertedFromHeic).toBe(false)
      expect(result.blob).toBe(file)
      expect(result.decodedMime).toBe('image/jpeg')
    } finally {
      restore()
    }
  })

  it('DocumentUploadError is identifiable via instanceof and code', () => {
    const err = new DocumentUploadError('too_large', 'big', 'a.jpg')
    expect(err).toBeInstanceOf(DocumentUploadError)
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('too_large')
    expect(err.fileName).toBe('a.jpg')
  })
})

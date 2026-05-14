import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  __setPdfRendererForTests,
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
  afterEach(() => {
    __setPdfRendererForTests(null)
  })

  it('rejects files larger than 20 MB', async () => {
    const oversize = makeFile(SCANNER_UPLOAD_LIMITS.maxBytes + 1, 'big.jpg', 'image/jpeg')
    await expect(loadDocumentImage(oversize)).rejects.toMatchObject({
      code: 'too_large',
      name: 'DocumentUploadError',
    })
  })

  it('rejects unsupported MIME / extensions', async () => {
    const bin = makeFile(1024, 'note.bin', 'application/octet-stream')
    await expect(loadDocumentImage(bin)).rejects.toMatchObject({
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

  describe('PDF uploads', () => {
    it('accepts application/pdf by MIME', async () => {
      const fakeBitmap = { width: 800, height: 600, close() {} } as unknown as ImageBitmap
      const restore = patchImageBitmap(vi.fn().mockResolvedValue(fakeBitmap))
      const renderedPng = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], {
        type: 'image/png',
      })
      __setPdfRendererForTests(vi.fn().mockResolvedValue({ blob: renderedPng, sourcePageCount: 1 }))
      try {
        const file = makeFile(1024, 'form.pdf', 'application/pdf')
        const result = await loadDocumentImage(file)
        expect(result.convertedFromPdf).toBe(true)
        expect(result.convertedFromHeic).toBe(false)
        expect(result.sourcePageCount).toBe(1)
        expect(result.decodedMime).toBe('image/png')
        expect(result.blob).toBe(renderedPng)
        expect(result.bitmap).toBe(fakeBitmap)
      } finally {
        restore()
      }
    })

    it('accepts a .pdf extension even when file.type is empty', async () => {
      // Mimics older browsers / file pickers that omit the MIME for PDFs.
      const fakeBitmap = { width: 800, height: 600, close() {} } as unknown as ImageBitmap
      const restore = patchImageBitmap(vi.fn().mockResolvedValue(fakeBitmap))
      const renderedPng = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], {
        type: 'image/png',
      })
      __setPdfRendererForTests(vi.fn().mockResolvedValue({ blob: renderedPng, sourcePageCount: 3 }))
      try {
        const file = makeFile(1024, 'scan.PDF', '')
        const result = await loadDocumentImage(file)
        expect(result.convertedFromPdf).toBe(true)
        expect(result.sourcePageCount).toBe(3)
      } finally {
        restore()
      }
    })

    it('surfaces a pdf_decode_failed error when the renderer throws', async () => {
      __setPdfRendererForTests(vi.fn().mockRejectedValue(new Error('corrupted xref')))
      const file = makeFile(1024, 'broken.pdf', 'application/pdf')
      await expect(loadDocumentImage(file)).rejects.toMatchObject({
        code: 'pdf_decode_failed',
      })
    })

    it('passes the file ArrayBuffer through to the renderer', async () => {
      const fakeBitmap = { width: 100, height: 100, close() {} } as unknown as ImageBitmap
      const restore = patchImageBitmap(vi.fn().mockResolvedValue(fakeBitmap))
      const renderer = vi.fn().mockResolvedValue({
        blob: new Blob([new Uint8Array([0])], { type: 'image/png' }),
        sourcePageCount: 1,
      })
      __setPdfRendererForTests(renderer)
      try {
        const file = makeFile(64, 'one.pdf', 'application/pdf')
        await loadDocumentImage(file)
        expect(renderer).toHaveBeenCalledTimes(1)
        const arg = renderer.mock.calls[0]?.[0]
        // file.arrayBuffer() returns an ArrayBuffer at the file's size.
        expect(arg).toBeInstanceOf(ArrayBuffer)
        expect((arg as ArrayBuffer).byteLength).toBe(64)
      } finally {
        restore()
      }
    })
  })
})

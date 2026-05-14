import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PackedSheetResult, PaperSize } from './pack-a4'

/**
 * `jspdf` is mocked at the module level so the test asserts our
 * orchestration — paper-size routing, dataUrl plumbing, title
 * metadata — without depending on jsPDF actually decoding a JPEG.
 * (jsPDF's real `addImage` tries to read from the FS when handed
 * data it doesn't like; not worth the contortion for a unit test.)
 *
 * The mock records every constructor + method call, and `output`
 * returns a real Blob with `application/pdf` MIME so callers can
 * assert as if jsPDF really ran.
 */
const ctorCalls: unknown[][] = []
const setPropertiesCalls: unknown[][] = []
const addImageCalls: unknown[][] = []

vi.mock('jspdf', () => {
  class JsPdfMock {
    constructor(opts?: unknown) {
      ctorCalls.push([opts])
    }
    setProperties(props: unknown) {
      setPropertiesCalls.push([props])
    }
    addImage(...args: unknown[]) {
      addImageCalls.push(args)
    }
    output(kind: string) {
      if (kind !== 'blob') throw new Error(`unexpected output kind: ${kind}`)
      return new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], {
        type: 'application/pdf',
      })
    }
  }
  return { default: JsPdfMock }
})

// Import AFTER the mock so the under-test module pulls in the mocked
// `jspdf` constructor.
const { exportPackedA4ToPdf, exportPackedSheetToPdf } = await import('./export-pdf')

function installToDataURLStub() {
  const proto = HTMLCanvasElement.prototype as unknown as {
    toDataURL: (mime?: string, quality?: number) => string
  }
  proto.toDataURL = vi.fn(() => 'data:image/jpeg;base64,AAAA')
}

function makePacked(paperSize: PaperSize): PackedSheetResult {
  const bytes = new Uint8Array(16)
  const blob = new Blob([bytes], { type: 'image/png' })
  ;(blob as unknown as { width: number; height: number }).width = 32
  ;(blob as unknown as { width: number; height: number }).height = 32
  return {
    blob,
    width: 32,
    height: 32,
    pxPerMm: 300 / 25.4,
    paperSize,
  }
}

describe('exportPackedSheetToPdf', () => {
  beforeEach(() => {
    ctorCalls.length = 0
    setPropertiesCalls.length = 0
    addImageCalls.length = 0
    installToDataURLStub()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('emits a PDF blob for an A4 packed sheet at A4 page size', async () => {
    const blob = await exportPackedSheetToPdf({ packed: makePacked('a4') })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/pdf')

    expect(ctorCalls).toHaveLength(1)
    expect(ctorCalls[0]![0]).toMatchObject({
      format: 'a4',
      unit: 'mm',
      orientation: 'portrait',
    })

    expect(addImageCalls).toHaveLength(1)
    // addImage(dataUrl, "JPEG", 0, 0, widthMm, heightMm, undefined, "FAST")
    const args = addImageCalls[0]!
    expect(args[1]).toBe('JPEG')
    expect(args[2]).toBe(0)
    expect(args[3]).toBe(0)
    expect(args[4]).toBeCloseTo(210, 1)
    expect(args[5]).toBeCloseTo(297, 1)
  })

  it('routes the Letter paper size through jsPDF', async () => {
    const blob = await exportPackedSheetToPdf({ packed: makePacked('letter') })
    expect(blob.type).toBe('application/pdf')
    expect(ctorCalls[0]![0]).toMatchObject({ format: 'letter' })
    const args = addImageCalls[0]!
    expect(args[4]).toBeCloseTo(215.9, 1)
    expect(args[5]).toBeCloseTo(279.4, 1)
  })

  it('routes the A5 paper size through jsPDF', async () => {
    const blob = await exportPackedSheetToPdf({ packed: makePacked('a5') })
    expect(blob.type).toBe('application/pdf')
    expect(ctorCalls[0]![0]).toMatchObject({ format: 'a5' })
    const args = addImageCalls[0]!
    expect(args[4]).toBeCloseTo(148, 1)
    expect(args[5]).toBeCloseTo(210, 1)
  })

  it('forwards the optional `title` to jsPDF metadata', async () => {
    await exportPackedSheetToPdf({
      packed: makePacked('a4'),
      title: 'Pixfit Scanner',
    })
    expect(setPropertiesCalls).toHaveLength(1)
    expect(setPropertiesCalls[0]![0]).toMatchObject({ title: 'Pixfit Scanner' })
  })

  it('omits setProperties when no title is supplied', async () => {
    await exportPackedSheetToPdf({ packed: makePacked('a4') })
    expect(setPropertiesCalls).toHaveLength(0)
  })

  it('exportPackedA4ToPdf alias points at the same function', () => {
    expect(exportPackedA4ToPdf).toBe(exportPackedSheetToPdf)
  })
})

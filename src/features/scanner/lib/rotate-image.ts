'use client'

/**
 * 90° image rotation on a 2D canvas.
 *
 * Used by the Scanner so a user who shot the document sideways can
 * spin the upload without re-taking the photo. Each call rotates
 * clockwise by `deg` (90 / 180 / 270) and produces both a fresh
 * `ImageBitmap` (for the rectify pipeline) and a `Blob` (for the
 * upload card thumbnail's `URL.createObjectURL`).
 *
 * The output is always PNG — we accept the size penalty over JPEG
 * because the bitmap is what feeds the warp kernel, and JPEG ringing
 * at the document edges would interfere with corner snapping.
 */

export type RotationDegrees = 90 | 180 | 270

export interface RotatedImage {
  bitmap: ImageBitmap
  blob: Blob
}

export async function rotateImage(
  source: ImageBitmap,
  deg: RotationDegrees,
): Promise<RotatedImage> {
  const swap = deg === 90 || deg === 270
  const targetW = swap ? source.height : source.width
  const targetH = swap ? source.width : source.height

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('rotateImage: failed to obtain 2d context')

  // Rotate around the canvas center, then draw the source centered.
  ctx.save()
  ctx.translate(targetW / 2, targetH / 2)
  ctx.rotate((deg * Math.PI) / 180)
  ctx.drawImage(source, -source.width / 2, -source.height / 2)
  ctx.restore()

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('rotateImage: toBlob returned null'))),
      'image/png',
    )
  })

  // Spin up a fresh ImageBitmap from the rotated canvas — `bitmap` is
  // what the warp worker consumes, so we want a clean drawable that
  // doesn't share GPU state with `canvas` (which we're about to GC).
  const bitmap = await createImageBitmap(canvas)
  return { bitmap, blob }
}

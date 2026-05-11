/**
 * Subresource Integrity (SRI) constants for the MODNet ONNX model.
 *
 * The value is filled in by `pnpm models:fetch` — see scripts/fetch-model.mjs
 * for how the digest is computed. While the model is not yet present on this
 * machine the constant is intentionally empty; runtime code is expected to
 * either skip the check (dev with `?skip-integrity=1`) or fail closed.
 *
 * Update procedure:
 *   1. Run `pnpm models:fetch` (or `pnpm models:fetch --from-file ./local.onnx`)
 *   2. Copy the printed `sha384-...` value here.
 *   3. Commit; the value is part of the security boundary.
 */

export const MODEL_SHA384 = '' as const

export const MODEL_FILENAME = 'modnet.q.onnx'

export class IntegrityError extends Error {
  override name = 'IntegrityError'
}

/**
 * Verify a downloaded ArrayBuffer against MODEL_SHA384.
 *
 * Returns the buffer untouched on success; throws IntegrityError on mismatch.
 * When MODEL_SHA384 is empty (initial bootstrap) and `allowEmpty` is true,
 * the check is skipped and a one-line warning is logged.
 */
export async function verifyModel(
  buf: ArrayBuffer,
  options: { allowEmpty?: boolean } = {},
): Promise<ArrayBuffer> {
  if (!MODEL_SHA384) {
    if (options.allowEmpty) {
      console.warn(
        '[segmentation] MODEL_SHA384 is empty — skipping integrity check. ' +
          'Run `pnpm models:fetch` and commit the printed digest before shipping.',
      )
      return buf
    }
    throw new IntegrityError(
      'MODEL_SHA384 is empty; cannot verify model. See src/features/segmentation/integrity.ts.',
    )
  }

  const digest = await crypto.subtle.digest('SHA-384', buf)
  const actual = `sha384-${toBase64(digest)}`
  if (actual !== MODEL_SHA384) {
    throw new IntegrityError(
      `Model integrity check failed: expected ${MODEL_SHA384}, got ${actual}.`,
    )
  }
  return buf
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  // btoa is available in Workers / browsers / Node 18+.
  return btoa(binary)
}

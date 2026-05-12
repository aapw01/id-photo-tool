/**
 * Subresource Integrity (SRI) constants for the MODNet ONNX model.
 *
 * The single source of truth is the per-variant `sha384` entries in
 * runtime-config.ts. This module re-exports the currently active hash
 * (`MODEL_SHA384`) so callers can keep importing from one place and the
 * verify helper does not need to know which variant is in use.
 *
 * Update procedure:
 *   1. `pnpm models:fetch --variant <id>` (or `--from-file <path>`)
 *   2. Copy the printed `sha384-...` value into MODEL_VARIANTS[<id>].sha384
 *      in runtime-config.ts.
 *   3. Commit; the value is part of the security boundary.
 */

import { MODEL_SHA384 as ACTIVE_MODEL_SHA384, MODEL_VARIANT } from './runtime-config'

export const MODEL_SHA384 = ACTIVE_MODEL_SHA384
export const MODEL_FILENAME = MODEL_VARIANT.path

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
      // No active integrity hash — only happens during the bootstrap of
      // a new variant. Loud-but-non-fatal so the missing hash gets
      // noticed in dev tools before it ships.
      console.warn(
        '[segmentation] MODEL_SHA384 is empty — skipping integrity check. ' +
          'Run `pnpm models:fetch --variant <id>` and commit the printed digest before shipping.',
      )
      return buf
    }
    throw new IntegrityError(
      'MODEL_SHA384 is empty; cannot verify model. See src/features/segmentation/runtime-config.ts.',
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

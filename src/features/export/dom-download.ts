/**
 * DOM helpers for triggering file downloads.
 *
 * Centralised because every download surface in the app — single
 * export, layout sheets, spec import/export — used to inline a copy
 * of the same `createObjectURL → <a>.click() → revoke` dance. The
 * tricky bit is the *deferred* revoke: Safari can race the revoke
 * against the browser's download fetch if we drop the URL on the
 * same tick `click()` returns. We wait 30s before cleanup, which is
 * plenty for any browser to have started streaming the file.
 */

const REVOKE_DELAY_MS = 30_000

/**
 * Trigger a browser download for `blob` as `filename`.
 *
 * The returned promise resolves once the click has been dispatched
 * (i.e. the next microtask). The object URL is revoked 30 s later;
 * during that window the caller's blob is still referenced, so this
 * helper is safe to call back-to-back without lifecycle juggling.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Safari races the synchronous revoke against the download stream,
  // delivering a 0-byte file. Defer well past any browser's download
  // bootstrap window.
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}

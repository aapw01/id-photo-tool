/**
 * MODNet ONNX model loader.
 *
 * Cache-API-first download with byte-accurate progress reporting and
 * automatic integrity verification. Designed to run inside the
 * segmentation Web Worker, where `caches` and `fetch` are both available
 * (Dedicated Worker scope on https / localhost).
 *
 * Behavior:
 *   1. Lookup `caches.open(CACHE_NAME)` — hit returns instantly.
 *   2. Miss: `fetch(MODEL_URL)`, stream the response while reporting
 *      `loaded / total` bytes via the progress callback.
 *   3. Verify SHA-384 against the constant in integrity.ts.
 *   4. On success, write a fresh `Response` into the cache for next time.
 *   5. Retry up to MAX_ATTEMPTS times with exponential backoff on network
 *      errors. Integrity failures fail fast (no retry).
 */

import { IntegrityError, MODEL_SHA384, verifyModel } from './integrity'
import { MODEL_URL } from './runtime-config'
import type { ProgressPhase } from './worker-protocol'

export const CACHE_NAME = 'pixfit-models-v1'
const MAX_ATTEMPTS = 3

/**
 * Lightweight env injection so tests can stub fetch + caches without
 * touching globals. In the worker we just pass nothing and the loader
 * uses the realm's built-ins.
 */
export interface LoaderEnv {
  fetch?: typeof fetch
  /** Pass `null` to explicitly opt out of the Cache API (useful in tests). */
  caches?: CacheStorage | null
}

export interface LoadModelOptions extends LoaderEnv {
  url?: string
  expectedSha384?: string
  signal?: AbortSignal
  onProgress?: (phase: ProgressPhase, loaded?: number, total?: number) => void
  /** Skip integrity check when MODEL_SHA384 is empty (bootstrap only). */
  allowEmptyIntegrity?: boolean
}

export class ModelNetworkError extends Error {
  override name = 'ModelNetworkError'
}

/**
 * Resolve the MODNet ONNX model into an ArrayBuffer, with Cache API
 * persistence and SHA-384 integrity verification.
 */
export async function loadModel(opts: LoadModelOptions = {}): Promise<ArrayBuffer> {
  const fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis)
  const cachesImpl: CacheStorage | null =
    opts.caches !== undefined
      ? opts.caches
      : typeof globalThis !== 'undefined' && 'caches' in globalThis
        ? ((globalThis as { caches?: CacheStorage }).caches ?? null)
        : null
  const url = opts.url ?? MODEL_URL
  const expected = opts.expectedSha384 ?? MODEL_SHA384

  const cached = await tryReadCache(cachesImpl, url, opts.onProgress)
  if (cached) {
    return verifyOrThrow(cached, expected, opts.allowEmptyIntegrity)
  }

  let lastErr: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const buf = await fetchWithProgress(fetchImpl, url, opts.signal, opts.onProgress)
      const verified = await verifyOrThrow(buf, expected, opts.allowEmptyIntegrity)
      // Best-effort cache write. Failures here are not fatal — we still
      // return the verified buffer; next visit just won't have a hit.
      void tryWriteCache(cachesImpl, url, verified).catch(() => {})
      return verified
    } catch (err) {
      lastErr = err
      // Integrity failures are not transient; bail immediately so callers
      // can surface a clear error class.
      if (err instanceof IntegrityError) throw err
      if (attempt < MAX_ATTEMPTS) {
        const wait = 250 * 2 ** (attempt - 1) // 250ms, 500ms
        await sleep(wait, opts.signal)
      }
    }
  }
  throw new ModelNetworkError(
    `Failed to load model after ${MAX_ATTEMPTS} attempts: ${errMessage(lastErr)}`,
  )
}

async function tryReadCache(
  caches: CacheStorage | null,
  url: string,
  onProgress?: LoadModelOptions['onProgress'],
): Promise<ArrayBuffer | null> {
  if (!caches) return null
  try {
    const cache = await caches.open(CACHE_NAME)
    const hit = await cache.match(url)
    if (!hit) return null
    const buf = await hit.arrayBuffer()
    onProgress?.('download', buf.byteLength, buf.byteLength)
    return buf
  } catch {
    // Cache API unavailable (e.g. private mode), fall through to network.
    return null
  }
}

async function tryWriteCache(
  caches: CacheStorage | null,
  url: string,
  buf: ArrayBuffer,
): Promise<void> {
  if (!caches) return
  const cache = await caches.open(CACHE_NAME)
  // Cache.put requires a Response; clone the buffer so the caller-owned
  // one isn't transferred or detached.
  const body = buf.slice(0)
  await cache.put(
    url,
    new Response(body, { headers: { 'content-type': 'application/octet-stream' } }),
  )
}

async function fetchWithProgress(
  doFetch: typeof fetch,
  url: string,
  signal: AbortSignal | undefined,
  onProgress?: LoadModelOptions['onProgress'],
): Promise<ArrayBuffer> {
  let res: Response
  try {
    res = await doFetch(url, { signal })
  } catch (err) {
    throw new ModelNetworkError(`Model fetch failed: ${errMessage(err)}`)
  }
  if (!res.ok) {
    throw new ModelNetworkError(`Model fetch failed: HTTP ${res.status}`)
  }

  const total = Number(res.headers.get('content-length')) || undefined
  // If the body isn't streamable (e.g. polyfills), fall back to plain
  // arrayBuffer() — we lose progress granularity but still report
  // start/complete.
  if (!res.body) {
    onProgress?.('download', 0, total)
    const buf = await res.arrayBuffer()
    onProgress?.('download', buf.byteLength, buf.byteLength)
    return buf
  }

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  onProgress?.('download', 0, total)
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.byteLength
    onProgress?.('download', loaded, total)
  }
  const out = new Uint8Array(loaded)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return out.buffer
}

async function verifyOrThrow(
  buf: ArrayBuffer,
  expected: string,
  allowEmpty?: boolean,
): Promise<ArrayBuffer> {
  // Reuse the integrity helper but inject the expected hash so test
  // doubles can supply their own digest.
  if (!expected) {
    if (allowEmpty) return buf
    throw new IntegrityError('No expected SHA-384 supplied; refusing to load model.')
  }
  if (expected !== MODEL_SHA384) {
    // Custom expected (tests) — compute & compare inline.
    const digest = await crypto.subtle.digest('SHA-384', buf)
    const actual = `sha384-${arrayBufferToBase64(digest)}`
    if (actual !== expected) {
      throw new IntegrityError(`Integrity mismatch: expected ${expected}, got ${actual}.`)
    }
    return buf
  }
  // Production path: defer to verifyModel which knows MODEL_SHA384.
  return verifyModel(buf, { allowEmpty })
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(signal.reason)
    })
  })
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

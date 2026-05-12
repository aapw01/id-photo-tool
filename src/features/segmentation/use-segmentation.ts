'use client'

/**
 * React hook over `SegmentationClient`. Maintains the SegmentationState
 * machine documented in TECH_DESIGN §5.2.2 and survives React 19
 * strict-mode double-invocation by keeping a shared module-scope client.
 *
 * State transitions:
 *
 *   idle ── warmup() ──▶ loading-model ──▶ ready ──▶ inferring ──▶ ready
 *     │                                                  │
 *     │                                                  └─▶ error ──▶ ready
 *     └──────────────── error ─────────────────────────────────────┘
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  createDefaultWorker,
  createSegmentationClient,
  type ClientError,
  type ClientProgress,
  type SegmentationClient,
  type SegmentResult,
} from './segmentation-client'
import type { Backend } from './worker-protocol'

export type SegmentationState = 'idle' | 'loading-model' | 'ready' | 'inferring' | 'error'

export interface UseSegmentationOptions {
  /**
   * Replace the default Worker factory. Used by tests and by the
   * perf-benchmark dev page to pass a customised Worker.
   */
  workerFactory?: () => Worker
}

export interface UseSegmentation {
  state: SegmentationState
  progress: ClientProgress | null
  error: ClientError | null
  backend: Backend | null
  warmup: () => Promise<void>
  segment: (
    bitmap: ImageBitmap,
    opts?: { signal?: AbortSignal; withForeground?: boolean; foregroundMaxLongSide?: number },
  ) => Promise<SegmentResult>
}

// Module-scope singleton so a hook mounted twice (strict mode) does not
// spin up two workers. Cleared when every consumer unmounts.
let sharedClient: SegmentationClient | null = null
let refCount = 0

function acquire(workerFactory?: () => Worker): SegmentationClient {
  if (!sharedClient) {
    sharedClient = createSegmentationClient(workerFactory ?? createDefaultWorker)
  }
  refCount += 1
  return sharedClient
}

function release() {
  refCount = Math.max(0, refCount - 1)
  if (refCount === 0 && sharedClient) {
    sharedClient.dispose()
    sharedClient = null
  }
}

/** Test-only: tear down the singleton between tests. */
export function __resetSegmentationSingleton(): void {
  if (sharedClient) sharedClient.dispose()
  sharedClient = null
  refCount = 0
}

export function useSegmentation(options: UseSegmentationOptions = {}): UseSegmentation {
  const [state, setState] = useState<SegmentationState>('idle')
  const [progress, setProgress] = useState<ClientProgress | null>(null)
  const [error, setError] = useState<ClientError | null>(null)
  const [backend, setBackend] = useState<Backend | null>(null)

  // Hold a stable ref to the client so callbacks don't capture stale ones.
  const clientRef = useRef<SegmentationClient | null>(null)
  // Track whether init has been requested in this client instance; we
  // never want to send a second `init` because the worker already
  // serializes that internally, but the hook's state machine should
  // reflect the in-flight load anyway.
  const initRef = useRef<Promise<{ backend: Backend }> | null>(null)

  useEffect(() => {
    clientRef.current = acquire(options.workerFactory)
    return () => {
      clientRef.current = null
      initRef.current = null
      release()
    }
    // workerFactory swap only matters between mount/unmount cycles —
    // intentionally not in deps; the hook owner promises a stable
    // factory or accepts re-mount semantics.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const warmup = useCallback(async () => {
    const client = clientRef.current
    if (!client) return
    if (initRef.current) {
      await initRef.current
      return
    }
    setState('loading-model')
    setError(null)
    initRef.current = client.init({
      onProgress: (p) => setProgress(p),
    })
    try {
      const result = await initRef.current
      setBackend(result.backend)
      setProgress(null)
      setState('ready')
    } catch (err) {
      initRef.current = null
      setError(err as ClientError)
      setState('error')
    }
  }, [])

  const segment = useCallback<UseSegmentation['segment']>(
    async (bitmap, opts) => {
      const client = clientRef.current
      if (!client) throw new Error('useSegmentation: not mounted')
      // Make sure the model is loaded before posting a segment request.
      if (!initRef.current) {
        await warmup()
      } else {
        await initRef.current
      }
      setState('inferring')
      setError(null)
      try {
        const result = await client.segment(bitmap, {
          onProgress: (p) => setProgress(p),
          signal: opts?.signal,
          withForeground: opts?.withForeground,
          foregroundMaxLongSide: opts?.foregroundMaxLongSide,
        })
        setProgress(null)
        setState('ready')
        return result
      } catch (err) {
        setError(err as ClientError)
        setState('error')
        throw err
      }
    },
    [warmup],
  )

  return { state, progress, error, backend, warmup, segment }
}

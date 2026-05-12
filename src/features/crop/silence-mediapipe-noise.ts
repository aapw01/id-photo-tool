/**
 * Silence MediaPipe wasm boot noise.
 *
 * `@mediapipe/tasks-vision` ships a wasm bundle that writes a handful
 * of `INFO` / `W` lines through `console.log` / `console.error` the
 * first time a detector boots — `OpenGL error checking is disabled`,
 * `Created TensorFlow Lite XNNPACK delegate for CPU`, etc. They are
 * not errors and detection still succeeds, but Next.js dev forwards
 * any `console.error` from the browser to the dev terminal with a
 * source-mapped stack trace attached, which makes them look like
 * the call site (`detector.detect(...)`) crashed.
 *
 * MediaPipe has no public log-level knob in this release, so the
 * least-bad fix is a targeted console filter: drop messages that
 * match a small set of known wasm log strings, pass everything else
 * through untouched. The filter installs lazily on first call and is
 * idempotent — safe to invoke from both the loader and the detector.
 */
'use client'

const NOISE_PATTERNS: RegExp[] = [
  /OpenGL error checking is disabled/i,
  /Created TensorFlow Lite XNNPACK delegate for CPU/i,
  /Feedback manager requires a model with a single signature inference/i,
  /@mediapipe\/tasks-vision@[^/]+\/wasm\/vision_wasm_internal\.js/i,
]

type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

let installed = false

export function isMediaPipeBootNoise(text: string): boolean {
  if (!text) return false
  return NOISE_PATTERNS.some((re) => re.test(text))
}

export function silenceMediaPipeBootNoise(): void {
  if (installed) return
  if (typeof globalThis === 'undefined' || typeof globalThis.console === 'undefined') return
  installed = true

  const levels: ConsoleLevel[] = ['log', 'info', 'warn', 'error', 'debug']
  for (const level of levels) {
    const original = globalThis.console[level] as (...args: unknown[]) => void
    if (typeof original !== 'function') continue
    globalThis.console[level] = ((...args: unknown[]) => {
      const joined = args
        .map((a) => (typeof a === 'string' ? a : ''))
        .filter(Boolean)
        .join(' ')
      if (isMediaPipeBootNoise(joined)) return
      original.apply(globalThis.console, args)
    }) as typeof globalThis.console.log
  }
}

/** Test-only seam: re-arm the installer between tests. */
export function __resetMediaPipeSilencerForTesting(): void {
  installed = false
}

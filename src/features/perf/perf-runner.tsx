'use client'

/**
 * Segmentation perf runner.
 *
 * Pure dev tooling. Lets the operator pick a local image, then runs
 * N inference passes through the same SegmentationClient the
 * production studio uses, recording wall-clock timings via
 * `performance.now()`.
 *
 * Reports:
 *   - Backend (webgpu / wasm)
 *   - Init time (model fetch + InferenceSession.create)
 *   - First pass time (cold-ish inference; ort warms internal caches)
 *   - Mean / P50 / P95 / min / max across iterations 2..N
 *
 * Provides a "Copy JSON" button so the result lands in PLAN.md in one
 * paste.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  createDefaultWorker,
  createSegmentationClient,
  type SegmentationClient,
} from '@/features/segmentation/segmentation-client'

interface RunReport {
  backend: 'webgpu' | 'wasm'
  forcedBackend: 'webgpu' | 'wasm' | null
  imageSize: { w: number; h: number }
  initMs: number
  passes: number[]
  iterations: number
  summary: {
    firstPassMs: number
    meanMs: number
    p50Ms: number
    p95Ms: number
    minMs: number
    maxMs: number
  }
  userAgent: string
  timestamp: string
}

const DEFAULT_ITERATIONS = 5

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx] ?? 0
}

function summarize(passes: number[]) {
  const sorted = [...passes].sort((a, b) => a - b)
  const sum = sorted.reduce((a, b) => a + b, 0)
  return {
    firstPassMs: round(passes[0] ?? 0),
    meanMs: round(sum / Math.max(1, sorted.length)),
    p50Ms: round(percentile(sorted, 50)),
    p95Ms: round(percentile(sorted, 95)),
    minMs: round(sorted[0] ?? 0),
    maxMs: round(sorted[sorted.length - 1] ?? 0),
  }
}

function round(ms: number): number {
  return Math.round(ms * 10) / 10
}

export function PerfRunner() {
  const [file, setFile] = useState<File | null>(null)
  const [iterations, setIterations] = useState(DEFAULT_ITERATIONS)
  const [forceWasm, setForceWasm] = useState(false)
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState<RunReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])

  const clientRef = useRef<SegmentationClient | null>(null)

  useEffect(() => {
    // Tear down and rebuild whenever the wasm-only switch flips so the
    // worker gets a fresh init call with the right `forceBackend`.
    if (clientRef.current) clientRef.current.dispose()
    clientRef.current = createSegmentationClient(createDefaultWorker)
    return () => {
      clientRef.current?.dispose()
      clientRef.current = null
    }
  }, [forceWasm])

  const append = useCallback((line: string) => {
    setLog((prev) => [...prev, line])
  }, [])

  const run = useCallback(async () => {
    const client = clientRef.current
    if (!client || !file) return
    setRunning(true)
    setReport(null)
    setError(null)
    setLog([])

    try {
      append('Initializing worker + loading model…')
      const t0 = performance.now()
      const { backend } = await client.init({
        forceBackend: forceWasm ? 'wasm' : undefined,
        onProgress: (p) => {
          if (p.phase === 'download' && p.loaded && p.total) {
            append(`download ${Math.round((p.loaded / p.total) * 100)}%`)
          } else {
            append(`phase: ${p.phase}`)
          }
        },
      })
      const initMs = performance.now() - t0
      append(`✓ init ${round(initMs)} ms · backend=${backend}`)

      const passes: number[] = []
      let imageSize = { w: 0, h: 0 }
      for (let i = 0; i < iterations; i++) {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
        imageSize = { w: bitmap.width, h: bitmap.height }
        const t = performance.now()
        await client.segment(bitmap)
        const dt = performance.now() - t
        passes.push(dt)
        append(`run ${i + 1} → ${round(dt)} ms`)
      }

      const summary = summarize(passes)
      const result: RunReport = {
        backend,
        imageSize,
        initMs: round(initMs),
        passes: passes.map(round),
        iterations,
        summary,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        forcedBackend: forceWasm ? 'wasm' : null,
      }
      setReport(result)
    } catch (err) {
      setError((err as { reason?: string }).reason ?? String(err))
    } finally {
      setRunning(false)
    }
  }, [append, file, iterations, forceWasm])

  const copyJson = useCallback(() => {
    if (!report) return
    void navigator.clipboard.writeText(JSON.stringify(report, null, 2))
  }, [report])

  const useSyntheticPhoto = useCallback(async () => {
    // 512×768 portrait-ish synthetic image — flat background + a soft
    // ellipse + a vertical band to give MODNet something to bite on.
    // Lets the benchmark page run without forcing the operator to find
    // a real portrait file.
    const w = 512
    const h = 768
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, '#0f172a')
    bg.addColorStop(1, '#334155')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#fef3c7'
    ctx.beginPath()
    ctx.ellipse(w / 2, h * 0.32, 110, 140, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(w / 2 - 130, h * 0.55, 260, h)
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png'),
    )
    if (!blob) return
    const f = new File([blob], 'synthetic.png', { type: 'image/png' })
    setFile(f)
  }, [])

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <label className="block text-sm font-medium text-[var(--color-text)]">
          Photo
          <input
            data-testid="perf-file"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm text-[var(--color-text-mute)] file:mr-3 file:rounded-[var(--radius-md)] file:border-0 file:bg-[var(--color-primary)] file:px-3 file:py-1.5 file:text-white"
          />
        </label>
        <button
          onClick={useSyntheticPhoto}
          className="inline-flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-xs"
          data-testid="perf-synthetic"
        >
          Use a 512×768 synthetic photo
        </button>
        <label className="block text-sm font-medium text-[var(--color-text)]">
          Iterations
          <input
            type="number"
            min={1}
            max={50}
            value={iterations}
            onChange={(e) => setIterations(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            className="mt-2 block w-24 rounded-[var(--radius-md)] border border-[var(--color-border)] px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
          <input
            type="checkbox"
            checked={forceWasm}
            onChange={(e) => setForceWasm(e.target.checked)}
            data-testid="perf-force-wasm"
          />
          Force WASM backend (skip WebGPU)
        </label>
        <button
          onClick={run}
          disabled={!file || running}
          data-testid="perf-run"
          className="inline-flex h-9 items-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {running ? 'Running…' : 'Run benchmark'}
        </button>
      </div>

      {log.length > 0 ? (
        <pre className="max-h-64 overflow-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-mono text-xs leading-snug text-[var(--color-text-mute)]">
          {log.join('\n')}
        </pre>
      ) : null}

      {error ? (
        <div className="rounded-[var(--radius-lg)] border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {report ? (
        <div
          data-testid="perf-report"
          className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Backend">{report.backend}</Stat>
            <Stat label="Image">
              {report.imageSize.w} × {report.imageSize.h}
            </Stat>
            <Stat label="Init">{report.initMs} ms</Stat>
            <Stat label="First pass">{report.summary.firstPassMs} ms</Stat>
            <Stat label="Mean">{report.summary.meanMs} ms</Stat>
            <Stat label="P50">{report.summary.p50Ms} ms</Stat>
            <Stat label="P95">{report.summary.p95Ms} ms</Stat>
            <Stat label="Min">{report.summary.minMs} ms</Stat>
            <Stat label="Max">{report.summary.maxMs} ms</Stat>
          </div>
          <button
            onClick={copyJson}
            className="inline-flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-xs"
          >
            Copy JSON
          </button>
          <pre
            data-testid="perf-json"
            className="max-h-64 overflow-auto rounded-[var(--radius-md)] bg-[var(--color-bg)] p-3 font-mono text-[11px]"
          >
            {JSON.stringify(report, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-wider text-[var(--color-text-weak)] uppercase">
        {label}
      </p>
      <p className="mt-0.5 font-semibold text-[var(--color-text)]">{children}</p>
    </div>
  )
}

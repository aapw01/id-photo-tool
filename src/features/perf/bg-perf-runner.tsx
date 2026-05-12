'use client'

/**
 * Background-swap micro-benchmark.
 *
 * Independent of MODNet — we synthesise a 512×768 portrait-shaped
 * bitmap plus a centre-rectangle mask, cache the foreground once via
 * `extractForeground`, then call `compositeOnto` N times with a
 * rotating colour list. Each iteration measures the time from
 * `performance.now()` *before* the call to *after* the next animation
 * frame (so we capture the paint, not just the JS work).
 *
 * Goal (TECH_DESIGN §5.3.3): P50 < 30 ms, P95 < 50 ms.
 */

import { useCallback, useMemo, useRef, useState } from 'react'

import { compositeOnto, extractForeground, type BgColor } from '@/features/background/composite'

const TEST_COLORS: readonly BgColor[] = [
  { kind: 'color', hex: '#FFFFFF' },
  { kind: 'color', hex: '#438EDB' },
  { kind: 'color', hex: '#D9342B' },
  { kind: 'color', hex: '#F5F5F5' },
  { kind: 'color', hex: '#0F172A' },
  { kind: 'color', hex: '#FACC15' },
  { kind: 'color', hex: '#10B981' },
  { kind: 'transparent' },
]

interface Stats {
  count: number
  meanMs: number
  p50Ms: number
  p95Ms: number
  minMs: number
  maxMs: number
}

interface Report {
  width: number
  height: number
  iterations: number
  setupMs: number
  stats: Stats
  samples: number[] // ms per iteration
  userAgent: string
}

export function BgPerfRunner() {
  const [iterations, setIterations] = useState(60)
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState<Report | null>(null)
  const [log, setLog] = useState<string[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const pushLog = useCallback((line: string) => {
    setLog((prev) => [...prev, line].slice(-20))
  }, [])

  const run = useCallback(async () => {
    setRunning(true)
    setReport(null)
    setLog([])
    try {
      const W = 512
      const H = 768
      pushLog(`→ synthesise ${W}×${H} test photo`)
      const setupStart = performance.now()

      const photoCanvas = document.createElement('canvas')
      photoCanvas.width = W
      photoCanvas.height = H
      const pctx = photoCanvas.getContext('2d')!
      // Sky-ish gradient backdrop
      const grad = pctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, '#6cb6ff')
      grad.addColorStop(1, '#1f4d8a')
      pctx.fillStyle = grad
      pctx.fillRect(0, 0, W, H)
      // Subject — vaguely portrait-shaped rectangle + head circle
      pctx.fillStyle = '#f6d3b3'
      pctx.beginPath()
      pctx.arc(W / 2, H * 0.35, W * 0.18, 0, Math.PI * 2)
      pctx.fill()
      pctx.fillStyle = '#0e7c66'
      pctx.fillRect(W * 0.25, H * 0.5, W * 0.5, H * 0.5)
      const bitmap = await createImageBitmap(photoCanvas)

      // Mask: full-alpha inside subject area, zero outside.
      const maskCanvas = document.createElement('canvas')
      maskCanvas.width = W
      maskCanvas.height = H
      const mctx = maskCanvas.getContext('2d')!
      mctx.clearRect(0, 0, W, H)
      mctx.fillStyle = '#ffffff'
      mctx.beginPath()
      mctx.arc(W / 2, H * 0.35, W * 0.2, 0, Math.PI * 2)
      mctx.fill()
      mctx.fillRect(W * 0.23, H * 0.5, W * 0.54, H * 0.5)
      const mask = mctx.getImageData(0, 0, W, H)

      pushLog('→ extractForeground (one-time cost)')
      const foreground = await extractForeground(bitmap, mask)
      const setupMs = performance.now() - setupStart
      pushLog(`  setup ${setupMs.toFixed(1)} ms`)

      const target = canvasRef.current
      if (!target) throw new Error('preview canvas missing')
      target.width = W
      target.height = H
      const ctx = target.getContext('2d')!

      pushLog(`→ swap ${iterations}×; cycling ${TEST_COLORS.length} colours`)
      const samples: number[] = []
      for (let i = 0; i < iterations; i++) {
        const color = TEST_COLORS[i % TEST_COLORS.length]!
        const t0 = performance.now()
        compositeOnto(ctx, foreground, W, H, color)
        // Force layout/paint flush so we count the *visible* swap, not
        // just the JS time.
        await new Promise<void>((r) => requestAnimationFrame(() => r()))
        const t1 = performance.now()
        samples.push(t1 - t0)
      }

      foreground.close?.()
      bitmap.close?.()

      const stats = summarise(samples)
      pushLog(
        `← P50 ${stats.p50Ms.toFixed(1)} / P95 ${stats.p95Ms.toFixed(1)} / mean ${stats.meanMs.toFixed(1)} ms`,
      )
      setReport({
        width: W,
        height: H,
        iterations,
        setupMs: Math.round(setupMs * 100) / 100,
        stats,
        samples: samples.map((s) => Math.round(s * 100) / 100),
        userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
      })
    } catch (err) {
      pushLog(`✗ ${(err as Error).message}`)
    } finally {
      setRunning(false)
    }
  }, [iterations, pushLog])

  const json = useMemo(() => (report ? JSON.stringify(report, null, 2) : ''), [report])

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="space-y-1 text-sm">
            <span className="text-[var(--color-text-mute)]">Iterations</span>
            <input
              type="number"
              min={10}
              max={500}
              step={10}
              value={iterations}
              onChange={(e) => setIterations(Math.max(10, parseInt(e.target.value || '60', 10)))}
              className="block w-24 rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1 font-mono text-sm"
            />
          </label>
          <button
            type="button"
            disabled={running}
            onClick={() => void run()}
            className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50"
          >
            {running ? 'Running…' : 'Run swap benchmark'}
          </button>
        </div>

        <div className="mt-4">
          <p className="text-xs text-[var(--color-text-mute)]">Preview (last swap)</p>
          <canvas
            ref={canvasRef}
            className="mt-1 block max-h-72 w-auto rounded border border-[var(--color-divider)]"
          />
        </div>
      </div>

      <pre className="max-h-48 overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-divider)] p-3 font-mono text-xs whitespace-pre-wrap">
        {log.join('\n') || '(no output yet)'}
      </pre>

      {report ? (
        <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <Stat label="Setup" value={`${report.setupMs.toFixed(1)} ms`} />
            <Stat label="Iterations" value={report.iterations} />
            <Stat label="Image" value={`${report.width}×${report.height}`} />
            <Stat label="Mean" value={`${report.stats.meanMs.toFixed(1)} ms`} />
            <Stat label="P50" value={`${report.stats.p50Ms.toFixed(1)} ms`} />
            <Stat label="P95" value={`${report.stats.p95Ms.toFixed(1)} ms`} />
            <Stat label="Min" value={`${report.stats.minMs.toFixed(1)} ms`} />
            <Stat label="Max" value={`${report.stats.maxMs.toFixed(1)} ms`} />
          </dl>
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--color-text-mute)]">{report.userAgent}</p>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(json)}
              className="rounded-md border border-[var(--color-border)] px-3 py-1 text-xs"
            >
              Copy JSON
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-[var(--color-text-mute)]">{label}</dt>
      <dd className="font-mono text-sm text-[var(--color-text)]">{value}</dd>
    </div>
  )
}

function summarise(samples: number[]): Stats {
  if (samples.length === 0) {
    return { count: 0, meanMs: 0, p50Ms: 0, p95Ms: 0, minMs: 0, maxMs: 0 }
  }
  const sorted = [...samples].sort((a, b) => a - b)
  const sum = sorted.reduce((a, b) => a + b, 0)
  const pct = (p: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]!
  return {
    count: sorted.length,
    meanMs: sum / sorted.length,
    p50Ms: pct(0.5),
    p95Ms: pct(0.95),
    minMs: sorted[0]!,
    maxMs: sorted[sorted.length - 1]!,
  }
}

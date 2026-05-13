'use client'

/**
 * Compliance banner — shows the warnings produced by
 * `checkCompliance` in a non-modal yellow/amber strip above the
 * preview. Refer to the crop store for the current warnings list
 * and the head / eye ratio numbers that go into the localised
 * message.
 *
 * If face detection is running we show a neutral "detecting" hint
 * instead. If detection failed outright we surface that error.
 */

import { AlertTriangle, Info } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslations } from 'next-intl'

import { useCropStore } from './spec-store'
import { checkCompliance, type ComplianceCode } from './compliance'

const PCT = (v: number | null | undefined) => (v == null ? '–' : Math.round(v * 100).toString())

export function ComplianceBanner() {
  const t = useTranslations('Crop')
  const tw = useTranslations('Crop.warnings')
  const td = useTranslations('Crop.detect')

  const spec = useCropStore((s) => s.spec)
  const frame = useCropStore((s) => s.frame)
  const face = useCropStore((s) => s.face)
  const faceError = useCropStore((s) => s.faceError)
  const warnings = useCropStore((s) => s.warnings)

  // Recompute compliance numbers fresh for the banner — the store
  // only keeps the warning *codes*, not the ratios. Cheap because
  // the inputs are tiny.
  const compliance = useMemo(() => {
    if (!spec || !frame) return null
    return checkCompliance(frame, face, spec)
  }, [spec, frame, face])

  // Note: the "detecting" branch was deliberately removed.
  // autoCenter already gives the user a centred-crop fallback frame
  // immediately, so a perpetual spinner banner adds noise without
  // adding value — especially when the MediaPipe CDN is unreachable.
  // Detection results (or the absence thereof) are still surfaced via
  // the faceError / no-face branches below.

  if (faceError) {
    return (
      <Banner tone="warn" icon={<AlertTriangle className="size-4" aria-hidden />}>
        {td('failed')}
      </Banner>
    )
  }

  if (!spec || !frame) return null

  if (warnings.length === 0) {
    if (!face) {
      // No face detected (CDN down, photo without a person, ...) — we
      // already auto-centred the crop, so this banner just confirms
      // that fact and tells the user they can drag to fine-tune.
      return (
        <Banner tone="info" icon={<Info className="size-4" aria-hidden />}>
          {td('autoCentered')}
        </Banner>
      )
    }
    return null
  }

  const headBand = spec.composition?.headHeightRatio
  const eyeBand = spec.composition?.eyeLineFromTop
  const headRatio = compliance?.headRatio
  const eyeFromTop = compliance?.eyeFromTop

  const buildMessage = (code: ComplianceCode): string => {
    switch (code) {
      case 'head-too-small':
      case 'head-too-large':
        return tw(code, {
          ratio: PCT(headRatio),
          lo: headBand ? PCT(headBand[0]) : '–',
          hi: headBand ? PCT(headBand[1]) : '–',
        })
      case 'eye-too-high':
      case 'eye-too-low':
        return tw(code, {
          ratio: PCT(eyeFromTop),
          lo: eyeBand ? PCT(eyeBand[0]) : '–',
          hi: eyeBand ? PCT(eyeBand[1]) : '–',
        })
      case 'face-not-found':
        return tw('face-not-found')
    }
  }

  const visible = warnings.slice(0, 2)
  const moreCount = warnings.length - visible.length

  return (
    <Banner tone="warn" icon={<AlertTriangle className="size-4 shrink-0" aria-hidden />}>
      <div className="flex flex-col gap-0.5">
        <p className="text-xs font-medium">{t('warnings.title')}</p>
        <ul className="list-disc space-y-0.5 pl-4 text-xs">
          {visible.map((w) => (
            <li key={w.code}>{buildMessage(w.code)}</li>
          ))}
          {moreCount > 0 ? <li>{tw('moreCount', { count: moreCount })}</li> : null}
        </ul>
      </div>
    </Banner>
  )
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: 'info' | 'warn'
  icon: React.ReactNode
  children: React.ReactNode
}) {
  const bg = tone === 'warn' ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900'
  return (
    <div
      role={tone === 'warn' ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-md border border-[var(--color-border)] px-3 py-2 ${bg}`}
    >
      <span className="mt-0.5">{icon}</span>
      <div className="flex-1 text-xs">{children}</div>
    </div>
  )
}

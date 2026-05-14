'use client'

/**
 * Right-rail config panel:
 *   - Document type picker (drives `getOutputPixels` for the warp).
 *   - Output mode selector (Scan / Copy / Enhance — operates on the
 *     already-rectified result so it's millisecond-cheap to toggle).
 *
 * Watermark + paper layout controls land in S5; this panel is the
 * surface they'll attach to.
 */

import { useTranslations } from 'next-intl'
import { FilePenLine } from 'lucide-react'

import { DOC_SPECS } from '../lib/doc-specs'
import type { OutputMode } from '../lib/render-modes'
import { useScannerStore } from '../store'

const MODES: readonly OutputMode[] = ['scan', 'copy', 'enhance'] as const

export function ScannerConfig() {
  const t = useTranslations('Scanner.config')
  const tDoc = useTranslations('Scanner.docSpecs')
  const tMode = useTranslations('Scanner.mode')
  const docSpecId = useScannerStore((s) => s.docSpecId)
  const outputMode = useScannerStore((s) => s.outputMode)
  const setDocSpecId = useScannerStore((s) => s.setDocSpecId)
  const setOutputMode = useScannerStore((s) => s.setOutputMode)

  return (
    <div className="flex flex-col gap-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center gap-2">
        <FilePenLine
          aria-hidden="true"
          className="size-4 text-[var(--color-text-mute)] opacity-70"
        />
        <h3 className="text-sm font-semibold text-[var(--color-text)]">
          {/* The shell-level h3 lives outside — we keep this header
              compact since the column header is already rendered by
              the surrounding shell. */}
          <span className="sr-only">{t('docSpecLabel')}</span>
        </h3>
      </div>

      {/* Document type */}
      <div className="space-y-2">
        <label
          htmlFor="scanner-doc-spec"
          className="text-xs font-medium text-[var(--color-text-mute)]"
        >
          {t('docSpecLabel')}
        </label>
        <select
          id="scanner-doc-spec"
          value={docSpecId}
          onChange={(e) => setDocSpecId(e.target.value)}
          className="block w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2 text-sm text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          {DOC_SPECS.map((spec) => (
            <option key={spec.id} value={spec.id}>
              {tDoc(spec.id as Parameters<typeof tDoc>[0])}
            </option>
          ))}
        </select>
      </div>

      {/* Output mode */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--color-text-mute)]">
          {t('modeLabel')}
        </label>
        <div
          role="radiogroup"
          aria-label={t('modeLabel')}
          className="flex overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]"
        >
          {MODES.map((mode) => {
            const active = outputMode === mode
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setOutputMode(mode)}
                className={`flex-1 border-[var(--color-border)] px-2 py-2 text-xs transition-colors first:border-r last:border-l ${
                  active
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-text)] hover:bg-[var(--color-divider)]'
                }`}
              >
                <span className="block font-medium">
                  {tMode(mode as Parameters<typeof tMode>[0])}
                </span>
                <span
                  className={`mt-0.5 block text-[10px] ${active ? 'opacity-90' : 'opacity-60'}`}
                >
                  {tMode(`${mode}Desc` as Parameters<typeof tMode>[0])}
                </span>
              </button>
            )
          })}
        </div>
        <p className="text-[10px] text-[var(--color-text-mute)]">{t('modeHint')}</p>
      </div>
    </div>
  )
}

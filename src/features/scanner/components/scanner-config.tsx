'use client'

/**
 * Right-rail config panel.
 *
 * S4 contributed: doc-type picker + output mode (scan/copy/enhance).
 * S5 adds: optional watermark controls (toggle + text + opacity +
 *          density) and the export CTAs (A4 PDF, A4 PNG).
 *
 * Watermark is off by default. When the user turns it on, the
 * opacity slider still clamps at 30–70 % via the kernel so the
 * watermark stays visible enough to deter casual misuse — but the
 * whole feature can be disabled in one click.
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Download, FileDown, FilePenLine, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { groupDocSpecs } from '../lib/doc-specs'
import type { PaperSize } from '../lib/pack-a4'
import type { OutputMode } from '../lib/render-modes'
import {
  MAX_WATERMARK_OPACITY,
  MIN_WATERMARK_OPACITY,
  type WatermarkDensity,
} from '../lib/watermark'
import { MAX_CORNER_RADIUS_PX, useScannerStore } from '../store'
import { ScannerPreviewDialog } from './scanner-preview-dialog'

const MODES: readonly OutputMode[] = ['scan', 'copy', 'enhance'] as const
const DENSITIES: readonly WatermarkDensity[] = ['sparse', 'normal', 'dense'] as const
const PAPER_SIZES: readonly PaperSize[] = ['a4', 'letter', 'a5'] as const

export function ScannerConfig() {
  const t = useTranslations('Scanner.config')

  return (
    <div className="flex flex-col gap-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center gap-2">
        <FilePenLine
          aria-hidden="true"
          className="size-4 text-[var(--color-text-mute)] opacity-70"
        />
        <h3 className="text-sm font-semibold text-[var(--color-text)]">
          <span className="sr-only">{t('docSpecLabel')}</span>
        </h3>
      </div>

      <DocSpecPicker />
      <OutputModePicker />
      <CornerRadiusConfig />
      <WatermarkConfig />
      <ExportRow />
    </div>
  )
}

function DocSpecPicker() {
  const t = useTranslations('Scanner.config')
  const tDoc = useTranslations('Scanner.docSpecs')
  const tGroup = useTranslations('Scanner.docSpecGroups')
  const docSpecId = useScannerStore((s) => s.docSpecId)
  const setDocSpecId = useScannerStore((s) => s.setDocSpecId)
  const groups = groupDocSpecs()

  return (
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
        {groups.map(({ group, specs }) => (
          <optgroup key={group} label={tGroup(group as Parameters<typeof tGroup>[0])}>
            {specs.map((spec) => (
              <option key={spec.id} value={spec.id}>
                {tDoc(spec.id as Parameters<typeof tDoc>[0])}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}

function OutputModePicker() {
  const t = useTranslations('Scanner.config')
  const tMode = useTranslations('Scanner.mode')
  const outputMode = useScannerStore((s) => s.outputMode)
  const setOutputMode = useScannerStore((s) => s.setOutputMode)

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-[var(--color-text-mute)]">{t('modeLabel')}</label>
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
                className={`mt-0.5 block truncate text-[10px] whitespace-nowrap ${
                  active ? 'opacity-90' : 'opacity-60'
                }`}
              >
                {tMode(`${mode}Desc` as Parameters<typeof tMode>[0])}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CornerRadiusConfig() {
  const t = useTranslations('Scanner.cornerRadius')
  const cornerRadiusPx = useScannerStore((s) => s.cornerRadiusPx)
  const setCornerRadiusPx = useScannerStore((s) => s.setCornerRadiusPx)

  return (
    <div className="space-y-2 border-t border-[var(--color-border)] pt-4">
      <label
        htmlFor="scanner-corner-radius"
        className="flex justify-between text-xs font-medium text-[var(--color-text-mute)]"
      >
        <span>{t('label')}</span>
        <span aria-live="polite">
          {cornerRadiusPx === 0 ? t('off') : t('value', { px: cornerRadiusPx })}
        </span>
      </label>
      <input
        id="scanner-corner-radius"
        type="range"
        min={0}
        max={MAX_CORNER_RADIUS_PX}
        step={1}
        value={cornerRadiusPx}
        onChange={(e) => setCornerRadiusPx(Number(e.target.value))}
        className="block w-full accent-[var(--color-primary)]"
      />
      <p className="text-[10px] leading-snug text-[var(--color-text-mute)]">{t('hint')}</p>
    </div>
  )
}

function WatermarkConfig() {
  const t = useTranslations('Scanner.watermark')
  const watermark = useScannerStore((s) => s.watermark)
  const setWatermarkEnabled = useScannerStore((s) => s.setWatermarkEnabled)
  const setWatermarkText = useScannerStore((s) => s.setWatermarkText)
  const setWatermarkOpacity = useScannerStore((s) => s.setWatermarkOpacity)
  const setWatermarkDensity = useScannerStore((s) => s.setWatermarkDensity)

  const enabled = watermark.enabled
  const fieldsDisabled = !enabled

  return (
    <div className="space-y-3 border-t border-[var(--color-border)] pt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-[var(--color-text)]">{t('label')}</span>
          <p className="mt-1 text-[10px] leading-snug text-[var(--color-text-mute)]">
            {t('toggleHint')}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={t('toggleLabel')}
          onClick={() => setWatermarkEnabled(!enabled)}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] ${
            enabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-divider)]'
          }`}
        >
          <span
            aria-hidden="true"
            className={`inline-block size-4 transform rounded-full bg-white shadow-[var(--shadow-sm)] transition-transform ${
              enabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      <fieldset
        disabled={fieldsDisabled}
        aria-disabled={fieldsDisabled || undefined}
        className={`space-y-3 ${fieldsDisabled ? 'opacity-50' : ''}`}
      >
        <div className="space-y-1.5">
          <label
            htmlFor="scanner-watermark-text"
            className="text-[11px] font-medium text-[var(--color-text-mute)]"
          >
            {t('textLabel')}
          </label>
          <input
            id="scanner-watermark-text"
            type="text"
            value={watermark.text}
            placeholder={t('textPlaceholder')}
            onChange={(e) => setWatermarkText(e.target.value)}
            className="block w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-mute)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:cursor-not-allowed"
            maxLength={48}
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="scanner-watermark-opacity"
            className="flex justify-between text-[11px] font-medium text-[var(--color-text-mute)]"
          >
            <span>{t('opacityLabel')}</span>
            <span>{Math.round(watermark.opacity * 100)}%</span>
          </label>
          <input
            id="scanner-watermark-opacity"
            type="range"
            min={MIN_WATERMARK_OPACITY * 100}
            max={MAX_WATERMARK_OPACITY * 100}
            step={1}
            value={Math.round(watermark.opacity * 100)}
            onChange={(e) => setWatermarkOpacity(Number(e.target.value) / 100)}
            className="block w-full accent-[var(--color-primary)] disabled:cursor-not-allowed"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-[var(--color-text-mute)]">
            {t('densityLabel')}
          </label>
          <div
            role="radiogroup"
            aria-label={t('densityLabel')}
            className="flex overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]"
          >
            {DENSITIES.map((density) => {
              const active = watermark.density === density
              return (
                <button
                  key={density}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={fieldsDisabled}
                  onClick={() => setWatermarkDensity(density)}
                  className={`flex-1 border-[var(--color-border)] px-1.5 py-1 text-[11px] transition-colors first:border-r last:border-l ${
                    active
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'text-[var(--color-text)] hover:bg-[var(--color-divider)]'
                  } disabled:cursor-not-allowed`}
                >
                  {t(`density.${density}` as Parameters<typeof t>[0])}
                </button>
              )
            })}
          </div>
        </div>
      </fieldset>
    </div>
  )
}

function ExportRow() {
  const t = useTranslations('Scanner.export')
  const tPaper = useTranslations('Scanner.paperSizes')
  const front = useScannerStore((s) => s.front)
  const back = useScannerStore((s) => s.back)
  const hasBack = useScannerStore((s) => s.hasBack)
  const paperSize = useScannerStore((s) => s.paperSize)
  const setPaperSize = useScannerStore((s) => s.setPaperSize)
  const exportPdfBlob = useScannerStore((s) => s.exportPdfBlob)
  const exportA4PngBlob = useScannerStore((s) => s.exportA4PngBlob)
  const [busy, setBusy] = useState<'pdf' | 'png' | null>(null)

  const frontReady = front?.rectified !== null && front?.rectified !== undefined
  const backReady = back?.rectified !== null && back?.rectified !== undefined
  const canExport = frontReady || (hasBack && backReady)

  const trigger = async (kind: 'pdf' | 'png') => {
    setBusy(kind)
    try {
      const blob = kind === 'pdf' ? await exportPdfBlob() : await exportA4PngBlob()
      if (!blob) {
        toast.error(t('noContent'))
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pixfit-scan.${kind === 'pdf' ? 'pdf' : 'png'}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      // Slight delay before revoke so the browser has time to start
      // the download in flaky environments.
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success(t(kind === 'pdf' ? 'successPdf' : 'successPng'))
    } catch (err) {
      toast.error(t('errorGeneric', { message: err instanceof Error ? err.message : '' }))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3 border-t border-[var(--color-border)] pt-4">
      <span className="text-xs font-medium text-[var(--color-text)]">{t('title')}</span>
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-[var(--color-text-mute)]">
          {tPaper('label')}
        </label>
        <div
          role="radiogroup"
          aria-label={tPaper('label')}
          className="flex overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]"
        >
          {PAPER_SIZES.map((size) => {
            const active = paperSize === size
            return (
              <button
                key={size}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setPaperSize(size)}
                className={`flex-1 border-[var(--color-border)] px-1.5 py-1 text-[11px] transition-colors first:border-r last:border-l ${
                  active
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-text)] hover:bg-[var(--color-divider)]'
                }`}
              >
                {tPaper(size as Parameters<typeof tPaper>[0])}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={!canExport || busy !== null}
          onClick={() => trigger('pdf')}
          className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white shadow-[var(--shadow-sm)] hover:bg-[var(--color-primary-dk)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === 'pdf' ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileDown className="size-4" aria-hidden="true" />
          )}
          {busy === 'pdf' ? t('preparing') : t('pdf')}
        </button>
        <button
          type="button"
          disabled={!canExport || busy !== null}
          onClick={() => trigger('png')}
          className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-divider)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === 'png' ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="size-4" aria-hidden="true" />
          )}
          {busy === 'png' ? t('preparing') : t('png')}
        </button>
        <ScannerPreviewDialog canPreview={canExport} />
      </div>
      {!canExport && <p className="text-[10px] text-[var(--color-text-mute)]">{t('noContent')}</p>}
    </div>
  )
}

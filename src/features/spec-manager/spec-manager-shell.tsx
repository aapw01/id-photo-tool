'use client'

/**
 * Client-side shell for `/specs`.
 *
 * Top-level layout:
 *
 *   - Tabs (Photo / Paper / Layout).
 *   - Toolbar with Import / Export buttons. Layout tab also disables
 *     "New" because the editor hasn't shipped yet (M6).
 *   - Two-column body: list on the left, detail / form on the right.
 *
 * State machine inside the right pane:
 *
 *   - `idle`         — empty hint until the user picks something.
 *   - `viewing(spec)`— show a read-only card; built-ins land here.
 *   - `editing(spec)`— show the form (create or edit).
 *
 * All persistence + CRUD funnels through `useSpecManagerStore`. The
 * store exposes `CrudResult` so we surface validation errors as both
 * a toast and an `aria-invalid` ring on the offending field.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Copy, Download, FilePlus, Pencil, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RegionFlag } from '@/components/region-flag'
import { triggerDownload } from '@/features/export'
import { localizeText } from '@/lib/i18n-text'
import { derivePixels } from '@/lib/spec-units'
import { cn } from '@/lib/utils'
import type { LayoutTemplate, PaperSpec, PhotoSpec } from '@/types/spec'

import { findDependents } from './dependency-check'
import { exportToJSON, parseSpecsJson, exportFilename } from './import-export'
import { PaperSpecForm } from './paper-spec-form'
import { PhotoSpecForm } from './photo-spec-form'
import {
  BUILTIN_PAPER_SPECS,
  BUILTIN_PHOTO_SPECS,
  useEffectiveLayoutTemplates,
  useEffectivePaperSpecs,
  useEffectivePhotoSpecs,
  useSpecManagerStore,
} from './store'
import { zodIssuesToPaths } from './invalid-fields'

type Tab = 'photo' | 'paper' | 'layout'
type EditorState =
  | { mode: 'idle' }
  | { mode: 'view'; id: string }
  | { mode: 'create' }
  | { mode: 'edit'; id: string }

export function SpecManagerShell() {
  const t = useTranslations('SpecManager')

  const rehydrate = useSpecManagerStore((s) => s.rehydrate)
  const hydrated = useSpecManagerStore((s) => s.hydrated)
  const customPhoto = useSpecManagerStore((s) => s.customPhotoSpecs)
  const customPaper = useSpecManagerStore((s) => s.customPaperSpecs)
  const customLayout = useSpecManagerStore((s) => s.customLayoutTemplates)
  const replaceAll = useSpecManagerStore((s) => s.replaceAll)

  // React 19 hydration-safe pattern (see studio-preview.tsx): no
  // direct setState in useEffect; cancel-on-unmount via `await null`
  // microtask flush.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      await null
      if (cancelled) return
      if (!hydrated) rehydrate()
    })()
    return () => {
      cancelled = true
    }
  }, [hydrated, rehydrate])

  const [tab, setTab] = useState<Tab>('photo')
  const [editor, setEditor] = useState<EditorState>({ mode: 'idle' })
  const [invalidPaths, setInvalidPaths] = useState<string[]>([])
  const [pendingDelete, setPendingDelete] = useState<
    | null
    | { kind: 'photo'; id: string; name: string }
    | { kind: 'paper'; id: string; name: string }
    | { kind: 'layout'; id: string; name: string }
  >(null)

  const effectivePhoto = useEffectivePhotoSpecs()
  const effectivePaper = useEffectivePaperSpecs()
  const effectiveLayout = useEffectiveLayoutTemplates()

  const photoCount = customPhoto.length
  const paperCount = customPaper.length
  const layoutCount = customLayout.length
  const totalCustom = photoCount + paperCount + layoutCount

  const onTab = useCallback((next: Tab) => {
    setTab(next)
    setEditor({ mode: 'idle' })
    setInvalidPaths([])
  }, [])

  const onExport = useCallback(() => {
    const blob = exportToJSON({
      version: 1,
      photoSpecs: customPhoto,
      paperSpecs: customPaper,
      layoutTemplates: customLayout,
    })
    triggerDownload(blob, exportFilename())
    toast.success(t('toast.exported', { count: totalCustom }))
  }, [customPhoto, customPaper, customLayout, totalCustom, t])

  return (
    <div className="space-y-4">
      <Toolbar
        tab={tab}
        onTab={onTab}
        onNew={() => {
          if (tab === 'layout') return
          setEditor({ mode: 'create' })
          setInvalidPaths([])
        }}
        canCreate={tab !== 'layout'}
        onExport={onExport}
        onImportSuccess={(payload) => {
          replaceAll(payload)
          toast.success(
            t('toast.imported', {
              photo: payload.photoSpecs.length,
              paper: payload.paperSpecs.length,
              layout: payload.layoutTemplates.length,
            }),
          )
        }}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {tab === 'photo' ? (
          <PhotoColumn
            list={effectivePhoto}
            customIds={new Set(customPhoto.map((p) => p.id))}
            activeId={editor.mode === 'view' || editor.mode === 'edit' ? editor.id : null}
            onSelect={(id) => setEditor({ mode: 'view', id })}
            onEdit={(id) => setEditor({ mode: 'edit', id })}
            onDuplicate={(id) => duplicatePhoto(id, effectivePhoto, customPhoto, setEditor, t)}
            onDelete={(spec) =>
              setPendingDelete({
                kind: 'photo',
                id: spec.id,
                name: spec.name.en || spec.id,
              })
            }
          />
        ) : null}
        {tab === 'paper' ? (
          <PaperColumn
            list={effectivePaper}
            customIds={new Set(customPaper.map((p) => p.id))}
            activeId={editor.mode === 'view' || editor.mode === 'edit' ? editor.id : null}
            onSelect={(id) => setEditor({ mode: 'view', id })}
            onEdit={(id) => setEditor({ mode: 'edit', id })}
            onDuplicate={(id) => duplicatePaper(id, effectivePaper, customPaper, setEditor, t)}
            onDelete={(spec) =>
              setPendingDelete({
                kind: 'paper',
                id: spec.id,
                name: spec.name.en || spec.id,
              })
            }
          />
        ) : null}
        {tab === 'layout' ? <LayoutColumn list={effectiveLayout} /> : null}

        <DetailPane
          tab={tab}
          editor={editor}
          invalidPaths={invalidPaths}
          effectivePhoto={effectivePhoto}
          effectivePaper={effectivePaper}
          onCancel={() => {
            setEditor({ mode: 'idle' })
            setInvalidPaths([])
          }}
          onSubmitPhoto={(next) => savePhoto(next, editor, setEditor, setInvalidPaths, t)}
          onSubmitPaper={(next) => savePaper(next, editor, setEditor, setInvalidPaths, t)}
        />
      </div>

      <DeleteDialog
        pending={pendingDelete}
        templates={effectiveLayout}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return
          const tn = pendingDelete.name
          const id = pendingDelete.id
          if (pendingDelete.kind === 'photo') {
            const out = useSpecManagerStore.getState().deletePhoto(id)
            if (out.ok) toast.success(t('toast.deleted', { name: tn }))
            else toast.error(t('toast.deleteFailed', { message: out.message }))
          } else if (pendingDelete.kind === 'paper') {
            const out = useSpecManagerStore.getState().deletePaper(id)
            if (out.ok) toast.success(t('toast.deleted', { name: tn }))
            else toast.error(t('toast.deleteFailed', { message: out.message }))
          } else {
            const out = useSpecManagerStore.getState().deleteLayout(id)
            if (out.ok) toast.success(t('toast.deleted', { name: tn }))
            else toast.error(t('toast.deleteFailed', { message: out.message }))
          }
          setPendingDelete(null)
          setEditor({ mode: 'idle' })
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Toolbar                                                              */
/* ------------------------------------------------------------------ */

interface ToolbarProps {
  tab: Tab
  onTab: (next: Tab) => void
  onNew: () => void
  canCreate: boolean
  onExport: () => void
  onImportSuccess: (
    payload: ReturnType<typeof parseSpecsJson> extends infer R
      ? R extends { ok: true; value: infer V }
        ? V
        : never
      : never,
  ) => void
}

function Toolbar({ tab, onTab, onNew, canCreate, onExport, onImportSuccess }: ToolbarProps) {
  const t = useTranslations('SpecManager')
  const tToast = useTranslations('SpecManager.toast')
  const tErr = useTranslations('SpecManager.import.errors')
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      try {
        const text = await file.text()
        const out = parseSpecsJson(text)
        if (!out.ok) {
          const msg = (() => {
            switch (out.code) {
              case 'empty-input':
                return tErr('empty-input')
              case 'invalid-json':
                return tErr('invalid-json', { message: out.message })
              case 'invalid-schema':
                return tErr('invalid-schema', { issues: out.issues?.length ?? 0 })
              case 'unsupported-version':
                return tErr('unsupported-version')
            }
          })()
          toast.error(tToast('importFailed', { message: msg }))
          return
        }
        onImportSuccess(out.value)
      } catch (err) {
        toast.error(tToast('importFailed', { message: String(err) }))
      }
    },
    [tToast, tErr, onImportSuccess],
  )

  const tabs: readonly { id: Tab; label: string }[] = [
    { id: 'photo', label: t('tabs.photo') },
    { id: 'paper', label: t('tabs.paper') },
    { id: 'layout', label: t('tabs.layout') },
  ] as const

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <nav role="tablist" aria-label={t('title')} className="flex gap-1">
        {tabs.map((entry) => {
          const isActive = entry.id === tab
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTab(entry.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                isActive
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-[var(--color-text-mute)] hover:bg-[var(--color-divider)] hover:text-[var(--color-text)]',
              )}
            >
              {entry.label}
            </button>
          )
        })}
      </nav>

      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={onFile}
          className="hidden"
        />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" aria-hidden />
          {t('toolbar.import')}
        </Button>
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="size-4" aria-hidden />
          {t('toolbar.export')}
        </Button>
        <Button size="sm" onClick={onNew} disabled={!canCreate}>
          <FilePlus className="size-4" aria-hidden />
          {t('toolbar.new')}
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* List columns                                                         */
/* ------------------------------------------------------------------ */

interface PhotoColumnProps {
  list: readonly PhotoSpec[]
  customIds: Set<string>
  activeId: string | null
  onSelect: (id: string) => void
  onEdit: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (spec: PhotoSpec) => void
}

function PhotoColumn({
  list,
  customIds,
  activeId,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
}: PhotoColumnProps) {
  const t = useTranslations('SpecManager')
  const locale = useLocale()
  const grouped = useMemo(() => groupByBuiltin(list, customIds), [list, customIds])
  return (
    <section
      aria-label={t('tabs.photo')}
      className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
    >
      <ListSection title={t('list.custom')}>
        {grouped.custom.length === 0 ? (
          <p className="px-2 py-3 text-xs text-[var(--color-text-weak)]">{t('list.empty')}</p>
        ) : (
          grouped.custom.map((spec) => (
            <PhotoRow
              key={spec.id}
              spec={spec}
              builtin={false}
              active={activeId === spec.id}
              onSelect={() => onSelect(spec.id)}
              onEdit={() => onEdit(spec.id)}
              onDelete={() => onDelete(spec)}
              locale={locale}
            />
          ))
        )}
      </ListSection>
      <ListSection title={t('list.builtin')} subtitle={t('list.builtinHint')}>
        {grouped.builtin.map((spec) => (
          <PhotoRow
            key={spec.id}
            spec={spec}
            builtin
            active={activeId === spec.id}
            onSelect={() => onSelect(spec.id)}
            onDuplicate={() => onDuplicate(spec.id)}
            locale={locale}
          />
        ))}
      </ListSection>
    </section>
  )
}

interface PaperColumnProps {
  list: readonly PaperSpec[]
  customIds: Set<string>
  activeId: string | null
  onSelect: (id: string) => void
  onEdit: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (spec: PaperSpec) => void
}

function PaperColumn({
  list,
  customIds,
  activeId,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
}: PaperColumnProps) {
  const t = useTranslations('SpecManager')
  const locale = useLocale()
  const grouped = useMemo(() => groupByBuiltin(list, customIds), [list, customIds])

  return (
    <section
      aria-label={t('tabs.paper')}
      className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
    >
      <ListSection title={t('list.custom')}>
        {grouped.custom.length === 0 ? (
          <p className="px-2 py-3 text-xs text-[var(--color-text-weak)]">{t('list.empty')}</p>
        ) : (
          grouped.custom.map((spec) => (
            <PaperRow
              key={spec.id}
              spec={spec}
              builtin={false}
              active={activeId === spec.id}
              onSelect={() => onSelect(spec.id)}
              onEdit={() => onEdit(spec.id)}
              onDelete={() => onDelete(spec)}
              locale={locale}
            />
          ))
        )}
      </ListSection>
      <ListSection title={t('list.builtin')} subtitle={t('list.builtinHint')}>
        {grouped.builtin.map((spec) => (
          <PaperRow
            key={spec.id}
            spec={spec}
            builtin
            active={activeId === spec.id}
            onSelect={() => onSelect(spec.id)}
            onDuplicate={() => onDuplicate(spec.id)}
            locale={locale}
          />
        ))}
      </ListSection>
    </section>
  )
}

interface LayoutColumnProps {
  list: readonly LayoutTemplate[]
}

function LayoutColumn({ list }: LayoutColumnProps) {
  const t = useTranslations('SpecManager')
  const locale = useLocale()
  return (
    <section
      aria-label={t('tabs.layout')}
      className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
    >
      <p className="rounded-md border border-dashed border-[var(--color-border)] p-3 text-xs text-[var(--color-text-mute)]">
        {t('layout.comingSoon')}
      </p>
      {list.length === 0 ? (
        <p className="px-2 py-3 text-xs text-[var(--color-text-weak)]">{t('list.empty')}</p>
      ) : (
        <ul className="space-y-1">
          {list.map((tpl) => (
            <li key={tpl.id} className="rounded-md border border-[var(--color-border)] px-3 py-2">
              <p className="text-sm font-medium text-[var(--color-text)]">
                {localizeText(tpl.name, locale)}
              </p>
              <p className="font-mono text-xs text-[var(--color-text-mute)]">
                {tpl.id} · {tpl.paperId}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ListSection({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <p className="px-2 pt-1 text-xs font-medium tracking-wide text-[var(--color-text-mute)] uppercase">
        {title}
      </p>
      {subtitle ? (
        <p className="px-2 pb-1 text-xs text-[var(--color-text-weak)]">{subtitle}</p>
      ) : null}
      <ul className="space-y-1">{children}</ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Rows                                                                 */
/* ------------------------------------------------------------------ */

interface PhotoRowProps {
  spec: PhotoSpec
  builtin: boolean
  active: boolean
  onSelect: () => void
  onEdit?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
  locale: string
}

function PhotoRow({
  spec,
  builtin,
  active,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  locale,
}: PhotoRowProps) {
  const t = useTranslations('SpecManager')
  const resolved = derivePixels(spec)
  return (
    <li
      className={cn(
        'flex items-center gap-2 rounded-md border px-2 py-2 transition-colors',
        active
          ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
          : 'border-[var(--color-border)] bg-transparent hover:bg-[var(--color-divider)]',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        {spec.region ? (
          <RegionFlag countryCode={spec.region} label={spec.region} squared className="size-5" />
        ) : (
          <span className="inline-block size-5 rounded-sm bg-[var(--color-divider)]" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-[var(--color-text)]">
            {localizeText(spec.name, locale)}
          </p>
          <p className="font-mono text-xs text-[var(--color-text-mute)]">
            {spec.width_mm}×{spec.height_mm} mm · {resolved.width_px}×{resolved.height_px} px
          </p>
        </div>
        {active ? <Check className="size-4 text-[var(--color-primary)]" aria-hidden /> : null}
      </button>
      <div className="flex items-center gap-1">
        {builtin ? (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t('toolbar.duplicate')}
            title={t('toolbar.duplicate')}
            onClick={onDuplicate}
          >
            <Copy className="size-4" aria-hidden />
          </Button>
        ) : (
          <>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t('list.edit')}
              title={t('list.edit')}
              onClick={onEdit}
            >
              <Pencil className="size-4" aria-hidden />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t('list.delete')}
              title={t('list.delete')}
              onClick={onDelete}
            >
              <Trash2 className="size-4 text-[var(--color-danger,#dc2626)]" aria-hidden />
            </Button>
          </>
        )}
      </div>
    </li>
  )
}

interface PaperRowProps {
  spec: PaperSpec
  builtin: boolean
  active: boolean
  onSelect: () => void
  onEdit?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
  locale: string
}

function PaperRow({
  spec,
  builtin,
  active,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  locale,
}: PaperRowProps) {
  const t = useTranslations('SpecManager')
  const resolved = derivePixels(spec)
  return (
    <li
      className={cn(
        'flex items-center gap-2 rounded-md border px-2 py-2 transition-colors',
        active
          ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
          : 'border-[var(--color-border)] bg-transparent hover:bg-[var(--color-divider)]',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className="inline-block size-5 rounded-sm bg-[var(--color-divider)]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-[var(--color-text)]">
            {localizeText(spec.name, locale)}
          </p>
          <p className="font-mono text-xs text-[var(--color-text-mute)]">
            {spec.width_mm}×{spec.height_mm} mm · {resolved.width_px}×{resolved.height_px} px
          </p>
        </div>
        {active ? <Check className="size-4 text-[var(--color-primary)]" aria-hidden /> : null}
      </button>
      <div className="flex items-center gap-1">
        {builtin ? (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t('toolbar.duplicate')}
            title={t('toolbar.duplicate')}
            onClick={onDuplicate}
          >
            <Copy className="size-4" aria-hidden />
          </Button>
        ) : (
          <>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t('list.edit')}
              title={t('list.edit')}
              onClick={onEdit}
            >
              <Pencil className="size-4" aria-hidden />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t('list.delete')}
              title={t('list.delete')}
              onClick={onDelete}
            >
              <Trash2 className="size-4 text-[var(--color-danger,#dc2626)]" aria-hidden />
            </Button>
          </>
        )}
      </div>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* Detail pane                                                          */
/* ------------------------------------------------------------------ */

interface DetailPaneProps {
  tab: Tab
  editor: EditorState
  invalidPaths: string[]
  effectivePhoto: readonly PhotoSpec[]
  effectivePaper: readonly PaperSpec[]
  onCancel: () => void
  onSubmitPhoto: (next: PhotoSpec) => void
  onSubmitPaper: (next: PaperSpec) => void
}

function DetailPane({
  tab,
  editor,
  invalidPaths,
  effectivePhoto,
  effectivePaper,
  onCancel,
  onSubmitPhoto,
  onSubmitPaper,
}: DetailPaneProps) {
  const t = useTranslations('SpecManager')
  const locale = useLocale()

  if (editor.mode === 'idle') {
    return (
      <section className="flex min-h-[260px] flex-col items-center justify-center gap-1 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center">
        <p className="text-sm text-[var(--color-text)]">{t('empty.title')}</p>
        <p className="text-xs text-[var(--color-text-mute)]">{t('empty.subtitle')}</p>
      </section>
    )
  }

  if (tab === 'layout') {
    return (
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <p className="text-sm text-[var(--color-text-mute)]">{t('layout.comingSoon')}</p>
      </section>
    )
  }

  if (tab === 'photo') {
    if (editor.mode === 'create') {
      return (
        <PhotoSpecForm
          mode="create"
          onCancel={onCancel}
          onSubmit={onSubmitPhoto}
          invalidPaths={invalidPaths}
        />
      )
    }
    const id = editor.mode === 'view' || editor.mode === 'edit' ? editor.id : null
    const target = id ? (effectivePhoto.find((s) => s.id === id) ?? null) : null
    if (!target) return null
    if (editor.mode === 'edit' && !target.builtin) {
      return (
        <PhotoSpecForm
          mode="edit"
          initial={target}
          onCancel={onCancel}
          onSubmit={onSubmitPhoto}
          invalidPaths={invalidPaths}
        />
      )
    }
    return <PhotoCard spec={target} locale={locale} />
  }

  if (editor.mode === 'create') {
    return (
      <PaperSpecForm
        mode="create"
        onCancel={onCancel}
        onSubmit={onSubmitPaper}
        invalidPaths={invalidPaths}
      />
    )
  }
  const id = editor.mode === 'view' || editor.mode === 'edit' ? editor.id : null
  const target = id ? (effectivePaper.find((s) => s.id === id) ?? null) : null
  if (!target) return null
  if (editor.mode === 'edit' && !target.builtin) {
    return (
      <PaperSpecForm
        mode="edit"
        initial={target}
        onCancel={onCancel}
        onSubmit={onSubmitPaper}
        invalidPaths={invalidPaths}
      />
    )
  }
  return <PaperCard spec={target} locale={locale} />
}

function PhotoCard({ spec, locale }: { spec: PhotoSpec; locale: string }) {
  const resolved = derivePixels(spec)
  return (
    <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <header>
        <p className="font-mono text-xs text-[var(--color-text-weak)]">{spec.id}</p>
        <h3 className="text-lg font-medium text-[var(--color-text)]">
          {localizeText(spec.name, locale)}
        </h3>
      </header>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Stat label="mm" value={`${spec.width_mm} × ${spec.height_mm}`} />
        <Stat label="px" value={`${resolved.width_px} × ${resolved.height_px}`} />
        <Stat label="DPI" value={String(spec.dpi)} />
        {spec.region ? <Stat label="Region" value={spec.region} /> : null}
        {spec.background?.recommended ? (
          <Stat label="Bg" value={spec.background.recommended.toUpperCase()} />
        ) : null}
      </dl>
    </section>
  )
}

function PaperCard({ spec, locale }: { spec: PaperSpec; locale: string }) {
  const resolved = derivePixels(spec)
  return (
    <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <header>
        <p className="font-mono text-xs text-[var(--color-text-weak)]">{spec.id}</p>
        <h3 className="text-lg font-medium text-[var(--color-text)]">
          {localizeText(spec.name, locale)}
        </h3>
      </header>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Stat label="mm" value={`${spec.width_mm} × ${spec.height_mm}`} />
        <Stat label="px" value={`${resolved.width_px} × ${resolved.height_px}`} />
        <Stat label="DPI" value={String(spec.dpi)} />
        {spec.alias ? <Stat label="Alias" value={spec.alias} /> : null}
      </dl>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--color-text-mute)]">{label}</dt>
      <dd className="font-mono text-sm text-[var(--color-text)]">{value}</dd>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Delete confirmation                                                  */
/* ------------------------------------------------------------------ */

interface DeleteDialogProps {
  pending:
    | null
    | { kind: 'photo'; id: string; name: string }
    | { kind: 'paper'; id: string; name: string }
    | { kind: 'layout'; id: string; name: string }
  templates: readonly LayoutTemplate[]
  onCancel: () => void
  onConfirm: () => void
}

function DeleteDialog({ pending, templates, onCancel, onConfirm }: DeleteDialogProps) {
  const t = useTranslations('SpecManager')
  const locale = useLocale()

  const dependents = useMemo(() => {
    if (!pending) return []
    if (pending.kind === 'layout') return []
    return findDependents({ kind: pending.kind, id: pending.id }, templates)
  }, [pending, templates])

  return (
    <Dialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <DialogContent>
        {pending ? (
          <>
            <DialogHeader>
              <DialogTitle>{t('delete.title', { name: pending.name })}</DialogTitle>
              <DialogDescription>
                {dependents.length > 0
                  ? t('delete.withDependentsBody', { count: dependents.length })
                  : t('delete.body')}
              </DialogDescription>
            </DialogHeader>
            {dependents.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium tracking-wide text-[var(--color-text-mute)] uppercase">
                  {t('delete.dependentsHeading')}
                </p>
                <ul className="space-y-1 rounded-md border border-[var(--color-border)] p-2 text-sm">
                  {dependents.map((tpl) => (
                    <li key={tpl.id} className="flex items-center justify-between gap-2">
                      <span className="truncate text-[var(--color-text)]">
                        {localizeText(tpl.name, locale)}
                      </span>
                      <span className="font-mono text-xs text-[var(--color-text-weak)]">
                        {tpl.id}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="ghost" onClick={onCancel}>
                {t('delete.cancel')}
              </Button>
              <Button variant="destructive" onClick={onConfirm}>
                {t('delete.confirm')}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function groupByBuiltin<T extends { id: string; builtin: boolean }>(
  list: readonly T[],
  customIds: Set<string>,
): { custom: T[]; builtin: T[] } {
  const custom: T[] = []
  const builtin: T[] = []
  for (const entry of list) {
    if (customIds.has(entry.id)) custom.push(entry)
    else if (entry.builtin) builtin.push(entry)
    else custom.push(entry)
  }
  return { custom, builtin }
}

function nextCopyId(base: string, existingIds: Set<string>): string {
  let i = 1
  let candidate = `${base}-copy`
  while (existingIds.has(candidate)) {
    i += 1
    candidate = `${base}-copy-${i}`
  }
  return candidate
}

function duplicatePhoto(
  id: string,
  effective: readonly PhotoSpec[],
  customs: readonly PhotoSpec[],
  setEditor: (s: EditorState) => void,
  t: ReturnType<typeof useTranslations<'SpecManager'>>,
): void {
  const src = effective.find((s) => s.id === id) ?? BUILTIN_PHOTO_SPECS.find((s) => s.id === id)
  if (!src) return
  const allIds = new Set(effective.map((s) => s.id))
  const copyId = nextCopyId(src.id, allIds)
  const copy: PhotoSpec = {
    ...src,
    id: copyId,
    builtin: false,
    name: {
      zh: `${src.name.zh}（副本）`,
      'zh-Hant': `${src.name['zh-Hant']}（副本）`,
      en: `${src.name.en} (copy)`,
    },
  }
  const out = useSpecManagerStore.getState().createPhoto(copy)
  if (out.ok) {
    toast.success(t('toast.duplicated', { name: copy.name.en }))
    setEditor({ mode: 'edit', id: copyId })
  } else {
    toast.error(t('toast.saveFailed', { message: out.message }))
  }
  void customs
}

function duplicatePaper(
  id: string,
  effective: readonly PaperSpec[],
  customs: readonly PaperSpec[],
  setEditor: (s: EditorState) => void,
  t: ReturnType<typeof useTranslations<'SpecManager'>>,
): void {
  const src = effective.find((s) => s.id === id) ?? BUILTIN_PAPER_SPECS.find((s) => s.id === id)
  if (!src) return
  const allIds = new Set(effective.map((s) => s.id))
  const copyId = nextCopyId(src.id, allIds)
  const copy: PaperSpec = {
    ...src,
    id: copyId,
    builtin: false,
    name: {
      zh: `${src.name.zh}（副本）`,
      'zh-Hant': `${src.name['zh-Hant']}（副本）`,
      en: `${src.name.en} (copy)`,
    },
  }
  const out = useSpecManagerStore.getState().createPaper(copy)
  if (out.ok) {
    toast.success(t('toast.duplicated', { name: copy.name.en }))
    setEditor({ mode: 'edit', id: copyId })
  } else {
    toast.error(t('toast.saveFailed', { message: out.message }))
  }
  void customs
}

function savePhoto(
  next: PhotoSpec,
  editor: EditorState,
  setEditor: (s: EditorState) => void,
  setInvalidPaths: (p: string[]) => void,
  t: ReturnType<typeof useTranslations<'SpecManager'>>,
): void {
  const store = useSpecManagerStore.getState()
  const result =
    editor.mode === 'edit' ? store.updatePhoto(editor.id, next) : store.createPhoto(next)
  if (result.ok) {
    setInvalidPaths([])
    setEditor({ mode: 'view', id: next.id })
    toast.success(
      editor.mode === 'edit'
        ? t('toast.updated', { name: next.name.en || next.id })
        : t('toast.created', { name: next.name.en || next.id }),
    )
  } else {
    if (result.code === 'validation-failed') {
      setInvalidPaths(zodIssuesToPaths(result.issues))
    }
    toast.error(t('toast.saveFailed', { message: result.message }))
  }
}

function savePaper(
  next: PaperSpec,
  editor: EditorState,
  setEditor: (s: EditorState) => void,
  setInvalidPaths: (p: string[]) => void,
  t: ReturnType<typeof useTranslations<'SpecManager'>>,
): void {
  const store = useSpecManagerStore.getState()
  const result =
    editor.mode === 'edit' ? store.updatePaper(editor.id, next) : store.createPaper(next)
  if (result.ok) {
    setInvalidPaths([])
    setEditor({ mode: 'view', id: next.id })
    toast.success(
      editor.mode === 'edit'
        ? t('toast.updated', { name: next.name.en || next.id })
        : t('toast.created', { name: next.name.en || next.id }),
    )
  } else {
    if (result.code === 'validation-failed') {
      setInvalidPaths(zodIssuesToPaths(result.issues))
    }
    toast.error(t('toast.saveFailed', { message: result.message }))
  }
}

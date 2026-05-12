import { describe, expect, it } from 'vitest'
import enMessages from '@/i18n/messages/en.json'
import zhHansMessages from '@/i18n/messages/zh-Hans.json'
import zhHantMessages from '@/i18n/messages/zh-Hant.json'
import { ALL_ERROR_KINDS, messageKey, normalizeErrorKind } from '@/features/segmentation/errors'

describe('normalizeErrorKind', () => {
  it.each(ALL_ERROR_KINDS)('passes through known kind %s', (kind) => {
    expect(normalizeErrorKind(kind)).toBe(kind)
  })

  it.each(['', 'foo', null, undefined, 'NETWORK'])(
    'collapses unknown value %s to "unknown"',
    (input) => {
      expect(normalizeErrorKind(input as string | null | undefined)).toBe('unknown')
    },
  )
})

describe('messageKey', () => {
  it.each(ALL_ERROR_KINDS)('builds errors.%s for kind %s', (kind) => {
    expect(messageKey(kind)).toBe(`errors.${kind}`)
  })
})

describe('i18n coverage', () => {
  const locales = [
    { name: 'zh-Hans', messages: zhHansMessages },
    { name: 'zh-Hant', messages: zhHantMessages },
    { name: 'en', messages: enMessages },
  ] as const

  it.each(locales)('locale $name has all Segmentation.errors keys', ({ messages }) => {
    const errs = (messages as { Segmentation?: { errors?: Record<string, string> } }).Segmentation
      ?.errors
    expect(errs).toBeDefined()
    for (const kind of ALL_ERROR_KINDS) {
      expect(errs?.[kind]).toBeTruthy()
    }
  })

  it.each(locales)('locale $name has progress + state strings', ({ messages }) => {
    const seg = (messages as { Segmentation?: Record<string, unknown> }).Segmentation
    expect(seg).toBeDefined()
    const states = (seg as { states?: Record<string, string> }).states
    const progress = (seg as { progress?: Record<string, string> }).progress
    const backend = (seg as { backend?: Record<string, string> }).backend
    expect(states?.idle).toBeTruthy()
    expect(states?.loadingModel).toBeTruthy()
    expect(states?.inferring).toBeTruthy()
    expect(progress?.download).toMatch(/\{loaded\}/)
    expect(progress?.download).toMatch(/\{total\}/)
    expect(backend?.webgpu).toBeTruthy()
    expect(backend?.wasm).toBeTruthy()
  })
})

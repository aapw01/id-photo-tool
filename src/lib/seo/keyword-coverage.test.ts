/**
 * Locale-bundle level guard for the AI / intelligent intent cluster.
 *
 * Pixfit's SEO weight depends on these keywords appearing in the
 * meta of the home + scanner pages across all three locales. If a
 * future translation pass strips them, search rankings for queries
 * like "智能证件照处理" / "intelligent ID photo" will silently
 * regress — this suite is the canary.
 *
 * The expected keyword cluster is intentionally locale-specific so
 * the test asserts the *translated* form, not a blind English match.
 */

import { describe, expect, it } from 'vitest'

import enMessages from '@/i18n/messages/en.json'
import zhHansMessages from '@/i18n/messages/zh-Hans.json'
import zhHantMessages from '@/i18n/messages/zh-Hant.json'

interface LocaleBundle {
  Home: {
    metaTitle: string
    metaDescription: string
    metaKeywords: string[]
    heroTitle: string
    heroSubtitle: string
  }
  Scanner: {
    metaTitle: string
    metaDescription: string
    metaKeywords: string[]
    subtitle: string
    seoIntro: {
      // Scanner's seoIntro stores paragraphs as a string-keyed
      // object (different from Home's array) so messages-format
      // ICU plural-style lookups work; mirror that shape here.
      paragraphs: Record<string, string>
    }
  }
  Studio: {
    metaTitle: string
    metaDescription: string
    metaKeywords: string[]
  }
  Sizes: {
    metaTitle: string
    metaDescription: string
    metaKeywords: string[]
  }
  Paper: {
    list: {
      metaTitle: string
      metaDescription: string
      metaKeywords: string[]
    }
  }
  Templates: {
    metaTitle: string
    metaDescription: string
    metaKeywords: string[]
  }
}

const locales = [
  { name: 'zh-Hans', messages: zhHansMessages as unknown as LocaleBundle },
  { name: 'zh-Hant', messages: zhHantMessages as unknown as LocaleBundle },
  { name: 'en', messages: enMessages as unknown as LocaleBundle },
] as const

// The minimum keyword cluster every locale must surface on /. The
// strings are checked verbatim against the locale's translated
// keyword list, NOT against English — so zh-Hans gets the Chinese
// terms, zh-Hant gets the traditional variants, en gets the English
// long-tail.
const HOME_KEYWORDS: Record<(typeof locales)[number]['name'], string[]> = {
  // Simplified Chinese uses 智能 — Pixfit's preferred translation
  // for "intelligent / AI".
  'zh-Hans': ['智能证件照处理', 'AI 证件照', '智能抠图', 'AI 一键换背景'],
  // Traditional Chinese uses 智慧 / 去背 — translation parity must
  // hold these locale-specific equivalents, NOT the simplified terms.
  'zh-Hant': ['智慧證件照處理', 'AI 證件照', '智慧去背', 'AI 一鍵換背景'],
  en: ['intelligent ID photo', 'AI passport photo', 'smart document scanner'],
}

const SCANNER_KEYWORDS: Record<(typeof locales)[number]['name'], string[]> = {
  'zh-Hans': ['智能证件扫描', 'AI 证件扫描', '智能身份证扫描', 'AI 透视校正'],
  'zh-Hant': ['智慧證件掃描', 'AI 證件掃描', '智慧身分證掃描', 'AI 透視校正'],
  en: ['smart document scanner', 'AI document scanner', 'intelligent perspective correction'],
}

describe('Home metaKeywords cluster', () => {
  it.each(locales)('locale $name carries the AI/intelligent keywords', ({ name, messages }) => {
    const kw = messages.Home.metaKeywords
    expect(Array.isArray(kw)).toBe(true)
    for (const k of HOME_KEYWORDS[name]) {
      expect(kw, `Home.metaKeywords[${name}] missing "${k}"`).toContain(k)
    }
  })

  it.each(locales)('locale $name surfaces an AI term in the hero copy', ({ messages }) => {
    // The keyword must be reachable from a crawl that only reads the
    // body — meta keywords are largely ignored by Google. Asserting
    // that hero copy mentions the intent secures the rank.
    const combined = `${messages.Home.heroTitle} ${messages.Home.heroSubtitle}`.toLowerCase()
    expect(
      combined.includes('ai') ||
        combined.includes('智能') ||
        combined.includes('智慧') ||
        combined.includes('intelligent'),
    ).toBe(true)
  })

  it.each(locales)('Home.metaDescription stays <= 160 characters in $name', ({ messages }) => {
    // SERP truncates beyond ~160; we keep a hard cap so contributors
    // can't blow it up during translation passes.
    expect(messages.Home.metaDescription.length).toBeLessThanOrEqual(160)
  })
})

describe('Scanner metaKeywords cluster', () => {
  it.each(locales)('locale $name carries the smart-scanner keywords', ({ name, messages }) => {
    const kw = messages.Scanner.metaKeywords
    expect(Array.isArray(kw)).toBe(true)
    for (const k of SCANNER_KEYWORDS[name]) {
      expect(kw, `Scanner.metaKeywords[${name}] missing "${k}"`).toContain(k)
    }
  })

  it.each(locales)('locale $name surfaces an AI-scan phrase in the page intro', ({ messages }) => {
    const paragraphs = Object.values(messages.Scanner.seoIntro.paragraphs).join(' ')
    const combined = `${messages.Scanner.subtitle} ${paragraphs}`.toLowerCase()
    expect(
      combined.includes('ai') ||
        combined.includes('智能') ||
        combined.includes('智慧') ||
        combined.includes('intelligent'),
    ).toBe(true)
  })

  it.each(locales)('Scanner.metaDescription stays <= 160 characters in $name', ({ messages }) => {
    expect(messages.Scanner.metaDescription.length).toBeLessThanOrEqual(160)
  })
})

describe('Boost-page metaDescription stays under SERP truncation', () => {
  // SERP truncates beyond ~160; we pin a hard cap so translation
  // passes can't blow it up. Each locale is independent because
  // the same intent surface needs a tight one-liner per language.
  const cap = 160
  it.each(locales)('locale $name boost descriptions all stay <= 160', ({ messages }) => {
    expect(messages.Home.metaDescription.length).toBeLessThanOrEqual(cap)
    expect(messages.Studio.metaDescription.length).toBeLessThanOrEqual(cap)
    expect(messages.Sizes.metaDescription.length).toBeLessThanOrEqual(cap)
    expect(messages.Scanner.metaDescription.length).toBeLessThanOrEqual(cap)
    expect(messages.Paper.list.metaDescription.length).toBeLessThanOrEqual(cap)
    expect(messages.Templates.metaDescription.length).toBeLessThanOrEqual(cap)
  })
})

describe('All boost pages have a metaKeywords array', () => {
  // Guards against a regression where a contributor adds a new page
  // route but forgets to populate metaKeywords for one locale.
  it.each(locales)('locale $name has metaKeywords for the boost pages', ({ messages }) => {
    expect(Array.isArray(messages.Home.metaKeywords)).toBe(true)
    expect(messages.Home.metaKeywords.length).toBeGreaterThan(0)
    expect(Array.isArray(messages.Scanner.metaKeywords)).toBe(true)
    expect(messages.Scanner.metaKeywords.length).toBeGreaterThan(0)
    expect(Array.isArray(messages.Studio.metaKeywords)).toBe(true)
    expect(messages.Studio.metaKeywords.length).toBeGreaterThan(0)
    expect(Array.isArray(messages.Sizes.metaKeywords)).toBe(true)
    expect(messages.Sizes.metaKeywords.length).toBeGreaterThan(0)
    expect(Array.isArray(messages.Paper.list.metaKeywords)).toBe(true)
    expect(messages.Paper.list.metaKeywords.length).toBeGreaterThan(0)
    expect(Array.isArray(messages.Templates.metaKeywords)).toBe(true)
    expect(messages.Templates.metaKeywords.length).toBeGreaterThan(0)
  })
})

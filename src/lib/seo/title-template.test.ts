/**
 * Long-tail title / description template guardrails.
 *
 * A1 of the 2026 SEO push rewrote every landing page meta to the
 * template "{name} {precise-size} {action-verb cluster} {year} |
 * Pixfit" (English: "{Name} {precise size} {Action verb} {Year} |
 * Pixfit"). This suite pins three properties for every locale:
 *
 *   - metaTitle must carry the year token + Pixfit brand;
 *   - per-spec detail pages must also carry an explicit
 *     `{w}×{h}mm` size token (rendered against representative
 *     parameters);
 *   - metaDescription must stay <= 160 chars and surface at least
 *     two of the action-verb cluster on home / scanner / studio.
 *
 * The check is intentionally per-locale: zh-Hans uses 在线/免费,
 * zh-Hant uses 線上/免費, en uses online/free.
 */

import { describe, expect, it } from 'vitest'

import enMessages from '@/i18n/messages/en.json'
import zhHansMessages from '@/i18n/messages/zh-Hans.json'
import zhHantMessages from '@/i18n/messages/zh-Hant.json'

interface LocaleBundle {
  Home: { metaTitle: string; metaDescription: string }
  Studio: { metaTitle: string; metaDescription: string }
  Scanner: {
    metaTitle: string
    metaDescription: string
    detail: { metaTitle: string; metaDescription: string }
  }
  Sizes: {
    metaTitle: string
    metaDescription: string
    detail: { metaTitle: string; metaDescription: string }
  }
  Paper: { list: { metaTitle: string; metaDescription: string } }
  Templates: { metaTitle: string; metaDescription: string }
}

const locales = [
  { name: 'zh-Hans', messages: zhHansMessages as unknown as LocaleBundle },
  { name: 'zh-Hant', messages: zhHantMessages as unknown as LocaleBundle },
  { name: 'en', messages: enMessages as unknown as LocaleBundle },
] as const

type LocaleName = (typeof locales)[number]['name']

function landingTitles(m: LocaleBundle): string[] {
  return [
    m.Home.metaTitle,
    m.Studio.metaTitle,
    m.Scanner.metaTitle,
    m.Sizes.metaTitle,
    m.Paper.list.metaTitle,
    m.Templates.metaTitle,
  ]
}

function landingDescriptions(m: LocaleBundle): string[] {
  return [
    m.Home.metaDescription,
    m.Studio.metaDescription,
    m.Scanner.metaDescription,
    m.Sizes.metaDescription,
    m.Paper.list.metaDescription,
    m.Templates.metaDescription,
  ]
}

function interpolate(template: string, params: Record<string, string | number>): string {
  let out = template
  for (const [k, v] of Object.entries(params)) {
    out = out.replaceAll(`{${k}}`, String(v))
  }
  return out
}

const ACTION_VERBS: Record<LocaleName, readonly string[]> = {
  'zh-Hans': ['在线', '免费', '裁剪', '扫描', '生成'],
  'zh-Hant': ['線上', '免費', '裁切', '掃描', '生成'],
  en: ['online', 'free', 'crop', 'scan', 'generate'],
}

describe('Landing metaTitle template', () => {
  it.each(locales)('every landing title contains "Pixfit" + 2026 in $name', ({ messages }) => {
    for (const title of landingTitles(messages)) {
      expect(title).toContain('Pixfit')
      expect(title).toContain('2026')
    }
  })
})

describe('Detail metaTitle template', () => {
  it.each(locales)('Sizes.detail title has size token + Pixfit + 2026 in $name', ({ messages }) => {
    const rendered = interpolate(messages.Sizes.detail.metaTitle, {
      name: 'US visa',
      w: 51,
      h: 51,
      wpx: 600,
      hpx: 600,
      dpi: 300,
    })
    expect(rendered).toContain('Pixfit')
    expect(rendered).toContain('2026')
    // Size token: width×height mm. The "×" character must survive the
    // template substitution untouched — we match either an ASCII "x"
    // or the proper U+00D7 multiplication sign.
    expect(rendered).toMatch(/51\s*[×x]\s*51\s*mm/i)
    // Pixel token mirrors the spec's official pixel count.
    expect(rendered).toMatch(/600\s*[×x]\s*600\s*px/i)
  })

  it.each(locales)(
    'Scanner.detail title has size token + Pixfit + 2026 in $name',
    ({ messages }) => {
      const rendered = interpolate(messages.Scanner.detail.metaTitle, {
        name: 'PRC ID card',
        w: 85.6,
        h: 54,
      })
      expect(rendered).toContain('Pixfit')
      expect(rendered).toContain('2026')
      expect(rendered).toMatch(/85\.6\s*[×x]\s*54\s*mm/i)
    },
  )
})

describe('Landing metaDescription length cap', () => {
  // SERP snippet truncates beyond ~160; pinning the upper bound keeps
  // the snippet readable across every locale.
  it.each(locales)('all landing descriptions are <= 160 chars in $name', ({ messages }) => {
    for (const desc of landingDescriptions(messages)) {
      expect(desc.length).toBeLessThanOrEqual(160)
    }
  })

  it.each(locales)(
    'Sizes.detail metaDescription <= 160 chars after render in $name',
    ({ messages }) => {
      const rendered = interpolate(messages.Sizes.detail.metaDescription, {
        name: 'US visa',
        w: 51,
        h: 51,
        wpx: 600,
        hpx: 600,
        dpi: 300,
        bgLabel: 'white',
      })
      expect(rendered.length).toBeLessThanOrEqual(160)
    },
  )

  it.each(locales)(
    'Scanner.detail metaDescription <= 160 chars after render in $name',
    ({ messages }) => {
      const rendered = interpolate(messages.Scanner.detail.metaDescription, {
        name: 'PRC ID card',
        w: 85.6,
        h: 54,
      })
      expect(rendered.length).toBeLessThanOrEqual(160)
    },
  )
})

describe('Action-verb cluster on home / scanner / studio descriptions', () => {
  it.each(locales)('home description carries >= 2 action verbs in $name', ({ name, messages }) => {
    const desc = messages.Home.metaDescription.toLowerCase()
    const verbs = ACTION_VERBS[name].map((v) => v.toLowerCase())
    const hits = verbs.filter((v) => desc.includes(v))
    expect(
      hits.length,
      `Home/${name}: matched ${hits.join(', ')} in "${desc}"`,
    ).toBeGreaterThanOrEqual(2)
  })

  it.each(locales)(
    'studio description carries >= 2 action verbs in $name',
    ({ name, messages }) => {
      const desc = messages.Studio.metaDescription.toLowerCase()
      const verbs = ACTION_VERBS[name].map((v) => v.toLowerCase())
      const hits = verbs.filter((v) => desc.includes(v))
      expect(
        hits.length,
        `Studio/${name}: matched ${hits.join(', ')} in "${desc}"`,
      ).toBeGreaterThanOrEqual(2)
    },
  )

  it.each(locales)(
    'scanner description carries >= 2 action verbs in $name',
    ({ name, messages }) => {
      const desc = messages.Scanner.metaDescription.toLowerCase()
      const verbs = ACTION_VERBS[name].map((v) => v.toLowerCase())
      const hits = verbs.filter((v) => desc.includes(v))
      expect(
        hits.length,
        `Scanner/${name}: matched ${hits.join(', ')} in "${desc}"`,
      ).toBeGreaterThanOrEqual(2)
    },
  )
})

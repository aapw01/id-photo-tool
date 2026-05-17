import { describe, expect, it } from 'vitest'

import robots, { AI_CRAWLER_AGENTS } from './robots'

describe('robots.ts route handler', () => {
  const config = robots()

  it('keeps a wildcard rule that allows / and disallows /dev/ + /api/', () => {
    const wildcard = (
      config.rules as Array<{
        userAgent: string
        allow?: string | string[]
        disallow?: string | string[]
      }>
    ).find((r) => r.userAgent === '*')
    expect(wildcard).toBeDefined()
    expect(wildcard!.allow).toBe('/')
    const disallow = Array.isArray(wildcard!.disallow) ? wildcard!.disallow : [wildcard!.disallow]
    expect(disallow).toContain('/dev/')
    expect(disallow).toContain('*/dev/*')
    expect(disallow).toContain('/api/')
  })

  it('emits an explicit Allow rule for every 2026 AI crawler agent', () => {
    const rules = config.rules as Array<{ userAgent: string; allow?: string | string[] }>
    for (const agent of AI_CRAWLER_AGENTS) {
      const rule = rules.find((r) => r.userAgent === agent)
      expect(rule, `missing rule for ${agent}`).toBeDefined()
      expect(rule!.allow).toBe('/')
    }
  })

  it('exposes the canonical sitemap URL', () => {
    expect(config.sitemap).toMatch(/^https?:\/\/[^/]+\/sitemap\.xml$/)
  })

  it('declares a bare-host Host directive (no scheme, no trailing slash)', () => {
    expect(config.host).toBeDefined()
    expect(typeof config.host).toBe('string')
    expect(config.host).not.toMatch(/^https?:\/\//)
    expect(config.host).not.toMatch(/\/$/)
  })

  it('includes all seven AI crawler agents in deterministic order', () => {
    const ai = (config.rules as Array<{ userAgent: string }>)
      .map((r) => r.userAgent)
      .filter((agent) => (AI_CRAWLER_AGENTS as readonly string[]).includes(agent))
    expect(ai).toEqual([
      'GPTBot',
      'ClaudeBot',
      'PerplexityBot',
      'Google-Extended',
      'CCBot',
      'Applebot-Extended',
      'Amazonbot',
    ])
  })
})

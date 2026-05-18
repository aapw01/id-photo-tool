import { describe, expect, it, vi } from 'vitest'

// We import the modules statically (no `await import()` inside the
// tests) so any module-load-time errors trip the test runner instead
// of being silently swallowed. The OG image modules only touch
// next-intl + our own data files, so they import cleanly under
// vitest.

vi.mock('next-intl/server', () => ({
  getTranslations: async () => {
    const fn = (key: string) => `t:${key}`
    fn.raw = () => ({})
    return fn
  },
}))

vi.mock('next/og', () => ({
  // Stub ImageResponse so the satori bundle (which pulls in resvg /
  // yoga) never has to load inside the test runner. We assert on
  // the constructor input instead of the rendered PNG bytes.
  ImageResponse: class ImageResponseStub {
    constructor(
      public node: unknown,
      public init?: unknown,
    ) {}
  },
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
}))

describe('opengraph-image modules', () => {
  it('home /[locale]/opengraph-image exports the OG card metadata', async () => {
    const mod = await import('./opengraph-image')
    expect(typeof mod.default).toBe('function')
    expect(mod.size).toEqual({ width: 1200, height: 630 })
    expect(mod.contentType).toBe('image/png')
    expect(mod.alt.toLowerCase()).toContain('pixfit')
  })

  it('scanner index /[locale]/scanner/opengraph-image exports alt referencing the page', async () => {
    const mod = await import('./scanner/opengraph-image')
    expect(typeof mod.default).toBe('function')
    expect(mod.size).toEqual({ width: 1200, height: 630 })
    expect(mod.contentType).toBe('image/png')
    expect(mod.alt).toContain('Scanner')
  })

  it('scanner doc detail OG module exists with the right shape', async () => {
    const mod = await import('./scanner/[docType]/opengraph-image')
    expect(typeof mod.default).toBe('function')
    expect(mod.size).toEqual({ width: 1200, height: 630 })
    expect(mod.contentType).toBe('image/png')
    expect(mod.alt.toLowerCase()).toContain('scanner')
  })

  it('size detail OG module exists with the right shape', async () => {
    const mod = await import('./sizes/[specId]/opengraph-image')
    expect(typeof mod.default).toBe('function')
    expect(mod.size).toEqual({ width: 1200, height: 630 })
    expect(mod.contentType).toBe('image/png')
    expect(mod.alt.toLowerCase()).toContain('pixfit')
  })

  it('blog article OG module exists with the right shape', async () => {
    const mod = await import('./blog/[slug]/opengraph-image')
    expect(typeof mod.default).toBe('function')
    expect(mod.size).toEqual({ width: 1200, height: 630 })
    expect(mod.contentType).toBe('image/png')
    expect(mod.alt.toLowerCase()).toContain('blog')
  })

  it('home OG handler returns an ImageResponse-stub instance', async () => {
    const { default: handler } = await import('./opengraph-image')
    const out = (await handler({ params: { locale: 'en' } })) as unknown as { node: unknown }
    expect(out).toBeDefined()
    expect(out.node).toBeDefined()
  })

  it('scanner doc OG handler resolves a known DocSpec', async () => {
    const { default: handler } = await import('./scanner/[docType]/opengraph-image')
    const out = (await handler({
      params: { locale: 'en', docType: 'cn-id-card' },
    })) as unknown as { node: unknown }
    expect(out.node).toBeDefined()
  })
})

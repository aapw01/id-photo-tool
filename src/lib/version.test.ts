import { describe, expect, it } from 'vitest'
import { APP_DOMAIN, APP_NAME, APP_VERSION } from '@/lib/version'

describe('version constants', () => {
  it('exposes brand name', () => {
    expect(APP_NAME).toBe('Pixfit')
  })

  it('uses semver-shaped version', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('points at the canonical domain', () => {
    expect(APP_DOMAIN).toBe('pix-fit.com')
  })
})

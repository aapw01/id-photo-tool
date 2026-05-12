// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { triggerDownload } from './dom-download'

describe('triggerDownload', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function setupObjectUrlSpies() {
    const create = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation((b: Blob | MediaSource) => `blob:fake/${(b as Blob).size ?? 0}`)
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    return { create, revoke }
  }

  it('appends, clicks, and removes the anchor element', () => {
    setupObjectUrlSpies()
    const blob = new Blob(['hello'], { type: 'text/plain' })

    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const clickSpy = vi.fn()
    const removeSpy = vi.fn()
    const original = document.createElement.bind(document)
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = original(tag) as HTMLElement
      if (tag === 'a') {
        ;(el as HTMLAnchorElement).click = clickSpy
        ;(el as HTMLAnchorElement).remove = removeSpy
      }
      return el
    })

    triggerDownload(blob, 'hello.txt')

    expect(createSpy).toHaveBeenCalledWith('a')
    expect(appendSpy).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalledOnce()
    expect(removeSpy).toHaveBeenCalledOnce()
  })

  it('defers URL.revokeObjectURL by 30 seconds (Safari race avoidance)', () => {
    const { revoke } = setupObjectUrlSpies()
    const blob = new Blob(['data'])

    triggerDownload(blob, 'data.bin')

    expect(revoke).not.toHaveBeenCalled()

    vi.advanceTimersByTime(29_999)
    expect(revoke).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(revoke).toHaveBeenCalledOnce()
  })
})

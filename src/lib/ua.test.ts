import { describe, expect, it } from 'vitest'

import { isCoarsePointer, isWeChatBrowser } from './ua'

describe('isWeChatBrowser', () => {
  it('detects WeChat iOS UA', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.45(0x18002d36) NetType/WIFI Language/zh_CN'
    expect(isWeChatBrowser(ua)).toBe(true)
  })

  it('detects WeChat Android UA', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 13; SM-S908B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/108.0.5359.128 MobileSafari/537.36 MMWEBID/3589 MicroMessenger/8.0.40.2420(0x28002836) WeChat/arm64 Weixin'
    expect(isWeChatBrowser(ua)).toBe(true)
  })

  it('returns false for plain mobile Safari', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
    expect(isWeChatBrowser(ua)).toBe(false)
  })

  it('returns false for empty / null / undefined input', () => {
    expect(isWeChatBrowser('')).toBe(false)
    expect(isWeChatBrowser(null)).toBe(false)
    expect(isWeChatBrowser(undefined)).toBe(false)
  })
})

describe('isCoarsePointer', () => {
  it('honours an explicit matchMedia result when provided', () => {
    expect(isCoarsePointer('any ua', true)).toBe(true)
    expect(isCoarsePointer('any ua', false)).toBe(false)
  })

  it('falls back to UA sniff for touch devices', () => {
    expect(isCoarsePointer('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4)')).toBe(true)
    expect(isCoarsePointer('Mozilla/5.0 (Linux; Android 13;)')).toBe(true)
  })

  it('returns false for desktop UA without an explicit hint', () => {
    expect(
      isCoarsePointer(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0',
      ),
    ).toBe(false)
  })
})

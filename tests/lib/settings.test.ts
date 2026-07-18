// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULTS, loadSettings, saveSettings } from '../../src/lib/settings'

const KEY = 'ayaki-settings'

beforeEach(() => localStorage.clear())

describe('localStorage test environment', () => {
  it('reports length live and preserves empty strings', () => {
    localStorage.setItem('probe', '')
    expect(localStorage.length).toBe(1)
    expect(localStorage.getItem('probe')).toBe('')
  })
})

describe('loadSettings', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual(DEFAULTS)
  })
  it('round-trips saved settings', () => {
    const s = { showFurigana: true, view: 'tree' as const, rate: 1.3 }
    saveSettings(s)
    expect(loadSettings()).toEqual(s)
  })
  it.each(['not json{', '42', 'null', '[]', '"tree"'])(
    'falls back to all defaults for non-object payload %s',
    (raw) => {
      localStorage.setItem(KEY, raw)
      expect(loadSettings()).toEqual(DEFAULTS)
    },
  )
  it('keeps valid fields when others are invalid', () => {
    localStorage.setItem(KEY, JSON.stringify({ showFurigana: 'yes', view: 'tree', rate: 'fast' }))
    expect(loadSettings()).toEqual({ ...DEFAULTS, view: 'tree' })
  })
  it('clamps rate to the slider range', () => {
    localStorage.setItem(KEY, JSON.stringify({ rate: 0.1 }))
    expect(loadSettings().rate).toBe(0.5)
    localStorage.setItem(KEY, JSON.stringify({ rate: 99 }))
    expect(loadSettings().rate).toBe(1.5)
  })
  it('rejects non-numeric and non-finite rate values', () => {
    localStorage.setItem(KEY, JSON.stringify({ rate: '1' }))
    expect(loadSettings().rate).toBe(DEFAULTS.rate)
    // JSON.stringify turns NaN/Infinity into null — cover a literal null too
    localStorage.setItem(KEY, '{"rate": null}')
    expect(loadSettings().rate).toBe(DEFAULTS.rate)
  })
  it('ignores unknown keys', () => {
    localStorage.setItem(KEY, JSON.stringify({ view: 'tree', theme: 'dark' }))
    expect(loadSettings()).toEqual({ ...DEFAULTS, view: 'tree' })
  })
  it('returns defaults when storage access throws', () => {
    const spy = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(loadSettings()).toEqual(DEFAULTS)
    spy.mockRestore()
  })
})

describe('saveSettings', () => {
  it('silently ignores write failures', () => {
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    expect(() => saveSettings(DEFAULTS)).not.toThrow()
    spy.mockRestore()
  })
})

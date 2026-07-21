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
    const s = { showFurigana: true, showConfidence: true, view: 'tree' as const, rate: 1.3, voiceURI: 'kyoko', locale: 'de' as const, chainColor: 'violet' as const, confidenceThreshold: 0.85, quietParts: true, showRelations: false }
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
  it('clamps confidenceThreshold to the slider range', () => {
    localStorage.setItem(KEY, JSON.stringify({ confidenceThreshold: 0.2 }))
    expect(loadSettings().confidenceThreshold).toBe(0.6)
    localStorage.setItem(KEY, JSON.stringify({ confidenceThreshold: 0.99 }))
    expect(loadSettings().confidenceThreshold).toBe(0.9)
  })
  it('rejects non-numeric confidenceThreshold values', () => {
    localStorage.setItem(KEY, JSON.stringify({ confidenceThreshold: '0.8' }))
    expect(loadSettings().confidenceThreshold).toBe(0.7)
    localStorage.setItem(KEY, '{"confidenceThreshold": null}')
    expect(loadSettings().confidenceThreshold).toBe(0.7)
  })
  it('rejects non-boolean quietParts values', () => {
    localStorage.setItem(KEY, JSON.stringify({ quietParts: 'yes' }))
    expect(loadSettings().quietParts).toBe(false)
  })
  it('rejects non-boolean showRelations values', () => {
    localStorage.setItem(KEY, JSON.stringify({ showRelations: 'yes' }))
    expect(loadSettings().showRelations).toBe(true)
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
  it('accepts a string or null voiceURI and rejects other types', () => {
    localStorage.setItem(KEY, JSON.stringify({ voiceURI: 'kyoko' }))
    expect(loadSettings().voiceURI).toBe('kyoko')
    localStorage.setItem(KEY, JSON.stringify({ voiceURI: null }))
    expect(loadSettings().voiceURI).toBeNull()
    localStorage.setItem(KEY, JSON.stringify({ voiceURI: 7 }))
    expect(loadSettings().voiceURI).toBeNull()
  })
  it('normalizes an empty-string voiceURI to null (canonical auto)', () => {
    localStorage.setItem(KEY, JSON.stringify({ voiceURI: '' }))
    expect(loadSettings().voiceURI).toBeNull()
  })
  it('defaults voiceURI to null for payloads from before the field existed', () => {
    localStorage.setItem(KEY, JSON.stringify({ view: 'tree' }))
    expect(loadSettings()).toEqual({ ...DEFAULTS, view: 'tree' })
  })
  it('accepts the cabocha view and rejects unknown views', () => {
    localStorage.setItem(KEY, JSON.stringify({ view: 'cabocha' }))
    expect(loadSettings().view).toBe('cabocha')
    localStorage.setItem(KEY, JSON.stringify({ view: 'spiral' }))
    expect(loadSettings().view).toBe('arcs')
  })
  it('accepts the four locale codes and null, rejects others', () => {
    for (const code of ['en', 'de', 'ja', 'zh']) {
      localStorage.setItem(KEY, JSON.stringify({ locale: code }))
      expect(loadSettings().locale).toBe(code)
    }
    localStorage.setItem(KEY, JSON.stringify({ locale: null }))
    expect(loadSettings().locale).toBeNull()
    localStorage.setItem(KEY, JSON.stringify({ locale: 'fr' }))
    expect(loadSettings().locale).toBeNull()
    localStorage.setItem(KEY, JSON.stringify({ locale: 7 }))
    expect(loadSettings().locale).toBeNull()
  })
  it('validates showConfidence and defaults it to false', () => {
    localStorage.setItem(KEY, JSON.stringify({ showConfidence: true }))
    expect(loadSettings().showConfidence).toBe(true)
    localStorage.setItem(KEY, JSON.stringify({ showConfidence: 'yes' }))
    expect(loadSettings().showConfidence).toBe(false)
    localStorage.setItem(KEY, JSON.stringify({}))
    expect(loadSettings().showConfidence).toBe(false)
  })
  it('validates chainColor and defaults it to amber', () => {
    localStorage.setItem(KEY, JSON.stringify({ chainColor: 'violet' }))
    expect(loadSettings().chainColor).toBe('violet')
    localStorage.setItem(KEY, JSON.stringify({ chainColor: 'pink' }))
    expect(loadSettings().chainColor).toBe('amber')
    localStorage.setItem(KEY, JSON.stringify({}))
    expect(loadSettings().chainColor).toBe('amber')
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


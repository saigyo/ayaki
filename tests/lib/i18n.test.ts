// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { currentLocale, resolveLocale, setStoredLocale, t } from '../../src/lib/i18n.svelte'
import { en } from '../../src/lib/locales/en'
import { de } from '../../src/lib/locales/de'
import { ja } from '../../src/lib/locales/ja'
import { zh } from '../../src/lib/locales/zh'

describe('resolveLocale', () => {
  it('prefers the stored locale over the browser list', () => {
    expect(resolveLocale('zh', ['de-DE'])).toBe('zh')
  })
  it('ignores an unsupported stored value and falls back to browser resolution', () => {
    expect(resolveLocale('xx' as never, ['de-DE'])).toBe('de')
    expect(resolveLocale('' as never, ['ja'])).toBe('ja')
  })
  it('matches base prefixes of browser languages in order', () => {
    expect(resolveLocale(null, ['fr-FR', 'de-AT', 'en-US'])).toBe('de')
    expect(resolveLocale(null, ['zh-TW'])).toBe('zh')
    expect(resolveLocale(null, ['ja'])).toBe('ja')
  })
  it('falls back to en for unsupported or empty lists', () => {
    expect(resolveLocale(null, ['fr-FR', 'ko-KR'])).toBe('en')
    expect(resolveLocale(null, [])).toBe('en')
  })
})

describe('t and locale state', () => {
  it('switches messages and documentElement.lang with the stored locale', () => {
    setStoredLocale('de')
    expect(currentLocale()).toBe('de')
    expect(t('parseButton')).toBe('Analysieren')
    expect(document.documentElement.lang).toBe('de')
    setStoredLocale(null) // jsdom navigator.languages is en-US → en
    expect(currentLocale()).toBe('en')
    expect(t('parseButton')).toBe('Parse')
    expect(document.documentElement.lang).toBe('en')
  })
  it('substitutes {name} parameters', () => {
    setStoredLocale('en')
    expect(t('sentenceHeadingN', { index: 2, total: 5 })).toBe('Sentence 2 / 5')
    expect(t('uncertaintyNote', { uncertain: 3, total: 8 })).toBe('3 of 8 attachments uncertain')
  })
})

describe('catalog parity', () => {
  it('all four catalogs share an identical key set', () => {
    const keys = Object.keys(en).sort()
    expect(Object.keys(de).sort()).toEqual(keys)
    expect(Object.keys(ja).sort()).toEqual(keys)
    expect(Object.keys(zh).sort()).toEqual(keys)
  })
  it('no catalog has empty values', () => {
    for (const cat of [en, de, ja, zh]) {
      for (const [k, v] of Object.entries(cat)) expect(v, k).not.toBe('')
    }
  })
})

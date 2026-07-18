import { describe, expect, it } from 'vitest'
import { conjugationLabel, hasKanji, posLabel, toHiragana } from '../../src/lib/pos'

describe('toHiragana', () => {
  it('converts katakana, preserving the long-vowel mark', () => {
    expect(toHiragana('キョウ')).toBe('きょう')
    expect(toHiragana('コーヒー')).toBe('こーひー')
  })
  it('leaves hiragana, kanji and latin untouched', () => {
    expect(toHiragana('食べた abc')).toBe('食べた abc')
  })
})

describe('hasKanji', () => {
  it('detects kanji and the iteration mark', () => {
    expect(hasKanji('映画')).toBe(true)
    expect(hasKanji('人々')).toBe(true)
    expect(hasKanji('これはひらがなとカタカナ')).toBe(false)
  })
})

describe('posLabel', () => {
  it('maps top-level POS with sub-category', () => {
    expect(posLabel('助詞', '格助詞')).toEqual({ ja: '助詞・格助詞', en: 'particle (case-marking)' })
    expect(posLabel('名詞', '固有名詞')).toEqual({ ja: '名詞・固有名詞', en: 'noun (proper noun)' })
  })
  it('omits detail when it is *', () => {
    expect(posLabel('接続詞', '*')).toEqual({ ja: '接続詞', en: 'conjunction' })
  })
  it('falls back to Japanese-only for unmapped tags', () => {
    expect(posLabel('謎品詞')).toEqual({ ja: '謎品詞', en: null })
  })
  it('keeps unmapped detail in ja but omits it in en', () => {
    expect(posLabel('名詞', '謎細分類')).toEqual({ ja: '名詞・謎細分類', en: 'noun' })
  })
})

describe('conjugationLabel', () => {
  it('maps known forms', () => {
    expect(conjugationLabel('連用形')).toEqual({ ja: '連用形', en: 'continuative' })
    expect(conjugationLabel('基本形')).toEqual({ ja: '基本形', en: 'plain form' })
  })
  it('returns Japanese-only for unknown forms', () => {
    expect(conjugationLabel('連用ゴザイ接続')).toEqual({ ja: '連用ゴザイ接続', en: null })
  })
  it('returns null for missing or *', () => {
    expect(conjugationLabel('*')).toBeNull()
    expect(conjugationLabel(undefined)).toBeNull()
  })
})

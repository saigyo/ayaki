import { describe, expect, it } from 'vitest'
import { GLOSS_TABLES, combinePos, conjugationGloss, hasKanji, posGloss, toHiragana } from '../../src/lib/pos'

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

describe('combinePos', () => {
  it('joins pos and meaningful detail with ・', () => {
    expect(combinePos('名詞', '一般')).toBe('名詞・一般')
    expect(combinePos('動詞', '*')).toBe('動詞')
    expect(combinePos('感動詞')).toBe('感動詞')
  })
})

describe('posGloss', () => {
  it('resolves per locale', () => {
    expect(posGloss('名詞・一般', 'en')).toBe('noun (general)')
    expect(posGloss('名詞・一般', 'de')).toBe('Nomen (allgemein)')
    expect(posGloss('名詞・一般', 'zh')).toBe('名词（一般）')
    expect(posGloss('助詞・格助詞', 'de')).toBe('Partikel (kasusmarkierend)')
  })
  it('returns null for the ja locale and for unknown terms', () => {
    expect(posGloss('名詞・一般', 'ja')).toBeNull()
    expect(posGloss('謎の品詞', 'en')).toBeNull()
  })
  it('handles detail-less terms and unknown details', () => {
    expect(posGloss('感動詞', 'en')).toBe('interjection')
    expect(posGloss('名詞・未知の細分類', 'en')).toBe('noun')
  })
})

describe('conjugationGloss', () => {
  it('resolves per locale and hides for ja', () => {
    expect(conjugationGloss('連用形', 'en')).toBe('continuative')
    expect(conjugationGloss('連用形', 'de')).toBe('Verbindungsform')
    expect(conjugationGloss('連用形', 'zh')).toBe('连用形')
    expect(conjugationGloss('連用形', 'ja')).toBeNull()
    expect(conjugationGloss('未知の活用形', 'en')).toBeNull()
  })
})

describe('gloss table completeness', () => {
  // exported for this test: add `export const GLOSS_TABLES = { POS_GLOSS, DETAIL_GLOSS, CONJ_GLOSS }` in pos.ts
  it('every term has non-empty en, de and zh glosses', () => {
    for (const table of Object.values(GLOSS_TABLES)) {
      for (const [term, gloss] of Object.entries(table)) {
        for (const loc of ['en', 'de', 'zh'] as const) {
          expect(gloss[loc], `${term}.${loc}`).toBeTruthy()
        }
      }
    }
  })
})

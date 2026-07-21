import { beforeEach, describe, expect, it } from 'vitest'
import type { Bunsetsu, KuromojiToken } from 'sasara'
import { confidenceLabel, errorSentence, isUncertain, toParsedSentence } from '../../src/lib/viewmodel'
import { setStoredLocale } from '../../src/lib/i18n.svelte'

function tok(partial: Partial<KuromojiToken>): KuromojiToken {
  return {
    word_id: 0,
    word_type: 'KNOWN',
    word_position: 0,
    surface_form: '',
    pos: '名詞',
    pos_detail_1: '*',
    pos_detail_2: '*',
    pos_detail_3: '*',
    conjugated_type: '*',
    conjugated_form: '*',
    basic_form: '*',
    reading: '*',
    pronunciation: '*',
    ...partial,
  } as KuromojiToken
}

function bun(partial: Partial<Bunsetsu> & { confidence?: unknown }): Bunsetsu {
  return { index: 0, tokens: [], surface: '', head: null, ...partial } as Bunsetsu
}

const miniTokens = [
  tok({ surface_form: '見', pos: '動詞', pos_detail_1: '自立', conjugated_form: '連用形', basic_form: '見る', reading: 'ミ' }),
  tok({ surface_form: 'に', pos: '助詞', pos_detail_1: '格助詞', basic_form: 'に', reading: 'ニ' }),
]

describe('toParsedSentence', () => {
  const sentence = toParsedSentence('見に行く。', [
    bun({ index: 0, surface: '見に', head: 1, tokens: miniTokens, confidence: { score: 1.2, probability: 0.55, forced: false } }),
    bun({
      index: 1,
      surface: '行く。',
      head: null,
      tokens: [
        tok({ surface_form: '行く', pos: '動詞', pos_detail_1: '自立', conjugated_form: '基本形', basic_form: '行く', reading: 'イク' }),
        tok({ surface_form: '。', pos: '記号', pos_detail_1: '句点', basic_form: '。', reading: '。' }),
      ],
    }),
  ])

  const [first, root] = sentence.bunsetsu

  it('maps morphemes with reading, POS pair, base form and Jisho link', () => {
    expect(first.morphemes[0]).toEqual({
      surface: '見',
      reading: 'み',
      posJa: '動詞・自立',
      baseForm: '見る',
      conjugationJa: '連用形',
      jishoUrl: 'https://jisho.org/search/%E8%A6%8B%E3%82%8B',
    })
  })
  it('links the surface form when base form equals surface', () => {
    expect(first.morphemes[1].baseForm).toBeNull()
    expect(first.morphemes[1].jishoUrl).toBe('https://jisho.org/search/%E3%81%AB')
  })
  it('gives punctuation no Jisho link', () => {
    expect(root.morphemes[1].jishoUrl).toBeNull()
  })
  it('carries confidence onto non-root bunsetsu', () => {
    expect(first.probability).toBe(0.55)
    expect(first.forced).toBe(false)
    expect(root.probability).toBeNull()
  })
  it('builds furigana only for kanji-containing bunsetsu', () => {
    expect(first.reading).toBe('みに')
    expect(toParsedSentence('ここに。', [bun({ index: 0, surface: 'ここに。', head: null, tokens: [tok({ surface_form: 'ここ', reading: 'ココ' })] })]).bunsetsu[0].reading).toBe('')
  })
  it('normalizes NaN probability to null', () => {
    const s = toParsedSentence('x', [bun({ index: 0, surface: 'x', head: 1, tokens: [], confidence: { score: 0, probability: NaN, forced: true } }), bun({ index: 1, surface: 'y', head: null, tokens: [] })])
    expect(s.bunsetsu[0].probability).toBeNull()
    expect(s.bunsetsu[0].forced).toBe(true)
  })
  it('computes relation labels per bunsetsu', () => {
    const s = toParsedSentence('魚を食べた。', [
      bun({ index: 0, surface: '魚を', head: 1, tokens: [tok({ surface_form: '魚', pos: '名詞', pos_detail_1: '一般' }), tok({ surface_form: 'を', pos: '助詞', pos_detail_1: '格助詞' })] }),
      bun({ index: 1, surface: '食べた。', head: null, tokens: [tok({ surface_form: '食べ', pos: '動詞', pos_detail_1: '自立' }), tok({ surface_form: 'た', pos: '助動詞', pos_detail_1: '*' }), tok({ surface_form: '。', pos: '記号', pos_detail_1: '句点' })] }),
    ])
    expect(s.bunsetsu.map((b) => b.relation)).toEqual(['object', 'predicate'])
  })
})

describe('isUncertain', () => {
  const base = { index: 0, surface: '', head: 1, reading: '', morphemes: [], relation: null }
  it('lets a known probability win; forced matters only without one', () => {
    expect(isUncertain({ ...base, probability: 0.69, forced: false })).toBe(true)
    expect(isUncertain({ ...base, probability: 0.55, forced: true })).toBe(true)
    expect(isUncertain({ ...base, probability: 0.9, forced: false })).toBe(false)
    expect(isUncertain({ ...base, probability: 0.97, forced: true })).toBe(false)
    expect(isUncertain({ ...base, probability: null, forced: true })).toBe(true)
    expect(isUncertain({ ...base, probability: null, forced: false })).toBe(false)
  })
  it('applies an explicit threshold', () => {
    expect(isUncertain({ ...base, probability: 0.75, forced: false }, 0.8)).toBe(true)
    expect(isUncertain({ ...base, probability: 0.75, forced: false }, 0.7)).toBe(false)
    expect(isUncertain({ ...base, probability: null, forced: true }, 0.9)).toBe(true)
    expect(isUncertain({ ...base, probability: null, forced: false }, 0.9)).toBe(false)
  })
})

describe('confidenceLabel', () => {
  // resolveLocale(null) falls back to the system locale via globalThis.navigator in
  // recent Node versions, so pin the locale explicitly rather than relying on the
  // environment's default.
  beforeEach(() => setStoredLocale('en'))

  const base = { index: 0, surface: '', head: 1, reading: '', morphemes: [], relation: null }
  it('formats a probability, appending (forced) when applicable', () => {
    expect(confidenceLabel({ ...base, probability: 0.55, forced: false })).toBe('P = 55%')
    expect(confidenceLabel({ ...base, probability: 0.93, forced: true })).toBe('P = 93% (forced)')
  })
  it('labels forced attachments even without a probability', () => {
    expect(confidenceLabel({ ...base, probability: null, forced: true })).toBe('forced attachment (end-of-sentence fallback)')
  })
  it('returns null when there is nothing to say', () => {
    expect(confidenceLabel({ ...base, probability: null, forced: false })).toBeNull()
  })
})

describe('errorSentence', () => {
  it('wraps a failure', () => {
    expect(errorSentence('壊れた文', 'boom')).toEqual({ text: '壊れた文', bunsetsu: [], error: 'boom' })
  })
})

import type { BunsetsuVM, MorphemeVM, ParsedSentence } from '../src/lib/types'

export function morphemeFixture(over: Partial<MorphemeVM> = {}): MorphemeVM {
  return {
    surface: '魚',
    reading: 'さかな',
    posJa: '名詞・一般',
    posEn: 'noun (general)',
    baseForm: null,
    conjugationJa: null,
    conjugationEn: null,
    jishoUrl: 'https://jisho.org/search/%E9%AD%9A',
    ...over,
  }
}

function b(
  index: number,
  surface: string,
  head: number | null,
  probability: number | null,
  reading: string,
  morphemes: MorphemeVM[],
): BunsetsuVM {
  return { index, surface, head, probability, forced: false, reading, morphemes }
}

/** 猫が(→2, P=.95) 魚を(→2, P=.55 = uncertain) 食べた。(root) */
export function sentenceFixture(): ParsedSentence {
  return {
    text: '猫が魚を食べた。',
    error: null,
    bunsetsu: [
      b(0, '猫が', 2, 0.95, 'ねこが', [
        morphemeFixture({ surface: '猫', reading: 'ねこ', jishoUrl: 'https://jisho.org/search/%E7%8C%AB' }),
        morphemeFixture({ surface: 'が', reading: 'が', posJa: '助詞・格助詞', posEn: 'particle (case-marking)', jishoUrl: 'https://jisho.org/search/%E3%81%8C' }),
      ]),
      b(1, '魚を', 2, 0.55, 'さかなを', [
        morphemeFixture(),
        morphemeFixture({ surface: 'を', reading: 'を', posJa: '助詞・格助詞', posEn: 'particle (case-marking)', jishoUrl: 'https://jisho.org/search/%E3%82%92' }),
      ]),
      b(2, '食べた。', null, null, 'たべた。', [
        morphemeFixture({
          surface: '食べ', reading: 'たべ', posJa: '動詞・自立', posEn: 'verb (independent)',
          baseForm: '食べる', conjugationJa: '連用形', conjugationEn: 'continuative',
          jishoUrl: 'https://jisho.org/search/%E9%A3%9F%E3%81%B9%E3%82%8B',
        }),
        morphemeFixture({ surface: '。', reading: null, posJa: '記号・句点', posEn: 'symbol (period)', jishoUrl: null }),
      ]),
    ],
  }
}

/** これは(→1, forced attachment, kana-only so no furigana) 何。(root) */
export function forcedSentenceFixture(): ParsedSentence {
  return {
    text: 'これは何。',
    error: null,
    bunsetsu: [
      { index: 0, surface: 'これは', head: 1, probability: null, forced: true, reading: '', morphemes: [morphemeFixture({ surface: 'これ', reading: 'これ', posJa: '名詞・代名詞', posEn: 'noun (pronoun)', jishoUrl: 'https://jisho.org/search/%E3%81%93%E3%82%8C' })] },
      { index: 1, surface: '何。', head: null, probability: null, forced: false, reading: 'なに。', morphemes: [morphemeFixture({ surface: '何', reading: 'なに', jishoUrl: 'https://jisho.org/search/%E4%BD%95' })] },
    ],
  }
}

import type { BunsetsuVM, MorphemeVM, ParsedSentence } from '../src/lib/types'
import type { RelationLabel } from '../src/lib/relations'

export function morphemeFixture(over: Partial<MorphemeVM> = {}): MorphemeVM {
  return {
    surface: '魚',
    reading: 'さかな',
    posJa: '名詞・一般',
    baseForm: null,
    conjugationJa: null,
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
  relation: RelationLabel | null = null,
): BunsetsuVM {
  return { index, surface, head, probability, forced: false, reading, morphemes, relation }
}

/** 猫が(→2, P=.95) 魚を(→2, P=.55 = uncertain) 食べた。(root) */
export function sentenceFixture(): ParsedSentence {
  return {
    text: '猫が魚を食べた。',
    error: null,
    bunsetsu: [
      b(0, '猫が', 2, 0.95, 'ねこが', [
        morphemeFixture({ surface: '猫', reading: 'ねこ', jishoUrl: 'https://jisho.org/search/%E7%8C%AB' }),
        morphemeFixture({ surface: 'が', reading: 'が', posJa: '助詞・格助詞', jishoUrl: 'https://jisho.org/search/%E3%81%8C' }),
      ]),
      b(1, '魚を', 2, 0.55, 'さかなを', [
        morphemeFixture(),
        morphemeFixture({ surface: 'を', reading: 'を', posJa: '助詞・格助詞', jishoUrl: 'https://jisho.org/search/%E3%82%92' }),
      ]),
      b(2, '食べた。', null, null, 'たべた。', [
        morphemeFixture({
          surface: '食べ', reading: 'たべ', posJa: '動詞・自立',
          baseForm: '食べる', conjugationJa: '連用形',
          jishoUrl: 'https://jisho.org/search/%E9%A3%9F%E3%81%B9%E3%82%8B',
        }),
        morphemeFixture({ surface: '。', reading: null, posJa: '記号・句点', jishoUrl: null }),
      ]),
    ],
  }
}

/** 新しい(→1) 映画を(→2, P=.55 = uncertain) 見に(→3) 行きました。(root); chain from 0 runs 0→1→2→3 */
export function chainSentenceFixture(): ParsedSentence {
  return {
    text: '新しい映画を見に行きました。',
    error: null,
    bunsetsu: [
      b(0, '新しい', 1, 0.9, 'あたらしい', [morphemeFixture({ surface: '新しい', reading: 'あたらしい', posJa: '形容詞・自立' })]),
      b(1, '映画を', 2, 0.55, 'えいがを', [
        morphemeFixture({ surface: '映画', reading: 'えいが' }),
        morphemeFixture({ surface: 'を', reading: 'を', posJa: '助詞・格助詞', jishoUrl: 'https://jisho.org/search/%E3%82%92' }),
      ]),
      b(2, '見に', 3, 0.9, 'みに', [morphemeFixture({ surface: '見', reading: 'み' })]),
      b(3, '行きました。', null, null, 'いきました。', [morphemeFixture({ surface: '行きました', reading: 'いきました' })]),
    ],
  }
}

/** これは(→1, forced attachment, kana-only so no furigana) 何。(root) */
export function forcedSentenceFixture(): ParsedSentence {
  return {
    text: 'これは何。',
    error: null,
    bunsetsu: [
      { index: 0, surface: 'これは', head: 1, probability: null, forced: true, reading: '', morphemes: [morphemeFixture({ surface: 'これ', reading: 'これ', posJa: '名詞・代名詞', jishoUrl: 'https://jisho.org/search/%E3%81%93%E3%82%8C' })], relation: null },
      { index: 1, surface: '何。', head: null, probability: null, forced: false, reading: 'なに。', morphemes: [morphemeFixture({ surface: '何', reading: 'なに', jishoUrl: 'https://jisho.org/search/%E4%BD%95' })], relation: null },
    ],
  }
}

import type { BunsetsuVM, MorphemeVM } from './types'

/** canned sentence for the help dialog's live demo — never parsed at runtime */
export const HELP_SENTENCE: BunsetsuVM[] = [
  { index: 0, surface: '新しい', head: 1, probability: 0.55, forced: false, reading: 'あたらしい', morphemes: [], relation: 'relclause' },
  { index: 1, surface: '映画を', head: 2, probability: 0.92, forced: false, reading: 'えいがを', morphemes: [], relation: 'object' },
  { index: 2, surface: '見に', head: 3, probability: 0.97, forced: false, reading: 'みに', morphemes: [], relation: 'linkedclause' },
  { index: 3, surface: '行きました。', head: null, probability: null, forced: false, reading: 'いきました。', morphemes: [], relation: 'predicate' },
]

/** canned word for the help dialog's parts example — 行きましょうね。 */
export const HELP_PARTS: MorphemeVM[] = [
  { surface: '行き', reading: 'いき', posJa: '動詞・自立', baseForm: '行く', conjugationJa: '連用形', jishoUrl: null },
  { surface: 'ましょ', reading: 'ましょ', posJa: '助動詞', baseForm: 'ます', conjugationJa: '未然ウ接続', jishoUrl: null },
  { surface: 'う', reading: 'う', posJa: '助動詞', baseForm: null, conjugationJa: '基本形', jishoUrl: null },
  { surface: 'ね', reading: 'ね', posJa: '助詞・終助詞', baseForm: null, conjugationJa: null, jishoUrl: null },
  { surface: '。', reading: null, posJa: '記号・句点', baseForm: null, conjugationJa: null, jishoUrl: null },
]

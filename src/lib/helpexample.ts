import type { BunsetsuVM } from './types'

/** canned sentence for the help dialog's live demo — never parsed at runtime */
export const HELP_SENTENCE: BunsetsuVM[] = [
  { index: 0, surface: '新しい', head: 1, probability: 0.55, forced: false, reading: 'あたらしい', morphemes: [] },
  { index: 1, surface: '映画を', head: 2, probability: 0.92, forced: false, reading: 'えいがを', morphemes: [] },
  { index: 2, surface: '見に', head: 3, probability: 0.97, forced: false, reading: 'みに', morphemes: [] },
  { index: 3, surface: '行きました。', head: null, probability: null, forced: false, reading: 'いきました。', morphemes: [] },
]

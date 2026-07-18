export interface MorphemeVM {
  surface: string
  /** hiragana reading, null when the dictionary has none (unknown words) */
  reading: string | null
  posJa: string
  posEn: string | null
  /** dictionary form, only when it differs from surface */
  baseForm: string | null
  conjugationJa: string | null
  conjugationEn: string | null
  /** null for punctuation/symbols */
  jishoUrl: string | null
}

export interface BunsetsuVM {
  index: number
  surface: string
  head: number | null
  /** attachment probability 0..1, null for root / missing / NaN */
  probability: number | null
  /** true when attached by sasara's end-of-sentence fallback */
  forced: boolean
  /** hiragana furigana for the whole bunsetsu, '' when it contains no kanji */
  reading: string
  morphemes: MorphemeVM[]
}

export interface ParsedSentence {
  text: string
  bunsetsu: BunsetsuVM[]
  /** non-null when this sentence failed to parse */
  error: string | null
}

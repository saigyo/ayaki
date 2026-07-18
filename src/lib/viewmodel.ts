import type { Bunsetsu, KuromojiToken } from 'sasara'
import { conjugationLabel, hasKanji, posLabel, toHiragana } from './pos'
import { jishoUrl } from './links'
import type { BunsetsuVM, MorphemeVM, ParsedSentence } from './types'

export const LOW_CONFIDENCE = 0.7

export function isUncertain(b: BunsetsuVM): boolean {
  return b.forced || (b.probability !== null && b.probability < LOW_CONFIDENCE)
}

/**
 * Human-readable confidence descriptor for a bunsetsu's attachment, shared by the
 * arc/tree tooltips and the inspector. Null when there is nothing to say (root,
 * or no confidence data). Forced attachments get a label even without a
 * probability — being forced is itself the signal.
 */
export function confidenceLabel(b: BunsetsuVM): string | null {
  if (b.probability !== null) return `P = ${Math.round(b.probability * 100)}%${b.forced ? ' (forced)' : ''}`
  return b.forced ? 'forced attachment (end-of-sentence fallback)' : null
}

interface ConfidenceLike {
  probability?: number
  forced?: boolean
}

function toMorpheme(t: KuromojiToken): MorphemeVM {
  const reading = t.reading && t.reading !== '*' ? toHiragana(t.reading) : null
  const base = t.basic_form && t.basic_form !== '*' && t.basic_form !== t.surface_form ? t.basic_form : null
  const pos = posLabel(t.pos, t.pos_detail_1)
  const conj = conjugationLabel(t.conjugated_form)
  return {
    surface: t.surface_form,
    reading,
    posJa: pos.ja,
    posEn: pos.en,
    baseForm: base,
    conjugationJa: conj?.ja ?? null,
    conjugationEn: conj?.en ?? null,
    jishoUrl: t.pos === '記号' ? null : jishoUrl(base ?? t.surface_form),
  }
}

function bunsetsuReading(tokens: KuromojiToken[], surface: string): string {
  if (!hasKanji(surface)) return ''
  return tokens.map((t) => (t.reading && t.reading !== '*' ? toHiragana(t.reading) : t.surface_form)).join('')
}

export function toParsedSentence(text: string, bunsetsu: Bunsetsu[]): ParsedSentence {
  return {
    text,
    error: null,
    bunsetsu: bunsetsu.map((b): BunsetsuVM => {
      const conf = (b as Bunsetsu & { confidence?: ConfidenceLike }).confidence
      const p = conf?.probability
      return {
        index: b.index,
        surface: b.surface,
        head: b.head,
        probability: typeof p === 'number' && !Number.isNaN(p) ? p : null,
        forced: conf?.forced ?? false,
        reading: bunsetsuReading(b.tokens, b.surface),
        morphemes: b.tokens.map(toMorpheme),
      }
    }),
  }
}

export function errorSentence(text: string, message: string): ParsedSentence {
  return { text, bunsetsu: [], error: message }
}

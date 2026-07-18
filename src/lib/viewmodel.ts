import type { Bunsetsu, KuromojiToken } from 'sasara'
import { combinePos, hasKanji, toHiragana } from './pos'
import { jishoUrl } from './links'
import { t } from './i18n.svelte'
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
  if (b.probability !== null) {
    const p = Math.round(b.probability * 100)
    return b.forced ? t('confProbForced', { p }) : t('confProb', { p })
  }
  return b.forced ? t('confForcedOnly') : null
}

interface ConfidenceLike {
  probability?: number
  forced?: boolean
}

function toMorpheme(t2: KuromojiToken): MorphemeVM {
  const reading = t2.reading && t2.reading !== '*' ? toHiragana(t2.reading) : null
  const base = t2.basic_form && t2.basic_form !== '*' && t2.basic_form !== t2.surface_form ? t2.basic_form : null
  const posJa = combinePos(t2.pos, t2.pos_detail_1)
  const conjugationJa = t2.conjugated_form && t2.conjugated_form !== '*' ? t2.conjugated_form : null
  return {
    surface: t2.surface_form,
    reading,
    posJa,
    baseForm: base,
    conjugationJa,
    jishoUrl: t2.pos === '記号' ? null : jishoUrl(base ?? t2.surface_form),
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

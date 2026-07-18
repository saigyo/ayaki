/** Katakana → hiragana (ァ..ヶ shifted by 0x60); everything else unchanged. */
export function toHiragana(s: string): string {
  return [...s]
    .map((c) => {
      const code = c.codePointAt(0)!
      return code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : c
    })
    .join('')
}

export function hasKanji(s: string): boolean {
  return /[々㐀-鿿]/.test(s)
}

export interface Label {
  ja: string
  en: string | null
}

const POS_EN: Record<string, string> = {
  名詞: 'noun',
  動詞: 'verb',
  形容詞: 'i-adjective',
  副詞: 'adverb',
  連体詞: 'adnominal',
  接続詞: 'conjunction',
  助詞: 'particle',
  助動詞: 'auxiliary verb',
  感動詞: 'interjection',
  記号: 'symbol',
  接頭詞: 'prefix',
  フィラー: 'filler',
  その他: 'other',
  未知語: 'unknown word',
}

const DETAIL_EN: Record<string, string> = {
  一般: 'general',
  固有名詞: 'proper noun',
  代名詞: 'pronoun',
  数: 'number',
  サ変接続: 'suru-verb noun',
  形容動詞語幹: 'na-adjective stem',
  副詞可能: 'adverbial',
  接尾: 'suffix',
  非自立: 'dependent',
  自立: 'independent',
  格助詞: 'case-marking',
  係助詞: 'binding',
  副助詞: 'adverbial',
  終助詞: 'sentence-final',
  接続助詞: 'conjunctive',
  並立助詞: 'parallel',
  準体助詞: 'nominalizing',
  連体化: 'adnominalizing',
  副詞化: 'adverbializing',
  人名: 'person name',
  地域: 'place name',
  組織: 'organization',
  句点: 'period',
  読点: 'comma',
  括弧開: 'open bracket',
  括弧閉: 'close bracket',
  空白: 'space',
  アルファベット: 'alphabet',
  引用: 'quotation',
  特殊: 'special',
}

export function posLabel(pos: string, detail1?: string): Label {
  const hasDetail = !!detail1 && detail1 !== '*'
  const ja = hasDetail ? `${pos}・${detail1}` : pos
  const posEn = POS_EN[pos] ?? null
  if (!posEn) return { ja, en: null }
  const detailEn = hasDetail ? DETAIL_EN[detail1] : undefined
  return { ja, en: detailEn ? `${posEn} (${detailEn})` : posEn }
}

const CONJ_EN: Record<string, string> = {
  基本形: 'plain form',
  連用形: 'continuative',
  連用タ接続: 'ta-continuative',
  未然形: 'irrealis',
  仮定形: 'conditional',
  体言接続: 'attributive',
  命令ｅ: 'imperative',
  命令ｉ: 'imperative',
  命令ｒｏ: 'imperative',
  命令ｙｏ: 'imperative',
  未然ウ接続: 'volitional stem',
  ガル接続: 'garu-stem',
}

export function conjugationLabel(form?: string): Label | null {
  if (!form || form === '*') return null
  return { ja: form, en: CONJ_EN[form] ?? null }
}

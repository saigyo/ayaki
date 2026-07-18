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

import type { Locale } from './i18n.svelte'

type Gloss = { en: string; de: string; zh: string }
type GlossLocale = keyof Gloss

const POS_GLOSS: Record<string, Gloss> = {
  名詞: { en: 'noun', de: 'Nomen', zh: '名词' },
  動詞: { en: 'verb', de: 'Verb', zh: '动词' },
  形容詞: { en: 'i-adjective', de: 'I-Adjektiv', zh: '形容词（イ形）' },
  副詞: { en: 'adverb', de: 'Adverb', zh: '副词' },
  連体詞: { en: 'adnominal', de: 'Adnominal', zh: '连体词' },
  接続詞: { en: 'conjunction', de: 'Konjunktion', zh: '接续词' },
  助詞: { en: 'particle', de: 'Partikel', zh: '助词' },
  助動詞: { en: 'auxiliary verb', de: 'Hilfsverb', zh: '助动词' },
  感動詞: { en: 'interjection', de: 'Interjektion', zh: '感叹词' },
  記号: { en: 'symbol', de: 'Symbol', zh: '符号' },
  接頭詞: { en: 'prefix', de: 'Präfix', zh: '接头词' },
  フィラー: { en: 'filler', de: 'Füllwort', zh: '填充词' },
  その他: { en: 'other', de: 'Sonstiges', zh: '其他' },
  未知語: { en: 'unknown word', de: 'unbekanntes Wort', zh: '未知词' },
}

const DETAIL_GLOSS: Record<string, Gloss> = {
  一般: { en: 'general', de: 'allgemein', zh: '一般' },
  固有名詞: { en: 'proper noun', de: 'Eigenname', zh: '专有名词' },
  代名詞: { en: 'pronoun', de: 'Pronomen', zh: '代词' },
  数: { en: 'number', de: 'Zahl', zh: '数词' },
  サ変接続: { en: 'suru-verb noun', de: 'Suru-Verb-Nomen', zh: 'サ变动词名词' },
  形容動詞語幹: { en: 'na-adjective stem', de: 'Na-Adjektiv-Stamm', zh: '形容动词词干' },
  副詞可能: { en: 'adverbial', de: 'adverbial nutzbar', zh: '可作副词' },
  接尾: { en: 'suffix', de: 'Suffix', zh: '接尾词' },
  非自立: { en: 'dependent', de: 'gebunden', zh: '非独立' },
  自立: { en: 'independent', de: 'selbstständig', zh: '独立' },
  格助詞: { en: 'case-marking', de: 'kasusmarkierend', zh: '格助词' },
  係助詞: { en: 'binding', de: 'bindend', zh: '系助词' },
  副助詞: { en: 'adverbial', de: 'adverbial', zh: '副助词' },
  終助詞: { en: 'sentence-final', de: 'satzfinal', zh: '终助词' },
  接続助詞: { en: 'conjunctive', de: 'konjunktional', zh: '接续助词' },
  並立助詞: { en: 'parallel', de: 'parallel', zh: '并列助词' },
  準体助詞: { en: 'nominalizing', de: 'nominalisierend', zh: '准体助词' },
  連体化: { en: 'adnominalizing', de: 'adnominalisierend', zh: '连体化' },
  副詞化: { en: 'adverbializing', de: 'adverbialisierend', zh: '副词化' },
  人名: { en: 'person name', de: 'Personenname', zh: '人名' },
  地域: { en: 'place name', de: 'Ortsname', zh: '地名' },
  組織: { en: 'organization', de: 'Organisation', zh: '组织' },
  句点: { en: 'period', de: 'Punkt', zh: '句号' },
  読点: { en: 'comma', de: 'Komma', zh: '逗号' },
  括弧開: { en: 'open bracket', de: 'öffnende Klammer', zh: '左括号' },
  括弧閉: { en: 'close bracket', de: 'schließende Klammer', zh: '右括号' },
  空白: { en: 'space', de: 'Leerzeichen', zh: '空格' },
  アルファベット: { en: 'alphabet', de: 'Alphabet', zh: '字母' },
  引用: { en: 'quotation', de: 'Zitat', zh: '引用' },
  特殊: { en: 'special', de: 'Sonderzeichen', zh: '特殊' },
}

const CONJ_GLOSS: Record<string, Gloss> = {
  基本形: { en: 'plain form', de: 'Grundform', zh: '基本形' },
  連用形: { en: 'continuative', de: 'Verbindungsform', zh: '连用形' },
  連用タ接続: { en: 'ta-continuative', de: 'Ta-Verbindungsform', zh: '连用タ接续' },
  未然形: { en: 'irrealis', de: 'Irrealisform', zh: '未然形' },
  仮定形: { en: 'conditional', de: 'Konditionalform', zh: '假定形' },
  体言接続: { en: 'attributive', de: 'Attributivform', zh: '体言接续' },
  命令ｅ: { en: 'imperative', de: 'Imperativ', zh: '命令形' },
  命令ｉ: { en: 'imperative', de: 'Imperativ', zh: '命令形' },
  命令ｒｏ: { en: 'imperative', de: 'Imperativ', zh: '命令形' },
  命令ｙｏ: { en: 'imperative', de: 'Imperativ', zh: '命令形' },
  未然ウ接続: { en: 'volitional stem', de: 'Volitionalstamm', zh: '意志形词干' },
  ガル接続: { en: 'garu-stem', de: 'Garu-Stamm', zh: 'ガル接续' },
}

/** ZH glosses wrap details in fullwidth parentheses; EN/DE use halfwidth. */
function withDetail(locale: GlossLocale, pos: string, detail?: string): string {
  if (!detail) return pos
  return locale === 'zh' ? `${pos}（${detail}）` : `${pos} (${detail})`
}

export function combinePos(pos: string, detail1?: string): string {
  const hasDetail = !!detail1 && detail1 !== '*'
  return hasDetail ? `${pos}・${detail1}` : pos
}

export function posGloss(posJa: string, locale: Locale): string | null {
  if (locale === 'ja') return null
  const [pos, detail] = posJa.split('・')
  const posPart = POS_GLOSS[pos]?.[locale]
  if (!posPart) return null
  const detailPart = detail ? DETAIL_GLOSS[detail]?.[locale] : undefined
  return withDetail(locale, posPart, detailPart)
}

export function conjugationGloss(conjugationJa: string, locale: Locale): string | null {
  if (locale === 'ja') return null
  return CONJ_GLOSS[conjugationJa]?.[locale] ?? null
}

export const GLOSS_TABLES = { POS_GLOSS, DETAIL_GLOSS, CONJ_GLOSS }

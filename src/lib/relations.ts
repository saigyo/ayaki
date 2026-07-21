import type { MessageKey } from './i18n.svelte'

/**
 * Learner-facing relation labels for bunsetsu dependencies, rule-derived
 * from IPAdic morpheme evidence. Rules and their accuracy (90.3% UD-strict,
 * 91.9% learner-merged on 52k held-out UD-GSD arcs) are documented in
 * docs/relation-labels.md; scripts/relation-eval.ts re-measures them.
 */
export type RelationLabel =
  | 'subject'
  | 'topic'
  | 'object'
  | 'adverbial'
  | 'nounmod'
  | 'relclause'
  | 'linkedclause'
  | 'connector'
  | 'predicate'

/** display/legend order */
export const RELATION_LABELS: RelationLabel[] = [
  'subject', 'topic', 'object', 'adverbial', 'nounmod',
  'relclause', 'linkedclause', 'connector', 'predicate',
]

/** primary UD relation per label, for the Inspector's UD link.
 *  topic deliberately deviates from UD (which has no topic relation and
 *  forces は-phrases into nsubj/obl) — it links nsubj as "usually". */
export const RELATION_UD: Record<RelationLabel, string> = {
  subject: 'nsubj',
  topic: 'nsubj',
  object: 'obj',
  adverbial: 'obl',
  nounmod: 'nmod',
  relclause: 'acl',
  linkedclause: 'advcl',
  connector: 'cc',
  predicate: 'root',
}

export const RELATION_TERM_KEYS = {
  subject: 'relSubject',
  topic: 'relTopic',
  object: 'relObject',
  adverbial: 'relAdverbial',
  nounmod: 'relNounmod',
  relclause: 'relRelclause',
  linkedclause: 'relLinkedclause',
  connector: 'relConnector',
  predicate: 'relPredicate',
} as const satisfies Record<RelationLabel, MessageKey>

export const RELATION_EXPLAIN_KEYS = {
  subject: 'relSubjectExplain',
  topic: 'relTopicExplain',
  object: 'relObjectExplain',
  adverbial: 'relAdverbialExplain',
  nounmod: 'relNounmodExplain',
  relclause: 'relRelclauseExplain',
  linkedclause: 'relLinkedclauseExplain',
  connector: 'relConnectorExplain',
  predicate: 'relPredicateExplain',
} as const satisfies Record<RelationLabel, MessageKey>

/** structural view of a bunsetsu — BunsetsuVM satisfies this */
export interface RelationInput {
  morphemes: { surface: string; posJa: string }[]
  head: number | null
}

type M = { surface: string; posJa: string }

const pos = (m: M): string => m.posJa.split('・')[0]
const detail = (m: M): string => m.posJa.split('・')[1] ?? ''

const FUNC = new Set(['助詞', '助動詞', '記号', '接頭詞'])

/** first content morpheme (skipping particles, auxiliaries, symbols, prefixes) */
function contentHead(ms: M[]): M {
  return ms.find((m) => !FUNC.has(pos(m))) ?? ms[0]
}

/** trailing particle chain: contiguous 助詞 from the end, ignoring trailing 記号 */
function particleChain(ms: M[]): M[] {
  let i = ms.length - 1
  while (i >= 0 && pos(ms[i]) === '記号') i--
  const chain: M[] = []
  while (i >= 0 && pos(ms[i]) === '助詞') {
    chain.unshift(ms[i])
    i--
  }
  return chain
}

/** last morpheme before the particle chain (and trailing symbols) */
function preParticle(ms: M[]): M | null {
  let i = ms.length - 1
  while (i >= 0 && pos(ms[i]) === '記号') i--
  while (i >= 0 && pos(ms[i]) === '助詞') i--
  return i >= 0 ? ms[i] : null
}

/** the bunsetsu is (or ends in) a clause */
function isClausal(ms: M[]): boolean {
  const ch = contentHead(ms)
  if (pos(ch) === '動詞' || pos(ch) === '形容詞') return true
  if (ms.some((m) => pos(m) === '助動詞')) return true
  const pre = preParticle(ms)
  return pre !== null && (pos(pre) === '動詞' || pos(pre) === '形容詞')
}

/** adverb-capable content (今日/通常/ほとんど…): 副詞 or 名詞・副詞可能 */
function isAdverbialNoun(ms: M[]): boolean {
  const m = preParticle(ms) ?? contentHead(ms)
  return pos(m) === '副詞' || (pos(m) === '名詞' && detail(m) === '副詞可能')
}

export function bunsetsuRelation(all: RelationInput[], i: number): RelationLabel | null {
  const d = all[i].morphemes
  if (d.every((m) => pos(m) === '記号')) return null
  const headIdx = all[i].head
  if (headIdx === null) return 'predicate'
  const h = all[headIdx].morphemes
  const hHead = contentHead(h)
  // adverbial vs nounmod hinges on the head predicating; a root noun with
  // no copula (実兄。) still predicates, as does a サ変 noun used verbally
  const headIsPred =
    pos(hHead) === '動詞' || pos(hHead) === '形容詞' ||
    (pos(hHead) === '名詞' && detail(hHead) === 'サ変接続' && h.some((m) => pos(m) === '動詞')) ||
    h.some((m) => pos(m) === '助動詞') ||
    all[headIdx].head === null
  const headIsNoun = pos(hHead) === '名詞'
  const clausal = isClausal(d)
  const last = d[d.length - 1]
  const endsComma = last !== undefined && pos(last) === '記号' && detail(last) === '読点'

  // sentence-final particles carry no relation information
  const chain = particleChain(d).filter((m) => detail(m) !== '終助詞')

  if (chain.length > 0) {
    if (chain.some((m) => detail(m) === '接続助詞')) return 'linkedclause'
    const lastP = chain[chain.length - 1]
    // final attributive の (大会での, ALL999への, 同僚の)
    if (lastP.surface === 'の' && (detail(lastP) === '連体化' || detail(lastP) === '格助詞')) {
      return headIsPred && !headIsNoun ? 'subject' : 'nounmod'
    }
    // という quotative-attributive (出すという方法)
    if (lastP.surface === 'という') return headIsNoun ? 'relclause' : 'linkedclause'
    // か and friends after a clause (逃亡するか、) — IPAdic details are
    // combined strings like 副助詞／並立助詞／終助詞, hence the regex
    if (clausal && /副助詞|並立助詞|終助詞/.test(detail(lastP))) return 'linkedclause'
    // coordination (パンと/や): the conjunct inherits the phrase's role —
    // read it off the next sibling attached to the same head
    if (detail(lastP).includes('並立助詞')) {
      for (let j = i + 1; j < all.length; j++) {
        if (all[j].head !== headIdx) continue
        const label = bunsetsuRelation(all, j)
        if (label !== null) return label
      }
      return 'nounmod'
    }
    const caseP = chain.filter((m) => detail(m) === '格助詞')
    const lastCase = caseP[caseP.length - 1]
    if (lastCase) {
      const s = lastCase.surface
      if (s === 'を') return 'object'
      if (s === 'が') return 'subject'
      if (s === 'と') {
        if (clausal) return 'linkedclause'
        if (isAdverbialNoun(d)) return 'adverbial'
        return headIsNoun && !headIsPred ? 'nounmod' : 'adverbial'
      }
      if (clausal) return 'linkedclause'
      // na-adjective stem + に (非常に, 慎重に): clause-like modifier
      if (s === 'に') {
        const pre = preParticle(d)
        if (pre !== null && pos(pre) === '名詞' && detail(pre) === '形容動詞語幹') return 'linkedclause'
      }
      return headIsNoun && !headIsPred ? 'nounmod' : 'adverbial'
    }
    if (detail(lastP) === '係助詞') {
      if (isAdverbialNoun(d)) return 'adverbial'
      if (clausal) return 'linkedclause'
      return 'topic'
    }
    if (clausal) return 'linkedclause'
    return headIsNoun && !headIsPred ? 'nounmod' : 'adverbial'
  }

  const ch = contentHead(d)
  if (pos(ch) === '連体詞') return 'nounmod'
  if (pos(ch) === '副詞') return 'adverbial'
  if (pos(ch) === '接続詞') return 'connector'
  if (pos(ch) === '感動詞') return 'connector' // discourse interjection — closest group
  if (clausal) {
    // a clause before a noun modifies it (relative clause); a trailing
    // comma signals clause continuation (連用中止) instead
    return headIsNoun && !endsComma ? 'relclause' : 'linkedclause'
  }
  if (isAdverbialNoun(d) && headIsPred) return 'adverbial'
  return headIsPred ? 'adverbial' : 'nounmod'
}

# Relation Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Label every dependency with a learner-friendly relation badge (subject/topic/object/…), rule-derived from morpheme evidence, shown under the bunsetsu boxes in all three views and explained (with UD link) in the Inspector.

**Architecture:** A pure rule module `src/lib/relations.ts` computes a `RelationLabel` per bunsetsu from `{surface, posJa}` morphemes + head indices (the measured v4 rules — 90.3% UD-strict / 91.9% learner-merged on 52k held-out UD-GSD arcs). The viewmodel stores it on `BunsetsuVM`; the three views render badges gated by a new `showRelations` setting; the Inspector always shows a relation line. A versioned eval script re-measures the shipped rules against UD-GSD gold.

**Tech Stack:** Svelte 5, TypeScript, Vitest + Testing Library, tsx (via npx) for the eval script, Playwright for live-check/screenshots.

## Global Constraints

- Badge terms (verbatim, per locale — DO NOT paraphrase; copy byte-exact):
  en: `subject, topic, object, adverbial, noun modifier, relative clause, linked clause, connector, predicate`
  de: `Subjekt, Thema, Objekt, Adverbial, Attribut, Relativsatz, Nebensatz, Konnektor, Prädikat`
  ja: `主語, 主題, 目的語, 連用修飾語, 連体修飾語, 連体修飾節, 接続節, 接続詞, 述語`
  zh: `主语, 话题, 宾语, 状语, 定语, 定语从句, 连接分句, 连词, 谓语`
- `showRelations` defaults to **true**, is NOT part of share links.
- Diagram badges are `aria-hidden="true"` — accessible names of the bunsetsu groups stay the bare surface (existing tests/probes depend on it).
- The Inspector relation line shows regardless of `showRelations` (the setting governs diagram clutter only).
- All DOM queries in tests and Playwright scripts must be scoped (`main`, `.inspector`, `within(dialog)`) — the closed help dialog's demo is always mounted.
- German catalog strings: verify per-codepoint against this plan (three single-codepoint defects shipped historically).
- UD link URL pattern: `https://universaldependencies.org/u/dep/<code>.html`.
- Every commit message ends with the Co-Authored-By/Claude-Session trailer used on this branch.

---

### Task 1: Relation rule module + catalog terms

**Files:**
- Create: `src/lib/relations.ts`
- Modify: `src/lib/locales/en.ts`, `src/lib/locales/de.ts`, `src/lib/locales/ja.ts`, `src/lib/locales/zh.ts` (insert after the `partSymbolShort` key)
- Test: `tests/lib/relations.test.ts`

**Interfaces:**
- Consumes: `MessageKey` type from `src/lib/i18n.svelte` (type-only import).
- Produces (later tasks rely on these exact names):
  `type RelationLabel = 'subject'|'topic'|'object'|'adverbial'|'nounmod'|'relclause'|'linkedclause'|'connector'|'predicate'`,
  `interface RelationInput { morphemes: { surface: string; posJa: string }[]; head: number | null }`,
  `RELATION_LABELS: RelationLabel[]`, `RELATION_UD: Record<RelationLabel, string>`,
  `RELATION_TERM_KEYS`, `RELATION_EXPLAIN_KEYS` (both `Record<RelationLabel, MessageKey>`),
  `bunsetsuRelation(all: RelationInput[], i: number): RelationLabel | null`.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/relations.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  bunsetsuRelation,
  RELATION_LABELS,
  RELATION_TERM_KEYS,
  RELATION_EXPLAIN_KEYS,
  RELATION_UD,
  type RelationInput,
} from '../../src/lib/relations'

/** shorthand: bunsetsu from [surface, posJa] pairs */
function b(head: number | null, ...ms: [string, string][]): RelationInput {
  return { head, morphemes: ms.map(([surface, posJa]) => ({ surface, posJa })) }
}

const PRED = b(null, ['行き', '動詞・自立'], ['まし', '助動詞'], ['た', '助動詞'], ['。', '記号・句点'])
const NOUN_PRED = b(null, ['映画', '名詞・一般'], ['を', '助詞・格助詞'])

describe('bunsetsuRelation particle rules', () => {
  it('が → subject', () => {
    const all = [b(1, ['猫', '名詞・一般'], ['が', '助詞・格助詞']), PRED]
    expect(bunsetsuRelation(all, 0)).toBe('subject')
  })
  it('を → object', () => {
    const all = [b(1, ['魚', '名詞・一般'], ['を', '助詞・格助詞']), PRED]
    expect(bunsetsuRelation(all, 0)).toBe('object')
  })
  it('bare は → topic', () => {
    const all = [b(1, ['私', '名詞・代名詞'], ['は', '助詞・係助詞']), PRED]
    expect(bunsetsuRelation(all, 0)).toBe('topic')
  })
  it('adverb-capable noun + は → adverbial (現在は)', () => {
    const all = [b(1, ['現在', '名詞・副詞可能'], ['は', '助詞・係助詞']), PRED]
    expect(bunsetsuRelation(all, 0)).toBe('adverbial')
  })
  it('に → adverbial against a predicate', () => {
    const all = [b(1, ['公園', '名詞・一般'], ['に', '助詞・格助詞']), PRED]
    expect(bunsetsuRelation(all, 0)).toBe('adverbial')
  })
  it('case particle against a plain noun head → noun modifier (50周年ソングに変更後)', () => {
    const all = [b(1, ['ソング', '名詞・一般'], ['に', '助詞・格助詞']), b(null, ['変更', '名詞・サ変接続'], ['後', '名詞・接尾'])]
    // head is a サ変 noun WITHOUT a following verb → nominal, not predicate…
    // …but it is also the root, and the root always predicates. Use a non-root head:
    const all2 = [b(1, ['ソング', '名詞・一般'], ['に', '助詞・格助詞']), b(2, ['変更', '名詞・サ変接続'], ['後', '名詞・接尾']), PRED]
    expect(bunsetsuRelation(all2, 0)).toBe('nounmod')
    void all
  })
  it('の → noun modifier', () => {
    const all = [b(1, ['同僚', '名詞・一般'], ['の', '助詞・連体化']), b(2, ['先生', '名詞・一般'], ['が', '助詞・格助詞']), PRED]
    expect(bunsetsuRelation(all, 0)).toBe('nounmod')
  })
  it('compound には keeps the case particle rule (ためには is clausal → linked clause)', () => {
    const all = [b(1, ['する', '動詞・自立'], ['ため', '名詞・非自立'], ['に', '助詞・格助詞'], ['は', '助詞・係助詞']), PRED]
    expect(bunsetsuRelation(all, 0)).toBe('linkedclause')
  })
  it('接続助詞 (ので) → linked clause', () => {
    const all = [b(1, ['降っ', '動詞・自立'], ['た', '助動詞'], ['ので', '助詞・接続助詞']), PRED]
    expect(bunsetsuRelation(all, 0)).toBe('linkedclause')
  })
  it('quotative と after a clause → linked clause', () => {
    const all = [b(1, ['思っ', '動詞・自立'], ['た', '助動詞'], ['と', '助詞・格助詞']), PRED]
    expect(bunsetsuRelation(all, 0)).toBe('linkedclause')
  })
  it('comitative と on a noun → adverbial', () => {
    const all = [b(1, ['友達', '名詞・一般'], ['と', '助詞・格助詞']), PRED]
    expect(bunsetsuRelation(all, 0)).toBe('adverbial')
  })
  it('並立助詞 と inherits the next sibling on the same head (coordination)', () => {
    const all = [
      b(2, ['すみれ', '名詞・固有名詞'], ['と', '助詞・並立助詞']),
      b(2, ['彩', '名詞・固有名詞'], ['は', '助詞・係助詞']),
      PRED,
    ]
    expect(bunsetsuRelation(all, 0)).toBe('topic')
    expect(bunsetsuRelation(all, 1)).toBe('topic')
  })
  it('並立助詞 without a same-head sibling falls back to noun modifier', () => {
    const all = [b(1, ['パン', '名詞・一般'], ['や', '助詞・並立助詞']), PRED]
    expect(bunsetsuRelation(all, 0)).toBe('nounmod')
  })
  it('という before a noun → relative clause', () => {
    const all = [b(1, ['出す', '動詞・自立'], ['という', '助詞・格助詞']), b(2, ['方法', '名詞・一般'], ['が', '助詞・格助詞']), PRED]
    expect(bunsetsuRelation(all, 0)).toBe('relclause')
  })
  it('形容動詞語幹 + に → linked clause (非常に)', () => {
    const all = [b(1, ['非常', '名詞・形容動詞語幹'], ['に', '助詞・格助詞']), PRED]
    expect(bunsetsuRelation(all, 0)).toBe('linkedclause')
  })
  it('終助詞 is ignored (ね carries no relation)', () => {
    const all = [b(1, ['猫', '名詞・一般'], ['が', '助詞・格助詞'], ['ね', '助詞・終助詞']), PRED]
    expect(bunsetsuRelation(all, 0)).toBe('subject')
  })
})

describe('bunsetsuRelation particle-less rules', () => {
  it('root → predicate', () => {
    expect(bunsetsuRelation([PRED], 0)).toBe('predicate')
  })
  it('root noun without copula still predicates (実兄。): は before it → topic', () => {
    const all = [b(1, ['彼', '名詞・代名詞'], ['は', '助詞・係助詞']), b(null, ['実兄', '名詞・一般'], ['。', '記号・句点'])]
    expect(bunsetsuRelation(all, 0)).toBe('topic')
  })
  it('連体詞 → noun modifier', () => {
    const all = [b(1, ['この', '連体詞'], ), b(2, ['本', '名詞・一般'], ['を', '助詞・格助詞']), PRED]
    expect(bunsetsuRelation(all, 0)).toBe('nounmod')
  })
  it('副詞 → adverbial', () => {
    const all = [b(1, ['ゆっくり', '副詞・助詞類接続']), PRED]
    expect(bunsetsuRelation(all, 0)).toBe('adverbial')
  })
  it('接続詞 → connector', () => {
    const all = [b(1, ['しかし', '接続詞']), PRED]
    expect(bunsetsuRelation(all, 0)).toBe('connector')
  })
  it('clause before a noun → relative clause (新しい映画)', () => {
    const all = [b(1, ['新しい', '形容詞・自立']), b(2, ['映画', '名詞・一般'], ['を', '助詞・格助詞']), PRED]
    expect(bunsetsuRelation(all, 0)).toBe('relclause')
  })
  it('clause ending in 読点 → linked clause even before a noun (連用中止)', () => {
    const all = [b(1, ['あり', '動詞・自立'], ['、', '記号・読点']), b(2, ['必要', '名詞・一般'], ['が', '助詞・格助詞']), PRED]
    expect(bunsetsuRelation(all, 0)).toBe('linkedclause')
  })
  it('clause before a predicate → linked clause', () => {
    const all = [b(1, ['見', '動詞・自立'], ['に', '助詞・格助詞']), PRED]
    expect(bunsetsuRelation(all, 0)).toBe('linkedclause')
  })
  it('bare adverb-capable noun before predicate → adverbial (昨日、)', () => {
    const all = [b(1, ['昨日', '名詞・副詞可能'], ['、', '記号・読点']), PRED]
    expect(bunsetsuRelation(all, 0)).toBe('adverbial')
  })
  it('bare plain noun before noun → noun modifier', () => {
    const all = [b(1, ['冬眠', '名詞・サ変接続'], ['、', '記号・読点']), b(2, ['復活', '名詞・サ変接続'], ['を', '助詞・格助詞']), PRED]
    expect(bunsetsuRelation(all, 0)).toBe('nounmod')
  })
  it('サ変 noun + verb head is a predicate (意気投合し)', () => {
    const all = [b(1, ['夕子', '名詞・固有名詞'], ['と', '助詞・格助詞']), b(null, ['意気投合', '名詞・サ変接続'], ['し', '動詞・自立'], ['、', '記号・読点'])]
    expect(bunsetsuRelation(all, 0)).toBe('adverbial')
  })
  it('symbol-only bunsetsu → null', () => {
    const all = [b(1, ['「', '記号・括弧開']), PRED]
    expect(bunsetsuRelation(all, 0)).toBeNull()
  })
  it('contentHead skips 接頭詞 (重富家も heads as 名詞)', () => {
    const all = [b(1, ['成立', '名詞・サ変接続'], ['し', '動詞・自立'], ['た', '助動詞']), b(2, ['重', '接頭詞・名詞接続'], ['富家', '名詞・固有名詞'], ['も', '助詞・係助詞']), PRED]
    expect(bunsetsuRelation(all, 0)).toBe('relclause')
  })
})

describe('canonical sentences', () => {
  it('私は食べさせられたくなかったので、帰りました。', () => {
    const all = [
      b(2, ['私', '名詞・代名詞'], ['は', '助詞・係助詞']),
      b(2, ['食べ', '動詞・自立'], ['させ', '動詞・接尾'], ['られ', '動詞・接尾'], ['たく', '助動詞'], ['なかっ', '助動詞'], ['た', '助動詞'], ['ので', '助詞・接続助詞'], ['、', '記号・読点']),
      b(null, ['帰り', '動詞・自立'], ['まし', '助動詞'], ['た', '助動詞'], ['。', '記号・句点']),
    ]
    expect(all.map((_, i) => bunsetsuRelation(all, i))).toEqual(['topic', 'linkedclause', 'predicate'])
  })
})

describe('metadata maps', () => {
  it('display order covers all labels exactly once', () => {
    expect(RELATION_LABELS).toEqual(['subject', 'topic', 'object', 'adverbial', 'nounmod', 'relclause', 'linkedclause', 'connector', 'predicate'])
  })
  it('every label has term key, explain key, and UD code', () => {
    for (const l of RELATION_LABELS) {
      expect(RELATION_TERM_KEYS[l]).toBeTruthy()
      expect(RELATION_EXPLAIN_KEYS[l]).toBeTruthy()
      expect(RELATION_UD[l]).toMatch(/^[a-z]+$/)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/relations.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/relations`.

- [ ] **Step 3: Create `src/lib/relations.ts`**

```ts
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
        if (all[j].head === headIdx) return bunsetsuRelation(all, j)
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
```

- [ ] **Step 4: Add the catalog keys**

In each locale file, insert directly after the `partSymbolShort` line. `en.ts`:

```ts
  relSubject: 'subject',
  relTopic: 'topic',
  relObject: 'object',
  relAdverbial: 'adverbial',
  relNounmod: 'noun modifier',
  relRelclause: 'relative clause',
  relLinkedclause: 'linked clause',
  relConnector: 'connector',
  relPredicate: 'predicate',
  relSubjectExplain: 'who or what does or is something (が)',
  relTopicExplain: 'what the sentence is about (は/も) — often also its subject',
  relObjectExplain: 'what the action directly acts on (を)',
  relAdverbialExplain: 'when, where, how, with whom — circumstances of the action',
  relNounmodExplain: 'modifies the following noun (の and similar)',
  relRelclauseExplain: 'a clause that describes the following noun',
  relLinkedclauseExplain: 'a clause linked to the main clause (て, ので, quoting と, …)',
  relConnectorExplain: 'connects the sentence to what came before',
  relPredicateExplain: 'the core of the sentence — everything ultimately attaches here',
```

`de.ts`:

```ts
  relSubject: 'Subjekt',
  relTopic: 'Thema',
  relObject: 'Objekt',
  relAdverbial: 'Adverbial',
  relNounmod: 'Attribut',
  relRelclause: 'Relativsatz',
  relLinkedclause: 'Nebensatz',
  relConnector: 'Konnektor',
  relPredicate: 'Prädikat',
  relSubjectExplain: 'wer oder was etwas tut oder ist (が)',
  relTopicExplain: 'worum es im Satz geht (は/も) — oft zugleich das Subjekt',
  relObjectExplain: 'worauf sich die Handlung direkt richtet (を)',
  relAdverbialExplain: 'wann, wo, wie, mit wem — Umstände der Handlung',
  relNounmodExplain: 'bestimmt das folgende Nomen näher (の und Ähnliches)',
  relRelclauseExplain: 'ein Satz, der das folgende Nomen beschreibt',
  relLinkedclauseExplain: 'ein mit dem Hauptsatz verbundener Satz (て, ので, zitierendes と, …)',
  relConnectorExplain: 'verbindet den Satz mit dem Vorangegangenen',
  relPredicateExplain: 'der Kern des Satzes — an ihm hängt letztlich alles',
```

`ja.ts`:

```ts
  relSubject: '主語',
  relTopic: '主題',
  relObject: '目的語',
  relAdverbial: '連用修飾語',
  relNounmod: '連体修飾語',
  relRelclause: '連体修飾節',
  relLinkedclause: '接続節',
  relConnector: '接続詞',
  relPredicate: '述語',
  relSubjectExplain: '動作や状態の主体（が）',
  relTopicExplain: '文の話題（は・も）— 多くは主語を兼ねる',
  relObjectExplain: '動作が直接およぶ対象（を）',
  relAdverbialExplain: 'いつ・どこで・どのように — 動作の状況',
  relNounmodExplain: '後ろの名詞を修飾する（の など）',
  relRelclauseExplain: '後ろの名詞を修飾する節',
  relLinkedclauseExplain: '主節につながる節（て・ので・引用の と など）',
  relConnectorExplain: '前の文とのつながりを示す',
  relPredicateExplain: '文の中心 — すべてが最終的にここに係る',
```

`zh.ts`:

```ts
  relSubject: '主语',
  relTopic: '话题',
  relObject: '宾语',
  relAdverbial: '状语',
  relNounmod: '定语',
  relRelclause: '定语从句',
  relLinkedclause: '连接分句',
  relConnector: '连词',
  relPredicate: '谓语',
  relSubjectExplain: '动作或状态的主体（が）',
  relTopicExplain: '句子谈论的对象（は・も）— 通常也是主语',
  relObjectExplain: '动作直接涉及的对象（を）',
  relAdverbialExplain: '何时、何地、如何 — 动作的状况',
  relNounmodExplain: '修饰后面的名词（の 等）',
  relRelclauseExplain: '修饰后面名词的从句',
  relLinkedclauseExplain: '与主句相连的从句（て、ので、引用的 と 等）',
  relConnectorExplain: '连接前文',
  relPredicateExplain: '句子的核心 — 一切最终都归于此处',
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/lib/relations.test.ts` → PASS (all cases).
Run: `npm run check` → no errors (the `satisfies` clauses prove all 18 keys exist in every catalog via parity typing).

- [ ] **Step 6: Commit**

```bash
git add src/lib/relations.ts src/lib/locales/*.ts tests/lib/relations.test.ts
git commit -m "feat: rule-based bunsetsu relation labeler with localized terms"
```

---

### Task 2: Versioned evaluation script + background doc

**Files:**
- Create: `scripts/relation-eval.ts`
- Create: `docs/relation-labels.md`
- Modify: `README.md` (add pointer line directly below the attachment-confidence pointer)

**Interfaces:**
- Consumes: `bunsetsuRelation`, `RelationInput`, `RelationLabel` from `src/lib/relations.ts` (Task 1); `combinePos` from `src/lib/pos.ts`; sasara checkout's `train/align.js` (dynamic import).
- Produces: `npx tsx scripts/relation-eval.ts [conllu] [sasara-dir]` printing accuracy tables; the doc.

- [ ] **Step 1: Create `scripts/relation-eval.ts`**

```ts
/**
 * Measures the shipped relation labeler (src/lib/relations.ts) against
 * UD_Japanese-GSD gold trees. See docs/relation-labels.md for method and
 * reference numbers.
 *
 *   npx tsx scripts/relation-eval.ts [conllu-file] [sasara-dir]
 *
 * Requires a sasara checkout (default ../sasara) with GSD downloaded
 * (npx tsx train/download-gsd.ts in that checkout). Gold bunsetsu and
 * their relations are derived from the treebank exactly the way sasara
 * derives its training gold: tokens grouped by the BunsetuBILabel MISC
 * field; each bunsetsu has exactly one token whose UD head lies outside
 * the bunsetsu, and that token's deprel is the bunsetsu-level relation.
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { bunsetsuRelation, type RelationInput, type RelationLabel } from '../src/lib/relations'
import { combinePos } from '../src/lib/pos'

const sasaraDir = resolve(process.argv[3] ?? '../sasara')
const conllu = process.argv[2] ?? resolve(sasaraDir, 'train/data/ja_gsd-ud-dev.conllu')

/** gold UD label groups per learner label (learner-merged scoring) */
const GOLD_GROUPS: Record<RelationLabel, string[]> = {
  subject: ['nsubj', 'csubj'],
  topic: ['nsubj', 'obl', 'dislocated'], // UD has no topic; score against all labels UD uses for は-phrases
  object: ['obj', 'iobj'],
  adverbial: ['obl', 'advmod'],
  nounmod: ['nmod', 'det', 'amod', 'nummod', 'compound', 'appos'],
  relclause: ['acl'],
  linkedclause: ['advcl', 'ccomp'],
  connector: ['cc', 'discourse'],
  predicate: ['root'],
}

interface GoldB { start: number; end: number; head: number | null; deprel: string }
interface GoldSent { text: string; bunsetsu: GoldB[] }

function parseMisc(misc: string): Map<string, string> {
  const m = new Map<string, string>()
  if (misc === '_') return m
  for (const pair of misc.split('|')) {
    const eq = pair.indexOf('=')
    if (eq !== -1) m.set(pair.slice(0, eq), pair.slice(eq + 1))
  }
  return m
}

function parseGold(source: string): GoldSent[] {
  const out: GoldSent[] = []
  for (const block of source.split(/\r?\n\r?\n/)) {
    const lines = block.trim().split(/\r?\n/)
    const textLine = lines.find((l) => l.startsWith('# text ='))
    if (!textLine) continue
    const text = textLine.slice('# text ='.length).trim()
    interface Tok { id: number; form: string; head: number; deprel: string; bi: string }
    const toks: Tok[] = []
    let bad = false
    for (const line of lines) {
      if (line.startsWith('#')) continue
      const f = line.split('\t')
      if (!f[0] || !/^\d+$/.test(f[0])) continue
      const bi = parseMisc(f[9] ?? '_').get('BunsetuBILabel')
      if (bi !== 'B' && bi !== 'I') { bad = true; break }
      toks.push({ id: Number(f[0]), form: f[1], head: Number(f[6]), deprel: f[7], bi })
    }
    if (bad || toks.length === 0) continue
    let cursor = 0
    const located = toks.map((t) => {
      while (cursor < text.length && !text.startsWith(t.form, cursor)) cursor++
      const start = cursor
      cursor = start + t.form.length
      return { ...t, start, end: cursor }
    })
    const groups: (typeof located)[] = []
    for (const t of located) {
      if (t.bi === 'B' || groups.length === 0) groups.push([t])
      else groups[groups.length - 1].push(t)
    }
    const bunsetsuOf = new Map<number, number>()
    groups.forEach((g, gi) => { for (const t of g) bunsetsuOf.set(t.id, gi) })
    const bunsetsu: GoldB[] = []
    let malformed = false
    for (const g of groups) {
      const ids = new Set(g.map((t) => t.id))
      const exits = g.filter((t) => !ids.has(t.head))
      if (exits.length !== 1) { malformed = true; break }
      const e = exits[0]
      bunsetsu.push({
        start: Math.min(...g.map((t) => t.start)),
        end: Math.max(...g.map((t) => t.end)),
        head: e.head === 0 ? null : (bunsetsuOf.get(e.head) ?? null),
        deprel: e.deprel.split(':')[0],
      })
    }
    if (!malformed) out.push({ text, bunsetsu })
  }
  return out
}

async function main() {
  const { alignSentence } = (await import(
    pathToFileURL(resolve(sasaraDir, 'train/align.ts')).href
  )) as { alignSentence: (g: { text: string; bunsetsu: { start: number; end: number; head: number | null }[] }) => Promise<{ bunsetsu: { tokens: { surface_form: string; pos: string; pos_detail_1: string }[]; head: number | null }[] } | null> }

  const golds = parseGold(readFileSync(conllu, 'utf8'))
  console.log(`gold sentences: ${golds.length}`)

  let aligned = 0
  let total = 0
  let correct = 0
  const perLabel = new Map<string, { n: number; ok: number }>()
  const confusions = new Map<string, number>()

  for (const g of golds) {
    const a = await alignSentence(g)
    if (a === null) continue
    aligned++
    const input: RelationInput[] = a.bunsetsu.map((b) => ({
      head: b.head,
      morphemes: b.tokens.map((t) => ({ surface: t.surface_form, posJa: combinePos(t.pos, t.pos_detail_1) })),
    }))
    for (let i = 0; i < input.length; i++) {
      const headIdx = input[i].head
      if (headIdx !== null && headIdx < i) continue // leftward gold arc (UD coordination) — sasara never produces these
      const gold = g.bunsetsu[i].deprel
      const pred = bunsetsuRelation(input, i)
      total++
      const ok = pred === null ? gold === 'punct' : GOLD_GROUPS[pred].includes(gold)
      if (ok) correct++
      const key = pred ?? 'none'
      const e = perLabel.get(key) ?? { n: 0, ok: 0 }
      e.n++
      if (ok) e.ok++
      perLabel.set(key, e)
      if (!ok) confusions.set(`${gold}->${key}`, (confusions.get(`${gold}->${key}`) ?? 0) + 1)
    }
  }

  console.log(`aligned sentences: ${aligned}, rightward arcs scored: ${total}`)
  console.log(`learner-label accuracy: ${((100 * correct) / total).toFixed(1)}%\n`)
  console.log('predicted label   n     precision')
  for (const [label, { n, ok }] of [...perLabel.entries()].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`${label.padEnd(14)} ${String(n).padStart(6)}  ${((100 * ok) / n).toFixed(1).padStart(6)}%`)
  }
  console.log('\ntop confusions (gold->predicted):')
  for (const [key, n] of [...confusions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${key} (${n})`)
  }
}

void main()
```

Note: the dynamic import targets `train/align.ts` (tsx compiles it on the
fly; sasara's own `.js` specifiers inside resolve normally). kuromojin and
its dictionary resolve from the sasara checkout's node_modules.

- [ ] **Step 2: Run it against GSD dev**

Run: `npx tsx scripts/relation-eval.ts` (from the ayaki root, sasara checkout at `../sasara`)
Expected output shape:

```
gold sentences: 507
aligned sentences: 477, rightward arcs scored: ~3780
learner-label accuracy: 92–94%
```

The learner-label accuracy MUST be ≥ 91.5% — the research measurement was
91.9% before the topic deviation (which only widens acceptance). If it is
below, the port has a bug: diff the rule branches against
`docs/relation-labels.md` and the plan's Task 1 code.

- [ ] **Step 3: Create `docs/relation-labels.md`**

```markdown
# Relation labels: what the badges mean and how accurate they are

Ayaki labels every dependency with a learner-facing relation badge
(subject, topic, object, …), derived by rules in `src/lib/relations.ts`
from the IPAdic morphology of each bunsetsu. This documents the label
inventory, the mapping to Universal Dependencies, and the measured
accuracy. (Measured 2026-07-21 against UD_Japanese-GSD.)

## The inventory

| badge | UD group | main evidence |
| --- | --- | --- |
| subject | nsubj, csubj | …が |
| topic | — (see below) | bare …は/も |
| object | obj, iobj | …を |
| adverbial | obl, advmod | …に/で/へ/から/まで, comitative と, adverbs, adverb-capable nouns |
| noun modifier | nmod, det, amod, nummod, compound | …の, 連体詞, bare noun before noun |
| relative clause | acl | clause before noun, …という |
| linked clause | advcl, ccomp | …て/ので/…, quoting と, 連用中止, 形容動詞語幹+に |
| connector | cc | 接続詞 bunsetsu |
| predicate | root | the sentence root |

**topic is a deliberate UD deviation.** UD has no topic relation and
forces は-marked phrases into nsubj, obl, or dislocated — a genuinely
error-prone choice (it was a visible share of the remaining rule misses).
For a learner, "topic (は)" is more informative and is deterministic from
the particle. The Inspector links nsubj as its "usually" UD counterpart.

## How the labels are computed

Every bunsetsu has exactly one outgoing dependency, so labeling the arrow
and labeling the bunsetsu's role are the same computation. The rules read
only what the viewmodel has — surfaces and combined IPAdic POS
(`pos・detail1`) — plus the head indices of the finished tree:

- The **trailing particle chain** decides most labels (を → object,
  が → subject, bare は/も → topic, …). IPAdic's detail tags carry real
  signal: 接続助詞 marks linked clauses, 並立助詞 marks coordination,
  副詞可能 marks adverbial nouns (現在は → adverbial, not topic),
  形容動詞語幹 catches 非常に.
- **adverbial vs noun modifier** for case-marked phrases hinges on whether
  the head predicates (UD defines obl only on predicates). A サ変 noun
  counts as predicate only when used verbally (意気投合し yes, 変更後 no);
  a root noun with no copula (実兄。) predicates.
- **Coordination** (パンと/や): UD makes the first conjunct carry the
  phrase's role. The conjunct inherits its label from the next sibling on
  the same head — computable because labels run after the parse.
- **Clauses**: before a noun → relative clause (a trailing 読点 signals
  連用中止 → linked clause instead); otherwise → linked clause.

## Measured accuracy

Method: gold bunsetsu and relations derived from UD-GSD exactly the way
sasara derives its training gold (`BunsetuBILabel` grouping; the one
token whose UD head lies outside the bunsetsu carries the bunsetsu-level
deprel), aligned to IPAdic tokens with sasara's `train/align.ts`. Scored
on rightward arcs only — UD's leftward coordination arcs (conj) cannot
occur in sasara parses, so they never reach the UI.

Development of the rules (dev set, 3.8k arcs): a naive particle map
scores 82.6% UD-strict; the shipped rules reached 90.1% UD-strict /
91.9% learner-merged. Held-out validation on the GSD train split (52k
arcs, rules untouched): 90.3% / 91.9% — no overfitting to dev.

Per-label recall on the held-out split (UD-strict): root 100%, obj 97%,
ccomp 97%, det 98%, cc 93%, nsubj 92%, nmod 91%, obl 90%, acl 89%,
advcl 78%, advmod 75%. Most advcl/advmod confusion is with labels inside
the same learner group, hence the higher merged figure. The genuinely
unfixable UD labels (csubj, iobj, compound) are together ~1% of arcs and
fold into their groups.

A label is right roughly 9 times out of 10 **given a correct arc**; wrong
arcs are already flagged by the confidence display (see
`attachment-confidence.md`), and the two cues compose.

## Reproducing the measurement

With a sasara checkout next to ayaki:

```bash
cd ../sasara && npx tsx train/download-gsd.ts   # fetches GSD dev into train/data/
cd ../ayaki && npx tsx scripts/relation-eval.ts # dev-set measurement
# held-out: fetch ja_gsd-ud-train.conllu from the UD_Japanese-GSD repo, then
npx tsx scripts/relation-eval.ts path/to/ja_gsd-ud-train.conllu
```

The script imports the shipped labeler, so it measures exactly what the
app displays; run it after any rule change.
```

- [ ] **Step 4: README pointer**

In `README.md`, directly below the existing `docs/attachment-confidence.md` pointer line, add (match the existing line's list style exactly):

```markdown
- [docs/relation-labels.md](docs/relation-labels.md) — what the relation badges mean, their UD mapping, and the measured ~92% labeling accuracy
```

- [ ] **Step 5: Verify suite still green**

Run: `npm test` → all tests pass (script and docs are not imported by the app).

- [ ] **Step 6: Commit**

```bash
git add scripts/relation-eval.ts docs/relation-labels.md README.md
git commit -m "feat: versioned relation-label evaluation against UD-GSD + background doc"
```

---

### Task 3: Viewmodel field, setting, settings menu

**Files:**
- Modify: `src/lib/types.ts`, `src/lib/viewmodel.ts`, `src/lib/helpexample.ts`, `src/lib/settings.ts`, `src/components/SettingsMenu.svelte`, `src/components/App.svelte`, `src/lib/locales/*.ts`
- Test: `tests/lib/settings.test.ts`, `tests/lib/viewmodel.test.ts`, `tests/components/SettingsMenu.test.ts`, `tests/components/App.test.ts`

**Interfaces:**
- Consumes: `bunsetsuRelation`, `RelationLabel` (Task 1).
- Produces: `BunsetsuVM.relation: RelationLabel | null`; `Settings.showRelations: boolean` (default `true`); `showRelations` bindable on SettingsMenu; App state `showRelations` persisted and passed onward (Tasks 4–5 consume it).

- [ ] **Step 1: Write the failing tests**

Add to `tests/lib/settings.test.ts` (mirroring the quietParts cases):

```ts
  it('rejects non-boolean showRelations values', () => {
    localStorage.setItem(KEY, JSON.stringify({ showRelations: 'yes' }))
    expect(loadSettings().showRelations).toBe(true)
  })
```

and add `showRelations: false` to the round-trip literal at `tests/lib/settings.test.ts:22` (the `s = {…}` object), asserting it loads back `false`.

Add to `tests/lib/viewmodel.test.ts`, using the file's existing `tok(partial)` and `bun(partial)` fixture helpers (defined at the top of that file):

```ts
  it('computes relation labels per bunsetsu', () => {
    const s = toParsedSentence('魚を食べた。', [
      bun({ index: 0, surface: '魚を', head: 1, tokens: [tok({ surface_form: '魚', pos: '名詞', pos_detail_1: '一般' }), tok({ surface_form: 'を', pos: '助詞', pos_detail_1: '格助詞' })] }),
      bun({ index: 1, surface: '食べた。', head: null, tokens: [tok({ surface_form: '食べ', pos: '動詞', pos_detail_1: '自立' }), tok({ surface_form: 'た', pos: '助動詞', pos_detail_1: '*' }), tok({ surface_form: '。', pos: '記号', pos_detail_1: '句点' })] }),
    ])
    expect(s.bunsetsu.map((b) => b.relation)).toEqual(['object', 'predicate'])
  })
```

In `tests/components/App.test.ts`, extend the persisted-settings literal (the object at ~line 155–165 containing `confidenceThreshold: 0.7, quietParts: false`) with `showRelations: true`.

In `tests/components/SettingsMenu.test.ts`, add (mirroring the quietParts checkbox test):

```ts
  it('binds the relation-labels checkbox', async () => {
    // follow the file's existing render-and-open pattern for the popup
    // then:
    const box = screen.getByLabelText('relation labels')
    expect(box).toBeChecked()
    await fireEvent.click(box)
    // assert the bound prop flipped, per the file's existing binding-assertion pattern
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/settings.test.ts tests/lib/viewmodel.test.ts tests/components/SettingsMenu.test.ts tests/components/App.test.ts`
Expected: FAIL — `showRelations` unknown, `relation` missing, checkbox absent.

- [ ] **Step 3: Implement**

`src/lib/types.ts` — import and extend:

```ts
import type { RelationLabel } from './relations'
```

and in `BunsetsuVM` after `reading: string`:

```ts
  /** learner-facing dependency relation, null only for symbol-only bunsetsu */
  relation: RelationLabel | null
```

`src/lib/viewmodel.ts` — in `toParsedSentence`, the mapper needs the whole array first. Replace the current `bunsetsu: bunsetsu.map(...)` with a two-step:

```ts
export function toParsedSentence(text: string, bunsetsu: Bunsetsu[]): ParsedSentence {
  const vms = bunsetsu.map((b): Omit<BunsetsuVM, 'relation'> => {
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
  })
  return {
    text,
    error: null,
    bunsetsu: vms.map((vm, i) => ({ ...vm, relation: bunsetsuRelation(vms, i) })),
  }
}
```

with `import { bunsetsuRelation } from './relations'` added (RelationInput is satisfied because the partial VMs already carry `morphemes` + `head`).

`src/lib/helpexample.ts` — add the field to the four HELP_SENTENCE entries, in order: `relation: 'relclause'`, `relation: 'object'`, `relation: 'linkedclause'`, `relation: 'predicate'`.

`src/lib/settings.ts` — add to the interface after `quietParts: boolean`:

```ts
  showRelations: boolean
```

to `DEFAULTS`: `showRelations: true`, and to `validators` after the quietParts line:

```ts
  showRelations: (v) => (typeof v === 'boolean' ? v : undefined),
```

`src/components/SettingsMenu.svelte` — add prop `showRelations = $bindable(true)` (typed `showRelations?: boolean`), and after the quietParts check-row:

```svelte
      <div class="row check-row">
        <label class="row-label" for="rel-{uid}">{t('relationsToggle')}</label>
        <input id="rel-{uid}" type="checkbox" bind:checked={showRelations} />
      </div>
```

Locales — add key `relationsToggle` right after `quietPartsToggle` in each catalog: en `'relation labels'`, de `'Relationsbeschriftungen'`, ja `'関係ラベル'`, zh `'关系标签'`.

`src/components/App.svelte` — add state `let showRelations = $state(initialSettings.showRelations)`, include `showRelations` in the `saveSettings({...})` call, and add `bind:showRelations` to the SettingsMenu element.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/settings.test.ts tests/lib/viewmodel.test.ts tests/components/SettingsMenu.test.ts tests/components/App.test.ts` → PASS.
Run: `npm run check` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/viewmodel.ts src/lib/helpexample.ts src/lib/settings.ts src/components/SettingsMenu.svelte src/components/App.svelte src/lib/locales/*.ts tests/
git commit -m "feat: relation on the viewmodel + showRelations setting"
```

---

### Task 4: Badges in the three views

**Files:**
- Modify: `src/lib/arclayout.ts` (minWidths param), `src/components/StairView.svelte`, `src/components/ArcDiagram.svelte`, `src/components/NodeTree.svelte`, `src/components/SentenceCard.svelte`, `src/components/App.svelte`, `src/app.css`
- Test: `tests/components/StairView.test.ts`, `tests/components/ArcDiagram.test.ts`, `tests/components/NodeTree.test.ts` (extend the existing files)

**Interfaces:**
- Consumes: `BunsetsuVM.relation`, `RELATION_TERM_KEYS` (Task 1), App's `showRelations` (Task 3).
- Produces: each view accepts `showRelations?: boolean` (default false); badges are `<text class="relation-label" aria-hidden="true">`; `layoutArcs(surfaces, heads, arcBase?, minWidths?)`.

- [ ] **Step 1: Write the failing tests**

In each of the three view test files add (adapting render props to the file's existing pattern; the fixture bunsetsu already carry `relation` after Task 3 — if a local fixture in the test file lacks it, add sensible values):

```ts
  it('shows relation badges when showRelations is on', () => {
    render(View, { props: { ...baseProps, showRelations: true } })
    // view tests render the component alone — no always-mounted help demo here
    const labels = [...document.querySelectorAll('.relation-label')]
    expect(labels.length).toBe(FIXTURE.length) // one per bunsetsu with non-null relation
    expect(labels.every((l) => l.getAttribute('aria-hidden') === 'true')).toBe(true)
  })
  it('shows no badges by default', () => {
    render(View, { props: baseProps })
    expect(document.querySelectorAll('.relation-label').length).toBe(0)
  })
```

Also assert in one view test that the box accessible name is still the bare surface (e.g. `screen.getByRole('button', { name: '魚を' })` still resolves with badges on).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/components/StairView.test.ts tests/components/ArcDiagram.test.ts tests/components/NodeTree.test.ts`
Expected: FAIL — unknown prop / zero badges.

- [ ] **Step 3: Implement**

`src/lib/arclayout.ts` — give `layoutArcs` an optional per-box minimum width (badge may be wider than a narrow box; growing the box prevents neighbor-badge overlap):

```ts
export function layoutArcs(surfaces: string[], heads: (number | null)[], arcBase = ARC_BASE, minWidths?: number[]): ArcLayout {
  const boxes: ArcBox[] = []
  let x = 0
  surfaces.forEach((s, i) => {
    const width = Math.max(textWidth(s) + 2 * BOX_PAD, minWidths?.[i] ?? 0)
    boxes.push({ x, width, cx: x + width / 2 })
    x += width + BOX_GAP
  })
```

(rest unchanged).

All three views: add prop `showRelations = false` (typed `showRelations?: boolean`), plus shared bits:

```ts
  import { RELATION_TERM_KEYS } from '../lib/relations'
  const REL_H = 15
  const relH = $derived(showRelations ? REL_H : 0)
  const relText = (b: BunsetsuVM) => (b.relation ? t(RELATION_TERM_KEYS[b.relation]) : null)
  // latin badge at 10px is ~0.6× the 17px-font estimate textWidth gives
  const relWidth = (b: BunsetsuVM) => {
    const label = relText(b)
    return label ? Math.ceil(textWidth(label) * 0.6) + 8 : 0
  }
```

(`textWidth` import already exists in NodeTree; add `import { textWidth } from '../lib/arclayout'` where missing.)

**StairView**: row height gains `relH` — change the layout call to

```ts
    layoutStairs(
      bunsetsu.map((b) => b.surface),
      bunsetsu.map((b) => b.head),
      { rowHeight: furiH + BOX_H + relH + ROW_GAP, boxCenterOffset: furiH + BOX_H / 2 },
    )
```

and inside the bunsetsu `<g>` after the surface `<text>`:

```svelte
          {#if showRelations && relText(b)}
            <text class="relation-label" aria-hidden="true" x={box.x + box.width / 2} y={box.y + furiH + BOX_H + 11} text-anchor="middle">{relText(b)}</text>
          {/if}
```

**ArcDiagram**: layout call becomes

```ts
  const layout = $derived(layoutArcs(bunsetsu.map((b) => b.surface), bunsetsu.map((b) => b.head), showFurigana ? 30 : 22, showRelations ? bunsetsu.map(relWidth) : undefined))
```

`svgHeight` becomes `boxTop + BOX_H + 6 + relH`, and inside the bunsetsu `<g>`:

```svelte
        {#if showRelations && relText(b)}
          <text class="relation-label" aria-hidden="true" x={box.cx + PAD_X} y={boxTop + BOX_H + 11} text-anchor="middle">{relText(b)}</text>
        {/if}
```

**NodeTree**: widths account for the badge, edges start below it, height grows:

```ts
  const widths = $derived(bunsetsu.map((b) => Math.max(textWidth(b.surface) + 2 * BOX_PAD, showRelations ? relWidth(b) : 0)))
```

svg height: `layout.height + BOX_H + 6 + topPad + relH`; edge start `y1` becomes `from.y + BOX_H + topPad + relH` (badge sits between box bottom and outgoing edges); inside the bunsetsu `<g>`:

```svelte
        {#if showRelations && relText(b)}
          <text class="relation-label" aria-hidden="true" x={n.x + PAD_X} y={n.y + topPad + BOX_H + 11} text-anchor="middle">{relText(b)}</text>
        {/if}
```

**SentenceCard**: accept `showRelations = false` (typed optional boolean) and pass `{showRelations}` to all three views. **App.svelte**: add `{showRelations}` to the SentenceCard props.

**HelpDialog** is untouched in this task — its demo gains badges in Task 6 (the spec pins the demo's `showRelations` on).

`src/app.css` — after the `.part-label` rule:

```css
svg .relation-label { font-size: 10px; fill: color-mix(in srgb, currentColor 55%, transparent); }
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/components/` → PASS (all component suites, not only the three edited — badge geometry must not break sibling tests).
Run: `npm run check` → clean.

- [ ] **Step 5: Visual sanity in a real browser**

Run: `npm run build -- --base=/ayaki/ && npm run preview -- --base=/ayaki/` and check http://localhost:4173/ayaki/ — parse the example sentence, confirm in ALL THREE views: badges under every box, no badge/arrow overlap in tree view, no neighbor-badge collisions in arcs view, stair rows evenly spaced. Then toggle "relation labels" off in settings → badges disappear, layouts return to today's compactness.

- [ ] **Step 6: Commit**

```bash
git add src/lib/arclayout.ts src/components/*.svelte src/app.css tests/components/
git commit -m "feat: relation badges under bunsetsu boxes in all three views"
```

---

### Task 5: Inspector relation line

**Files:**
- Modify: `src/components/Inspector.svelte`, `src/app.css`
- Test: `tests/components/Inspector.test.ts`

**Interfaces:**
- Consumes: `selected.relation`, `selected.head`, `sentence.bunsetsu`, `RELATION_TERM_KEYS`, `RELATION_EXPLAIN_KEYS`, `RELATION_UD` (Task 1).
- Produces: `.relation-line` paragraph in the card (always rendered when a bunsetsu with non-null relation is selected — independent of `showRelations`).

- [ ] **Step 1: Write the failing tests**

Add to `tests/components/Inspector.test.ts` (a new describe; reuse the file's existing fixture sentence — its bunsetsu carry `relation` after Task 3):

```ts
describe('relation line', () => {
  it('shows term, head surface, explanation, and UD link', () => {
    // render with the fixture's non-root bunsetsu selected (e.g. 魚を → 食べた。)
    const line = document.querySelector('.inspector .relation-line')!
    expect(line.textContent).toContain('object')
    expect(line.textContent).toContain('→ 食べた。')
    expect(line.textContent).toContain('what the action directly acts on (を)')
    const link = line.querySelector('a')!
    expect(link.getAttribute('href')).toBe('https://universaldependencies.org/u/dep/obj.html')
    expect(link.getAttribute('target')).toBe('_blank')
  })
  it('root shows predicate without an arrow', () => {
    // select the root bunsetsu
    const line = document.querySelector('.inspector .relation-line')!
    expect(line.textContent).toContain('predicate')
    expect(line.textContent).not.toContain('→')
    expect(line.querySelector('a')!.getAttribute('href')).toBe('https://universaldependencies.org/u/dep/root.html')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/components/Inspector.test.ts`
Expected: FAIL — `.relation-line` absent.

- [ ] **Step 3: Implement**

`src/components/Inspector.svelte` — import at the top:

```ts
  import { RELATION_EXPLAIN_KEYS, RELATION_TERM_KEYS, RELATION_UD } from '../lib/relations'
```

Insert directly after the `</h2>` closing tag of the selected heading (before the confidence paragraph):

```svelte
    {#if selected.relation}
      {@const headB = selected.head !== null ? (sentence?.bunsetsu[selected.head] ?? null) : null}
      <p class="relation-line">
        <span class="relation-term">{t(RELATION_TERM_KEYS[selected.relation])}</span>
        {#if headB}<span class="relation-head" lang="ja">→ {headB.surface}</span>{/if}
        <span class="relation-explain">{t(RELATION_EXPLAIN_KEYS[selected.relation])}</span>
        <a class="relation-ud" href="https://universaldependencies.org/u/dep/{RELATION_UD[selected.relation]}.html" target="_blank" rel="noopener">UD: {RELATION_UD[selected.relation]} ↗</a>
      </p>
    {/if}
```

`src/app.css` — after the `.confidence` rules (match the surrounding style conventions):

```css
.relation-line { margin: 0.15rem 0 0.6rem; font-size: 0.82rem; color: #475569; display: flex; flex-wrap: wrap; gap: 0.15rem 0.6rem; align-items: baseline; }
.relation-term { font-weight: 600; }
.relation-explain { flex-basis: 100%; color: color-mix(in srgb, currentColor 75%, transparent); }
.relation-line .relation-ud { font-size: 0.75rem; }
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/components/Inspector.test.ts` → PASS (including all pre-existing Inspector tests — the new paragraph must not break part-linking or heading-name assertions).

- [ ] **Step 5: Commit**

```bash
git add src/components/Inspector.svelte src/app.css tests/components/Inspector.test.ts
git commit -m "feat: relation line with UD link in the inspector card"
```

---

### Task 6: Help section

**Files:**
- Modify: `src/components/HelpDialog.svelte`, `src/lib/locales/*.ts`
- Test: `tests/components/HelpDialog.test.ts`

**Interfaces:**
- Consumes: `RELATION_LABELS`, `RELATION_TERM_KEYS`, `RELATION_EXPLAIN_KEYS` (Task 1).
- Produces: an eighth help section listing the 9 relations.

- [ ] **Step 1: Write the failing test**

In `tests/components/HelpDialog.test.ts`, the section-count assertion (currently seven sections) becomes eight, and add:

```ts
  it('lists all nine relations with glosses', () => {
    // open the dialog per the file's existing pattern, then:
    const items = [...dialog.querySelectorAll('.relations-legend li')]
    expect(items.length).toBe(9)
    expect(items[0].textContent).toContain('subject')
    expect(items[8].textContent).toContain('predicate')
  })
  it('demo diagram shows relation badges', () => {
    // spec pins the demo's showRelations on — HELP_SENTENCE has 4 bunsetsu
    expect(dialog.querySelectorAll('.relation-label').length).toBe(4)
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/components/HelpDialog.test.ts` → FAIL.

- [ ] **Step 3: Implement**

Locales — insert after `helpPartsIntro` in each catalog:

en:
```ts
  helpRelationsTitle: 'What each part does — relation labels',
  helpRelationsIntro:
    'Each bunsetsu is labeled with its grammatical relation to the phrase it attaches to. The labels are derived by rules from particles and word classes and are right about 9 times out of 10 — the inspector links the matching Universal Dependencies relation for every label. They can be hidden in the settings.',
```

de:
```ts
  helpRelationsTitle: 'Was die Teile tun — Relationsbeschriftungen',
  helpRelationsIntro:
    'Jedes Bunsetsu trägt seine grammatische Relation zu der Phrase, an die es sich anschließt. Die Beschriftungen werden regelbasiert aus Partikeln und Wortarten abgeleitet und stimmen in etwa 9 von 10 Fällen — der Inspektor verlinkt zu jeder Beschriftung die passende Universal-Dependencies-Relation. In den Einstellungen lassen sie sich ausblenden.',
```

ja:
```ts
  helpRelationsTitle: '各部分のはたらき — 関係ラベル',
  helpRelationsIntro:
    '各文節には、係り先との文法的な関係が表示されます。ラベルは助詞や品詞から規則で導かれ、およそ9割の精度です。インスペクターでは対応する Universal Dependencies の関係へのリンクも示されます。設定で非表示にできます。',
```

zh:
```ts
  helpRelationsTitle: '各部分的作用 — 关系标签',
  helpRelationsIntro:
    '每个文节都标注了它与所依附短语的语法关系。标签由助词和词类规则推导，准确率约九成 — 检查面板会为每个标签链接对应的 Universal Dependencies 关系。可在设置中隐藏。',
```

`src/components/HelpDialog.svelte` — import additions:

```ts
  import { RELATION_EXPLAIN_KEYS, RELATION_LABELS, RELATION_TERM_KEYS } from '../lib/relations'
```

Pin the demo's badges on — add `showRelations={true}` to the demo's `<StairView …>` element (the spec pins this like the demo's other display choices; `HELP_SENTENCE` carries relations since Task 3).

New section between the parts section and the tips section:

```svelte
    <section>
      <h3>{t('helpRelationsTitle')}</h3>
      <p>{t('helpRelationsIntro')}</p>
      <ul class="help-legend relations-legend">
        {#each RELATION_LABELS as r (r)}
          <li><strong>{t(RELATION_TERM_KEYS[r])}</strong> — {t(RELATION_EXPLAIN_KEYS[r])}</li>
        {/each}
      </ul>
    </section>
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/components/HelpDialog.test.ts` → PASS.
Run: `npm run check` → clean (key parity via `satisfies`).

- [ ] **Step 5: Commit**

```bash
git add src/components/HelpDialog.svelte src/lib/locales/*.ts tests/components/HelpDialog.test.ts
git commit -m "feat: relations section in the help dialog"
```

---

### Task 7: live-check, screenshots, full validation

**Files:**
- Modify: `scripts/live-check.mjs` (new check after the parts check)
- Regenerate: `docs/images/*.png` via `npm run shots`

**Interfaces:**
- Consumes: `.relation-label` badges (Task 4), default-on `showRelations` (Task 3).

- [ ] **Step 1: Add the thirteenth check**

After the parts check block in `scripts/live-check.mjs` (same structure as its neighbors, including the ok/fail helpers). The parts check leaves the example parsed and a bunsetsu selected; this check only needs the parse:

```js
  try {
    const badges = await page.locator('main .relation-label').count()
    const boxes = await page.locator('main .bunsetsu').count()
    const badgeTexts = await page.locator('main .relation-label').allTextContents()
    if (badges === 0 || badges !== boxes) throw new Error(`badges=${badges} boxes=${boxes}`)
    if (!badgeTexts.includes('object') || !badgeTexts.includes('predicate'))
      throw new Error(`unexpected badge texts: ${badgeTexts.join(',')}`)
    ok(`relations: ${badges} badges matching ${boxes} bunsetsu (${badgeTexts.join('/')})`)
  } catch (e) {
    fail('relations', String(e))
  }
```

If the preceding checks' page state does not guarantee a parse at this
point (mirror the parts check's re-click guard if needed — the locale
check's reload clears the parse), re-click the example first, exactly as
the parts check does.

Update the summary line/comment at the top of the file that names the
check count: twelve → thirteen.

- [ ] **Step 2: Verify against a local preview**

Run: `npm run build -- --base=/ayaki/ && npm run preview -- --base=/ayaki/` (background), then `npm run live-check -- http://localhost:4173/ayaki/`
Expected: `13/13 checks passed`, relations line reporting 7 badges for the example sentence with texts including `adverbial/topic/adverbial/relative clause/object/linked clause/predicate`.

- [ ] **Step 3: Regenerate README screenshots**

Run: `npm run shots`
Expected: all three PNGs regenerate; the tree/cabocha scenes now show badges (byte-identical output for a scene is only legitimate if that scene predates badges — none do here, all three show diagrams).

- [ ] **Step 4: Full validation**

Run: `npm test && npm run check && npm run build -- --base=/ayaki/ && npm run smoke`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add scripts/live-check.mjs docs/images/
git commit -m "feat: relations live-check + refreshed screenshots"
```

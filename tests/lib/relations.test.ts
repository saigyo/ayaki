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
  it('並立助詞 skips a symbol-only sibling (which labels null) and inherits from the next one', () => {
    const all = [
      b(3, ['すみれ', '名詞・固有名詞'], ['と', '助詞・並立助詞']),
      b(3, ['、', '記号・読点']), // symbol-only sibling on the same head → labels null, must be skipped
      b(3, ['彩', '名詞・固有名詞'], ['は', '助詞・係助詞']),
      PRED,
    ]
    expect(bunsetsuRelation(all, 0)).toBe('topic')
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
    const all = [b(1, ['この', '連体詞']), b(2, ['本', '名詞・一般'], ['を', '助詞・格助詞']), PRED]
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

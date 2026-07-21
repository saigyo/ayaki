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

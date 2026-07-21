# Relation Labels (Bunsetsu Role Badges) — Design

**Date:** 2026-07-21
**Status:** Approved

## Problem

Ayaki draws the dependency arrows between bunsetsu but never says what a
dependency *means* — a learner sees that 映画を attaches to 行きました but
not that it is the object. Universal Dependencies defines named relations
(obj, nmod, …) for exactly this. Research (2026-07-21, measured — see
`docs/relation-labels.md`) established that the relations can be derived
by rules from information ayaki already has, without forking sasara:
90.3% UD-strict / 91.9% learner-merged accuracy against 52k held-out gold
arcs from UD_Japanese-GSD.

## Decisions (from brainstorming)

- **Vocabulary:** learner-friendly role terms, UD underneath (option 1).
  Badges show localized grammar-school terms; the Inspector card exposes
  the primary UD code with a link to its universaldependencies.org page.
- **Deliberate UD deviation:** は/も-marked phrases get **topic** — more
  informative for learners and deterministic from the particle, where UD
  forces an error-prone nsubj/obl choice. The card says "UD: usually
  nsubj" for it.
- **Fuzziness handling:** just show the labels (option 1). No new
  uncertainty UI: a label rides an arc, and doubtful arcs are already
  dotted by the existing confidence display.
- **Placement (visual companion, option B):** small badges under the
  bunsetsu boxes — works identically in all three views, keeps lines
  clean. Labels-on-lines (A) only suits the CaboCha view; hover-only (C)
  never gives a whole-sentence overview.
- **Display control:** new `showRelations` setting, default **on**,
  checkbox in the settings menu. Not part of share links.
- **Measurement is versioned:** the evaluation script enters the repo and
  imports the shipped labeler, so rule changes can be re-measured.

## The label inventory

Nine labels. Each maps to a UD relation group (learner-merged); `ud` is
the primary code shown in the card.

| id | en | de | ja | zh | UD group | primary ud | trigger (IPAdic evidence) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| subject | subject | Subjekt | 主語 | 主语 | nsubj, csubj | nsubj | …が (格助詞) |
| topic | topic | Thema | 主題 | 话题 | nsubj/obl via は | nsubj | bare …は/も (係助詞) |
| object | object | Objekt | 目的語 | 宾语 | obj, iobj | obj | …を |
| adverbial | adverbial | Adverbial | 連用修飾語 | 状语 | obl, advmod | obl | …に/で/へ/から/まで/と, adverbs, 副詞可能 nouns |
| nounmod | noun modifier | Attribut | 連体修飾語 | 定语 | nmod, det, amod, nummod, compound | nmod | …の, 連体詞, bare noun → noun |
| relclause | relative clause | Relativsatz | 連体修飾節 | 定语从句 | acl | acl | clause → noun (incl. …という) |
| linkedclause | linked clause | Nebensatz | 接続節 | 连接分句 | advcl, ccomp | advcl | …て/ので/が/と-quote, 連用形 continuation, 形容動詞語幹+に |
| connector | connector | Konnektor | 接続詞 | 连词 | cc | cc | 接続詞 bunsetsu (それで, しかし) |
| predicate | predicate | Prädikat | 述語 | 谓语 | root | root | head === null |

There is no "unknown" badge: the rules are total (every branch falls
through to a defined label), matching the measured behavior.

## Components

### `src/lib/relations.ts` (new, pure)

Port of the measured v4 rules (see `docs/relation-labels.md` for their
derivation). Input is a minimal structural view that `BunsetsuVM` already
satisfies, so the production viewmodel and the eval script feed the exact
same function:

```ts
export interface RelationInput {
  morphemes: { surface: string; posJa: string }[]
  head: number | null
}

export type RelationLabel =
  | 'subject' | 'topic' | 'object' | 'adverbial' | 'nounmod'
  | 'relclause' | 'linkedclause' | 'connector' | 'predicate'

export const RELATION_LABELS: RelationLabel[] // display/legend order

/** primary UD code per label, for the card + UD link */
export const RELATION_UD: Record<RelationLabel, string>

/** i18n keys: badge term + one-sentence explanation */
export const RELATION_TERM_KEYS: Record<RelationLabel, MessageKey>
export const RELATION_EXPLAIN_KEYS: Record<RelationLabel, MessageKey>

export function bunsetsuRelation(all: RelationInput[], i: number): RelationLabel
```

Rule structure (operating on `posJa` = `pos・detail1` and surfaces —
exact port of the validated scratch rules):

- content head = first morpheme whose pos is not 助詞/助動詞/記号/接頭詞
- trailing particle chain = contiguous 助詞 from the end (ignoring
  trailing 記号), minus 終助詞
- clausality = content head 動詞/形容詞, or any 助動詞, or verbal
  pre-particle morpheme
- head-side: predicate = content head 動詞/形容詞, or サ変接続 noun with a
  following 動詞, or contains 助動詞, or is the root; noun = content head
  名詞
- particle rules: symbol-only bunsetsu → `null` (no badge; rare — sasara
  usually merges punctuation into the preceding bunsetsu); root →
  predicate; 接続助詞 anywhere → linkedclause; final の → nounmod (subject
  against a non-nominal predicate); という → relclause/linkedclause by
  head nominality; clausal + 副助詞/並立助詞/終助詞-class → linkedclause;
  並立助詞 → inherit the label of the next sibling on the same head
  (fallback nounmod); が → subject; を → object; は/も bare → topic
  (adverbial when the noun is 副詞可能); と → linkedclause when clausal
  else adverbial/nounmod by head; に/で/へ/から/まで/より → adverbial or
  nounmod by head (形容動詞語幹+に → linkedclause); no particle → 連体詞
  det-like → nounmod, 副詞 → adverbial, 接続詞 → connector, clausal →
  relclause/linkedclause (読点 forces linkedclause), bare nominal →
  adverbial/nounmod by head.

Deviations from the scratch script (display-driven): UD's det/amod/advmod
/ccomp/csubj distinctions collapse into their groups per the table.
`MessageKey` is imported type-only from `i18n.svelte`, so the eval script
can import this module under plain tsx without pulling in Svelte runtime.

### Viewmodel

`BunsetsuVM` gains `relation: RelationLabel | null` (computed in
`toSentenceVM` after heads exist; `null` only for symbol-only bunsetsu).
No change to parsing or share links.

### Views (badges, decision B)

All three views render, when `showRelations` is on, a badge under each
bunsetsu box with `t(RELATION_TERM_KEYS[relation])`, styled like the
Inspector part labels: small (~10px), muted gray, no per-role colors.
Badges are `aria-hidden="true"` separate text elements — the part-label
precedent: they must not pollute the boxes' accessible names that
existing tests and probes rely on.

- **StairView (CaboCha):** `<text>` under the box rect; box vertical
  pitch grows to make room.
- **ArcDiagram:** badge under each box in the row.
- **NodeTree:** badge under the node box.
- Root gets "predicate". Null relation renders nothing.

### Inspector card

Under the segmented heading (above the morpheme entries): a relation line
for the selected bunsetsu (omitted only when `relation` is null). The
card ALWAYS shows it — `showRelations` governs diagram clutter, not the
detail view:

- badge term in the same muted style, then "→ <head bunsetsu surface>"
  (omitted for the root — it shows only "predicate"),
- one-sentence localized explanation (`RELATION_EXPLAIN_KEYS`),
- the UD code as an external link to
  `https://universaldependencies.org/u/dep/<code>.html` (topic links
  nsubj and its explanation carries the "usually nsubj" honesty).

### Settings

`showRelations: boolean`, default `true`, boolean validator, persisted
like the others; checkbox in the settings menu after `quietParts`. NOT in
share links. Help demo pins `showRelations` on (fixture labels are
stable).

### Help

New section "Relations" after the parts section: one-line intro, the
9 badges with their localized gloss (list, not a live demo), and a note
that labels are rule-derived with ~90% measured reliability. No external
links in help (it stays self-contained); the UD links live in the card.

## Measurement tooling (versioned)

### `scripts/relation-eval.ts` (new)

Evaluates the **shipped** `src/lib/relations.ts` against UD_Japanese-GSD:

1. Parses a CoNLL-U file, grouping tokens by `BunsetuBILabel` and taking
   each bunsetsu's exit-token deprel (subtype-stripped) as the gold
   bunsetsu-level relation. Gold UD labels map to the 9 learner labels
   via the inventory table's UD groups for scoring; a predicted `topic`
   counts correct when the gold is nsubj, obl, or dislocated (UD has no
   topic — this scores the deviation honestly against all labels UD uses
   for は-phrases).
2. Aligns to IPAdic tokens via sasara's own `train/align.js` (sasara
   checkout path = 2nd argument, default `../sasara`), adapting
   `KuromojiToken` → `{surface, posJa}` with the same pos combination the
   viewmodel uses.
3. Prints: aligned sentence/arc counts, learner-label accuracy on
   rightward arcs (the app-relevant metric), per-label recall/precision,
   top confusions with examples.

Run: `npx tsx scripts/relation-eval.ts [conllu] [sasara-dir]` — default
conllu `<sasara-dir>/train/data/ja_gsd-ud-dev.conllu`.

### `docs/relation-labels.md` (new)

Background doc, sibling to `attachment-confidence.md`: what the labels
are, the rule→UD mapping and は→topic deviation, the measured numbers
(v1 82.6% → v4 90.3% strict / 91.9% merged on 52k held-out arcs;
per-label table; conj-is-leftward finding — such arcs never appear in the
app), what the tuning taught, and **Reproducing the measurement**
(sasara checkout + `npx tsx train/download-gsd.ts` + the eval command).
README gets a pointer line next to the attachment-confidence one.

## Not changing

Parsing, share links, confidence display, part roles/pills, chain colors,
existing settings, sasara (no fork).

## Testing

- `tests/lib/relations.test.ts`: particle matrix (each trigger row),
  clausality and predicate-head cases (サ変+動詞 vs bare サ変, root-noun
  predicate), coordination sibling-inherit, という, 形容動詞語幹+に,
  副詞可能 topics, the canonical sentence
  私は食べさせられたくなかったので、帰りました。 (topic + linkedclause +
  predicate) and 昨日、私は友達と新しい映画を見に行きました。 (full label
  sequence from the mockup).
- Component tests: badges in all three views (count, text, gone when
  `showRelations` off, none for null relation), Inspector relation line
  (term, head surface, UD link href, root case), settings checkbox,
  help section. All queries scoped against the always-mounted help demo.
- `tests/lib/settings.test.ts` + persisted-settings literal in App tests
  gain `showRelations`.
- Catalog parity is automatic; German strings get the per-codepoint
  review check (standing rule).
- `scripts/live-check.mjs`: thirteenth check — badge count equals
  bunsetsu count in the parsed example (re-click guard pattern),
  `.inspector`/`main` scoping.
- `npm run shots` regenerated (badges appear in all three screenshots).
- Post-merge: live-check + production probe measuring badge texts in two
  locales and the settings toggle round-trip.

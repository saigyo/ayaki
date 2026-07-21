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
| noun modifier | nmod, det, amod, nummod, compound, appos | …の, 連体詞, bare noun before noun |
| relative clause | acl | clause before noun, …という |
| linked clause | advcl, ccomp | …て/ので/…, quoting と, 連用中止, 形容動詞語幹+に |
| connector | cc, discourse | 接続詞 bunsetsu |
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

With the shipped rules this prints ≈92.4% learner-label accuracy on the
dev split (slightly above the pre-topic-deviation 91.9% research figure,
because topic widens acceptance).

The script imports the shipped labeler, so it measures exactly what the
app displays; run it after any rule change.

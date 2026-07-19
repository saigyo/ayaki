# Attachment confidence: what the numbers mean

Ayaki renders a dependency arc dotted when the parser's confidence in that
attachment is low. This document records what sasara's confidence values
actually are, the measurements behind Ayaki's display rules, and why the
uncertainty cutoff is bounded to 60–90%. (Verified against the sasara
source and re-measured 2026-07-20.)

## What sasara reports

For every non-root bunsetsu, sasara (with `confidence: true`) attaches:

- **`score`** — the linear model's attach score at the moment the
  attachment was made (positive = attach).
- **`probability`** — `Platt(|score|)`: the absolute score mapped through
  Platt scaling to a calibrated P(this attachment is correct). It is `NaN`
  when the model JSON carries no calibration coefficients; the bundled
  model has them. Ayaki normalizes `NaN` to `null` in the viewmodel.
- **`forced`** — `true` when the bunsetsu was not attached by a classifier
  decision at all: anything still unattached at the end of the sentence is
  force-merged (the end-of-sentence rule of the shift-reduce parser). The
  score is then computed post hoc with the same features, as a reference
  value.

## Why `probability` outranks `forced`

At first sight a forced attachment sounds untrustworthy — the classifier
never said "attach". But sasara's calibration is deliberately fit on
gold-tree samples that *include* forced arcs (they are ~35% of all
attachments), because their error rate is nearly identical to classifier
decisions (16.1% vs. 17.4% on the dev set; see sasara's
`docs/evaluation.md` and `train/collect-arc-samples.ts`). So `probability`
on a forced arc is not the confidence of a fictitious decision — it is a
calibrated estimate of "this head is correct", validated against gold
trees.

We re-measured this with the *shipped* calibration coefficients applied to
the UD Japanese-GSD dev set, split by `forced`:

| Predicted bin | forced: n / actually correct | non-forced: n / actually correct |
| --- | --- | --- |
| 50–60% | 66 / **81.8%** | 71 / 52.1% |
| 60–70% | 238 / **77.7%** | 235 / 45.1% |
| 70–80% | 238 / 76.5% | 316 / 75.6% |
| 80–90% | 306 / 82.0% | 515 / 86.4% |
| 90–100% | 324 / 91.4% | 1024 / 96.3% |

Two readings matter for the UI:

1. **High-probability forced arcs are trustworthy.** At P ≥ 0.9 a forced
   arc is right 91.4% of the time (94.0% at P ≥ 0.95) — a forced arc at
   P = 97% deserves a solid line, the same as a normal arc.
2. **Low-probability forced arcs are *under*confident** (predicted ~59% →
   actually ~82% correct): `|score|` is less discriminative on forced
   arcs, which flattens their curve. Dashing them anyway errs toward
   caution — the right direction for a "this might be wrong" cue.

Hence Ayaki's rule (`isUncertain` in `src/lib/viewmodel.ts`): when a
probability exists it wins — dotted iff it is below the threshold; only
when no probability exists at all does `forced` alone make an arc dotted.

## Why the cutoff is bounded to 60–90%

`probability` is `Platt(|score|)` and `|score| ≥ 0`, so the shipped
calibration has a **floor of ~57%** (at score 0) — probabilities below
that never occur. At the other end, the model's best arcs sit at ~94–95%
predicted.

- **Below 60%** a threshold silently matches (almost) nothing — a dead
  setting that looks valid.
- **60–90%** is exactly the band where the calibration is honest
  (predicted ≈ observed within a few points on the pooled dev set), so the
  setting truthfully reads as "dash any attachment estimated below X%
  likely correct".
- **Above 90%** dashes roughly half of all attachments and beyond ~95%
  essentially the whole tree — the cue degenerates into noise.

The default stays at 70%. A side effect of the 60–90% bound: the help
dialog's demo (fixture probabilities 0.55 / 0.92 / 0.97) renders
identically at every allowed setting — 0.55 always dotted, the others
always solid.

## Reproducing the measurement

In a sasara checkout:

```bash
npx tsx train/download-gsd.ts        # fetches UD_Japanese-GSD into train/data/
npx tsx train/calibration-report.ts  # pooled + per-subset re-fit reliability
```

`calibration-report.ts` re-fits Platt per subset; the table above instead
applies the *shipped* `model/model.json` coefficients to each subset
(`plattProbability(model.data.calibration, |score|)` over
`collectArcSamples(...)`, split by `forced`), which is what Ayaki actually
displays.

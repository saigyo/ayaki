# Configurable Confidence Threshold — Design

**Date:** 2026-07-20
**Status:** Approved

## Problem

The cutoff below which an attachment renders dotted/uncertain is hardcoded
(`LOW_CONFIDENCE = 0.7` in `src/lib/viewmodel.ts`). Users have different
tolerance: a learner may want to see only truly dubious arcs (lenient), a
skeptic may want to trust only near-certain ones (strict).

Measured grounding (sasara calibration analysis, 2026-07-20): sasara's
`probability` is `Platt(|score|)` with a floor of ~57% (at score 0), and
calibration is honest (predicted ≈ observed) in the 0.6–0.9 band. Below
60% a threshold silently matches nothing; above 90% it dashes essentially
everything (the model's best arcs sit at ~94–95%). Hence the dial is
bounded to **60–90%**.

## Change

### Background documentation (`docs/attachment-confidence.md`)

The calibration analysis ships in the repo as background documentation:
`docs/attachment-confidence.md` (already written, reviewed with this spec)
records sasara's confidence semantics, the measured forced/non-forced
reliability tables under the shipped calibration, the probability-wins
rule, the 60–90% bound rationale, and how to reproduce the measurement.
`README.md` gets a pointer next to the existing design-docs line:

```markdown
*Design documents live in [`docs/superpowers/specs/`](docs/superpowers/specs/).
Background on the confidence display: [`docs/attachment-confidence.md`](docs/attachment-confidence.md).*
```

### Settings (`src/lib/settings.ts`)

New field `confidenceThreshold: number` on `Settings`.

- `DEFAULTS.confidenceThreshold = 0.7`
- Bounds constants `CONFIDENCE_MIN = 0.6`, `CONFIDENCE_MAX = 0.9` (exported;
  the menu's slider uses them too — single source of truth)
- Validator mirrors `rate`: finite number → clamp to
  `[CONFIDENCE_MIN, CONFIDENCE_MAX]`, anything else → default. No snapping
  to 0.05 steps (the slider enforces steps; a hand-edited 0.72 clamps fine
  and displays as 72%).

Share links do NOT carry the threshold — it is a display preference like
`chainColor`, not part of the shared content.

### Viewmodel (`src/lib/viewmodel.ts`)

```ts
export function isUncertain(b: BunsetsuVM, threshold: number = LOW_CONFIDENCE): boolean {
  return b.probability !== null ? b.probability < threshold : b.forced
}
```

`LOW_CONFIDENCE` stays exported as the default value. `confidenceLabel` is
unchanged (tooltips keep disclosing the raw probability and "(forced)").

### Prop threading

New optional prop `confidenceThreshold: number = LOW_CONFIDENCE` on:

- `ArcDiagram.svelte`, `NodeTree.svelte`, `StairView.svelte` — every
  `isUncertain(b)` call site becomes `isUncertain(b, confidenceThreshold)`
- `SentenceCard.svelte` — pass-through to whichever view renders
- `Inspector.svelte` — used for `uncertainCount` and the selected-bunsetsu
  `class:uncertain`

`App.svelte` holds `confidenceThreshold` state from `initialSettings`,
includes it in the save effect, binds it into `SettingsMenu`, and passes it
to `SentenceCard` and `Inspector`.

**`HelpDialog.svelte` is unchanged.** The demo already pins its display
settings deliberately (`showConfidence={true}`, chain fallback to amber);
it keeps using the default threshold. The fixture probabilities
(0.55 / 0.92 / 0.97) render identically at every allowed setting, so the
demo stays a stable illustration regardless.

### Settings menu (`src/components/SettingsMenu.svelte`)

New row directly UNDER the "show attachment confidence" checkbox, mirroring
the rate-row markup:

```svelte
<div class="row">
  <label class="row-label" for="threshold-{uid}">{t('confidenceThresholdLabel')}</label>
  <span class="rate-row">
    <input
      id="threshold-{uid}"
      type="range"
      min={CONFIDENCE_MIN}
      max={CONFIDENCE_MAX}
      step="0.05"
      bind:value={confidenceThreshold}
      disabled={!showConfidence}
      title={!showConfidence ? t('confidenceToggle') : undefined}
    />
    <span>{Math.round(confidenceThreshold * 100)}%</span>
  </span>
</div>
```

`confidenceThreshold = $bindable(0.7)` joins the existing bindable props.
Disabled (not hidden) when `showConfidence` is off — no layout jump; the
title names the toggle that enables it. Reuses the existing `.rate-row`
class; no new CSS.

### Locale catalogs (`src/lib/locales/{en,de,ja,zh}.ts`)

One new key, inserted directly after `confidenceToggle`:

| locale | `confidenceThresholdLabel` |
| --- | --- |
| en | uncertainty cutoff |
| de | Unsicherheitsschwelle |
| ja | 不確実とみなすしきい値 |
| zh | 不确定阈值 |

One extended key — `helpConfidenceBody` gets a final sentence (mirroring
the `legendChainNote` configurability-mention pattern):

| locale | appended sentence |
| --- | --- |
| en | The probability below which an attachment counts as uncertain can be adjusted in the settings (60–90%). |
| de | Die Wahrscheinlichkeitsschwelle, unterhalb derer eine Anbindung als unsicher gilt, lässt sich in den Einstellungen anpassen (60–90 %). |
| ja | 不確実とみなす確率のしきい値は設定で調整できます(60〜90%)。 |
| zh | 判定为不确定的概率阈值可在设置中调整(60–90%)。 |

## Not changing

`confidenceLabel` and all tooltip copy, `HelpDialog.svelte` and
`helpexample.ts`, share-link schema (`share.ts`), live-check and the
Playwright scripts, screenshots (settings popup is closed in all scenes),
CSS. README changes are limited to the one pointer line above.

## Testing

- `tests/lib/settings.test.ts`: validator — clamp below/above bounds,
  non-number → default, round-trip persistence of a valid value.
- `tests/lib/viewmodel.test.ts` (matrix test): explicit-threshold cases —
  P=0.75 is uncertain at threshold 0.8 but not at 0.7; null-probability
  behavior unaffected by threshold.
- `tests/components/SettingsMenu.test.ts`: slider rendered with min 0.6 /
  max 0.9 / step 0.05; disabled when `showConfidence` is false, enabled
  when true; percentage display follows the value.
- `tests/components/StairView.test.ts` (or equivalent view test): with
  `showConfidence` and a P=0.75 bunsetsu, the `low` dash class appears at
  `confidenceThreshold` 0.8 and not at 0.7.
- Catalog parity automatic (compile-time Record + runtime parity test).
- Post-merge: standard `npm run live-check` (unchanged) plus a manual
  production probe that flips the slider and measures a dash-class change.

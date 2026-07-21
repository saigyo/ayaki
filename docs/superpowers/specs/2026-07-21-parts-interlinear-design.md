# Parts Interlinear (Ruby + Role Labels) — Design

**Date:** 2026-07-21
**Status:** Approved

## Problem

The segmented bunsetsu heading (PR #25) shows role-colored pills, but the
roles are only discoverable via tooltip, and readings only appear in the
entries below. Decided (Markus, 2026-07-21, via visual companion): each
segment becomes a small interlinear stack — kana reading above, surface
pill in the middle, role label below. This delivers aim (b) of the parts
design (visible role understanding) plus the deferred readings increment,
in one geometry change.

## Decisions (from brainstorming)

- **Ruby** follows the existing `showFurigana` setting (no new toggle) and
  renders only when the morpheme's reading exists AND differs from its
  surface (the entries' existing rule) — so 行き gets いき; ましょ/う/ね/。
  get an empty placeholder row (keeps baselines aligned). With furigana
  off, the ruby row is absent entirely. (Implementation note: pill-bottom
  alignment across mixed ruby/no-ruby columns comes from the container's
  `align-items: flex-end`, not from the placeholder height — and the
  container wraps, so long auxiliary chains break into rows of intact
  columns.)
- **Role labels** are always visible, style A: small muted gray text under
  each pill, in BOTH colored and quiet modes. Short localized forms;
  unabbreviated German. The long forms stay in tooltips and the help
  legend, unchanged.
- Narrow pills stretch to their label's width (column layout, centered).

## Change

### Short label keys (`src/lib/partroles.ts` + catalogs)

```ts
/** i18n catalog key holding the SHORT under-pill label of each role */
export const PART_SHORT_KEYS = {
  head: 'partHeadShort',
  aux: 'partAuxShort',
  particle: 'partParticleShort',
  affix: 'partAffixShort',
  symbol: 'partSymbolShort',
} as const
```

| key | en | de | ja | zh |
| --- | --- | --- | --- | --- |
| partHeadShort | head | Kopf | 主辞 | 中心语 |
| partAuxShort | aux | Hilfsverb | 助動詞 | 助动词 |
| partParticleShort | particle | Partikel | 助詞 | 助词 |
| partAffixShort | affix | Affix | 接辞 | 词缀 |
| partSymbolShort | punct. | Zeichen | 記号 | 标点 |

Keys inserted directly after `partSymbol` in each catalog.

### SegmentedSurface restructure (`src/components/SegmentedSurface.svelte`)

New prop `showFurigana?: boolean` (default false). Each segment becomes a
column wrapper:

- `.part-col` (flex column, centered) — carries the hover handlers
  (`mouseenter`/wrapper-level `mouseleave` stays on `.parts`), the
  `data-role`, `--part` style, and the long-form `title` tooltip.
- `.part-ruby` (only when `showFurigana`): the reading when it exists and
  differs from the surface, else an empty placeholder with `min-height`.
- `.part` — the pill, UNCHANGED class semantics (`quiet`/`active`
  classes stay here; `.inspector .part` counts in tests and live-check
  keep meaning "one per morpheme").
- `.part-label` — `t(PART_SHORT_KEYS[role])`, muted
  (`color-mix(currentColor 55%)`), rendered in both modes.

`.parts` becomes `display: flex; align-items: flex-end; gap: 3px` (the
pill margins move to the container gap). The svelte-ignore justification
comments move with the handlers.

### Consumers

- `Inspector.svelte`: new prop `showFurigana = false` passed through to
  `SegmentedSurface`; `App.svelte` adds `{showFurigana}` to the Inspector
  line. Everything else (hover state, entries, scroll) unchanged.
- `HelpDialog.svelte`: the parts example pins `showFurigana={true}` (like
  the demo pins its other display choices) — 行き shows いき, and the
  labels teach the legend directly. `HELP_PARTS` already carries readings.

### Verification tooling

- The existing live-check parts check additionally asserts
  `.inspector .part-label` count equals the parts count.
- README screenshots regenerated (`npm run shots` — screenshot-tree.png
  shows the inspector with labels).

## Not changing

Role mapping and palette, `quietParts` semantics, entries below the
heading (their （reading） stays — it is the copyable/plain-text form),
tooltips (`PART_LABEL_KEYS` long forms), help legend, share links,
diagrams, settings menu.

## Testing

- `SegmentedSurface.test.ts`: adjust hover-target queries to `.part-col`
  (mouseenter does not bubble); new cases — ruby rendered only for
  differing readings when `showFurigana`, placeholder row for the others,
  no ruby row when off; label text per role (en short forms); labels
  present in quiet mode.
- `Inspector.test.ts`: showFurigana pass-through (ruby appears in the
  heading when on); existing part/entry linking tests updated only in
  their hover targets.
- `HelpDialog.test.ts`: the parts example contains いき ruby and 5 labels.
- Catalog parity automatic. Post-merge: live-check (extended check) +
  production probe measuring ruby/label rendering in both modes and two
  locales.

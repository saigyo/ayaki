# CaboCha-Style Stair View — Design

**Date:** 2026-07-19
**Status:** Approved

## Problem

Ayaki offers arc-diagram and node-tree views. The classic CaboCha-style stair
rendering — one bunsetsu per line, dependents connected to their head by trailing
rails — is the traditional way Japanese dependency parses have been displayed for
decades. Adding it completes the canonical set, and its vertical growth suits long
sentences and narrow screens better than the width-growing arcs view.

Decision from brainstorming: **Ayaki-styled stairs** — traditional geometry, native
visual language (rounded bunsetsu boxes, clean SVG connectors), NOT terminal-faithful
ASCII glyphs.

## Layout — `src/lib/stairlayout.ts`

- One row per bunsetsu, in sentence order; row height matches the other views'
  box height, plus furigana headroom when enabled.
- Each row is indented one uniform step further right than the previous
  (`x = index * STEP`), producing the stair.
- Connectors: from the dependent box's right edge, horizontally right to a **rail
  column**, vertically down to the head's row, then into the head box's right edge
  with the existing arrowhead marker.
- Rail columns are assigned by **arc nesting level** (an arc enclosing another gets a
  rail further right), guaranteeing no connector crossings — the same invariant and
  computation as the arcs view's heights, rotated 90°. The nesting-level helper is
  **extracted from `arclayout.ts` and shared**, not duplicated.
- Layout output: per-bunsetsu box positions, per-dependency connector polyline
  points, and total width/height. Width is bounded by stair depth + rail count;
  height grows linearly with bunsetsu count (the long-sentence advantage).

## Component — `src/components/StairView.svelte`

- Identical props interface to the other views:
  `{ bunsetsu: BunsetsuVM[]; showFurigana?: boolean; selected?: number | null; onselect: (index: number) => void }`.
- Boxes are the same `g.bunsetsu` interactive groups: `role="button"`,
  `tabindex="0"`, `aria-label={b.surface}`, Enter/Space keydown, click with
  `stopPropagation()`, selection fill, hover highlight of the head — all matching
  the existing views (same CSS classes).
- Uncertain attachments: dotted amber connector (same `.low`-style treatment as
  arcs) with a nested `<title>` from the shared `confidenceLabel()`; forced-only
  attachments get a title too (gate on "anything to say", as everywhere).
- Furigana: rendered above each box; rows gain headroom when the toggle is on
  (same pattern as `ArcDiagram`'s `boxTop` offset). No furigana restrictions in
  this view.
- Root bunsetsu: no outgoing connector; gets the existing `root` styling class.
- Per-instance SVG ids (arrowhead marker) via `$props.id()`, as in the other views.
- SVG root: `role="group"` with a localized aria-label (new catalog key).

## Toolbar, settings, localization

- View toggle becomes three buttons: ⌒ arcs | 🌳 tree | 🎃 CaboCha (`aria-pressed`
  as today). 🎃 honors the tool's pumpkin pun (かぼちゃ).
- `Settings.view` widens to `'arcs' | 'tree' | 'cabocha'`; the validator's `view`
  line accepts the third code. Previously stored values remain valid; invalid ones
  still fall back to `'arcs'`.
- The `view` type union lives where it does today (settings + component props);
  all `'arcs' | 'tree'` unions in props widen accordingly (Toolbar, SentenceCard,
  App).
- New catalog keys (all four locales):
  - `viewCabocha`: the button label — "CaboCha" in ALL locales (proper noun,
    untranslated per the localization rule).
  - `stairsGroupLabel`: SVG group aria-label — en 'CaboCha dependency stairs',
    de 'CaboCha-Abhängigkeitstreppe', ja 'CaboCha式係り受け表示',
    zh 'CaboCha 依存阶梯'.
- `SentenceCard` renders `StairView` for `view === 'cabocha'`; error branch
  unchanged.

## Error handling

| Situation | Behavior |
| --- | --- |
| Single-bunsetsu sentence | one row, no connectors |
| Error sentence | unchanged — SentenceCard's error branch, no view rendered |
| Stored `view` value unknown to this version | settings validator falls back to `'arcs'`; `'cabocha'` is now a valid stored value |
| Furigana with empty readings | skipped per-bunsetsu (same as other views) |

## Testing

- `stairlayout` unit tests: row order and uniform indent; rail column =
  nesting level on the standard fixture; connector endpoints (dependent right edge
  → rail → head right edge); no two overlapping rails for nested arcs; furigana
  headroom toggling; single-bunsetsu degenerate case.
- Shared nesting helper: arcs-view tests stay green after the extraction
  (regression guard on `arclayout`).
- `StairView` component tests mirroring the ArcDiagram suite: one box per
  bunsetsu, one connector per non-root, `.low` styling + probability title on the
  uncertain fixture arc, forced-attachment title, furigana show/hide, `onselect`
  on click and Enter/Space, click propagation stopped, per-instance marker ids,
  localized group aria-label.
- Toolbar: three-way toggle renders, `aria-pressed` tracks, `view: 'cabocha'`
  persists and restores (settings validator test for the widened union).
- `SentenceCard`: renders StairView for `view === 'cabocha'`.

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

**Revised 2026-07-19** after user review against CaboCha's actual `write_tree`
(`tree.cpp`): the original spec's left-aligned uniform stair and nesting-level rail
region did not match the classic rendering. The faithful geometry (verified against
the CaboCha source, whose indent is `max_len - len(surface) + i * 2`):

- One row per bunsetsu, in sentence order; row height matches the other views'
  box height, plus furigana headroom when enabled.
- **Right edges** form the uniform stair: `xRight(i) = maxBoxWidth + i * STEP`;
  each box is **right-aligned** to its edge (`x = xRight(i) - width`). Left edges
  therefore vary with surface length — this is what gives the classic
  structure-suggesting shape.
- **One rail per head**, in the head's own column: `railX(head) = xRight(head) +
  RAIL_GAP`. Every dependent of that head runs horizontally from its right edge to
  the shared rail, down to the head's row, then a short leftward stub into the head
  box's right edge (arrowhead) — the `-D` column of the terminal output.
- Crossing-freedom follows from sasara's non-crossing parses directly: a head
  further right owns a further-right rail, so nested arcs get nested rails; the
  nesting-level helper is NOT needed for this view (it remains where it was
  extracted, used by the arcs view).
- Layout output: per-bunsetsu box positions, per-dependency connector path +
  `railX`, and total width/height. Width ≈ last head's rail (compact — rails
  interleave with the stair); height grows linearly with bunsetsu count (the
  long-sentence advantage).
- Chain artifact (dep's outgoing line coinciding with the incoming stub on its own
  row, e.g. 映画を→見に→行きました) is the classic CaboCha look and accepted.

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

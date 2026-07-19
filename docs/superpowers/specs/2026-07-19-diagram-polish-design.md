# Diagram Polish: Confidence Toggle, Hover Hit-Area, Furigana Halo, Rail Gap — Design

**Date:** 2026-07-19
**Status:** Approved

## Problem

Four diagram-display refinements, one iteration:

1. Uncertainty display (dotted amber connectors + confidence labels in the
   inspector) is specialist knowledge that irritates casual users — make it
   optional, default off.
2. The probability hover on connector lines requires hitting a 1.5px stroke —
   nearly impossible to aim at.
3. In the arcs view, arcs and arrowheads collide with the furigana strip
   (readings render at `boxTop - 4`, inside the arc band), making readings
   hard to read. Decision from the visual-companion session: **variant C** —
   background halo behind furigana text plus extra arc headroom when furigana
   is on. The halo also applies to the tree view (user request); the tree's
   milder collision needs no geometry change.
4. CaboCha view: the arrow stubs into head boxes are squeezed, visibly so when
   a selection thickens the box strokes — give them more room.

## 1. Confidence toggle

- **Setting:** `showConfidence: boolean`, DEFAULT `false`, added to
  `src/lib/settings.ts` via the existing table pattern (one validator line
  `showConfidence: (v) => (typeof v === 'boolean' ? v : undefined)`, one
  DEFAULTS entry). Persisted like every other field; older stored payloads
  fall back to `false` field-wise.
- **Settings popup** (`SettingsMenu.svelte`): a third row after voice and
  rate — same `.row`/`.row-label` treatment, label via new catalog key
  `confidenceToggle`, containing a checkbox bound to a new
  `showConfidence = $bindable()` prop. The row is NEVER disabled by the
  no-voice state (it is a display option, not a speech option).
- **Catalog key** (all four locales, verb-form per user amendment):

  | key | en | de | ja | zh |
  | --- | --- | --- | --- | --- |
  | `confidenceToggle` | show attachment confidence | Zeige Anbindungskonfidenz | 係り受けの信頼度を表示 | 显示依存置信度 |

- **Effect when OFF** (the new default):
  - All three views render every connector in the normal solid style: the
    `.low`/`.forced` classes are simply not added (gate the class helper on a
    new `showConfidence?: boolean` prop; `.hl` behavior unchanged).
  - Inspector hides the "N of M attachments uncertain" summary and the
    per-bunsetsu "attachment: {label}" line (gate both on a new
    `showConfidence` prop).
  - Hover `<title>` tooltips with the probability REMAIN in both states, in
    all views (requirement 2 explicitly keeps them).
- **Plumbing:** App owns the state (from `loadSettings`), saves it in the
  existing `$effect`, passes `showConfidence` to `SettingsMenu` (bindable),
  `SentenceCard` → the three views, and `Inspector` (plain props).

## 2. Forgiving hover (all three views)

Each connector (arc path / tree edge line / stair connector path) is wrapped
in a `<g class="connector">` containing:

1. the visible path/line exactly as today (classes, marker, geometry), and
2. an invisible hit twin with identical geometry: `class="hit"`,
   `stroke-width: 12`, CSS `stroke: transparent; fill: none;
   pointer-events: stroke;`.

The `<title>` moves from the visible element onto the `<g>`, so hovering
either child shows the tooltip. Titles are present whenever there is
something to say (same `confidenceLabel` gate as today), independent of
`showConfidence`.

## 3. Furigana halo + arc headroom (variant C)

- **Halo (all views):** CSS in `app.css`:
  `svg text.furigana { paint-order: stroke; stroke: #fff; stroke-width: 3px; }`
  (`#fff` = card background). Readings render after connectors in all three
  views' DOM order, so the halo occludes line segments beneath the text.
- **Arc headroom (arcs view only):** `layoutArcs` gains an optional base
  parameter: `layoutArcs(surfaces, heads, arcBase = 22)`. `ArcDiagram`
  passes `30` when `showFurigana` is on, `22` (default) otherwise. `ARC_STEP`
  unchanged. Diagrams grow ~8px with furigana on.
- Tree view geometry unchanged (milder collision, halo suffices — user
  decision).

## 4. CaboCha rail gap

`RAIL_GAP` in `src/lib/stairlayout.ts` changes 10 → 16. Everything else
(right-aligned stair, STEP, per-head rails) is untouched; each arrow stub
into a head box gains 6px, and the total layout width grows accordingly
(width = max railX).

## Not changing

- `src/lib/speech.ts`, `src/lib/i18n.svelte.ts` (beyond the four catalogs
  gaining `confidenceToggle`), `LocaleSwitcher`, `Toolbar`.
- `viewmodel.ts` (`confidenceLabel`/`isUncertain` stay as-is — only their
  call sites gate on the new setting).
- Tooltips/titles: same content and gating as today.

## Error handling

| Situation | Behavior |
| --- | --- |
| Stored settings without `showConfidence` | field-wise fallback → `false` |
| Toggle off + forced/uncertain attachment | solid connector, no inspector labels; hover title still explains |
| Furigana off | halo CSS inert (no furigana text), arcs use base 22 — pixel-identical to today |
| `paint-order` unsupported (pre-2016 browsers) | halo absent, text renders as today — acceptable degradation |

## Testing

- `settings`: `showConfidence` validated (booleans pass, junk → default
  false), round-trips.
- `SettingsMenu`: third row renders with the localized label; checkbox
  toggles the bindable; row stays enabled in the no-voice state.
- Per view (arcs/tree/cabocha): with `showConfidence` off (default) the
  uncertain/forced fixture renders NO `.low`/`.forced` element but the
  hover title is still present; with it on, classes return (existing
  assertions, now behind the prop).
- Hit twins: each connector group contains a `.hit` element with the same
  `d`/coordinates and the group carries the title.
- `arclayout`: `layoutArcs(..., 30)` raises every arc's `top` and
  `arcAreaHeight` by 8; default parameter preserves current output exactly.
- `stairlayout`: `railX(head) = xRight(head) + 16`; stair invariants
  (right-edge steps of `STEP`) unchanged.
- `Inspector`: confidence summary and attachment line hidden when
  `showConfidence` is false, shown when true; everything else unchanged.
- `App`: toggle round-trips through the popup into localStorage; views
  reflect it without re-parsing.
- README screenshots: `npm run shots` regenerates all three (arcs scene now
  shows solid lines by default); arcs alt text drops "confidence styling".

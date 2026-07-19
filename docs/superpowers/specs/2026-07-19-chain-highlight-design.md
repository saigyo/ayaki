# Chain-to-Main-Verb Highlight + Weak-Attachment Restyle — Design

**Date:** 2026-07-19
**Status:** Approved

## Problem

The CaboCha-style insight (from the user's Claude chat, mockups reproduced in
the visual-companion session): from any bunsetsu you can trace the dependency
chain all the way to the main verb — the head of the Japanese sentence. Ayaki
should show this: selecting a bunsetsu highlights, in addition to today's
immediate-link highlight, the entire onward chain to the root in a distinct
treatment (colored connectors + tinted boxes — companion card "C" style, color
configurable).

Prerequisite decided alongside: weak attachments give up their amber. They are
restyled as **pattern + lightness** (dashes as today, in a lighter shade of the
normal line color), which reads for color-blind users and frees amber to be
the default chain color (highest contrast against the blue selection).

Decisions from brainstorming:
- Chain traces on **selection only**; hover keeps today's immediate-link
  highlight.
- Chain color is a setting: `amber | green | violet | none`, DEFAULT `amber`;
  `none` = exactly today's behavior.
- Box tinting is part of the chain treatment (all colors).
- A help popup explaining the visual vocabulary is deliberately deferred to
  the next iteration.

## 1. Weak-attachment restyle — `src/app.css`

- New CSS variable `--uncertain-line: #aab6d1` (a lighter shade of `--arc`
  `#7c8db5`).
- The diagram rules for `.low` and `.forced` (arcs `path.arc`, tree
  `line.edge`) switch `stroke: var(--uncertain)` → `stroke:
  var(--uncertain-line)`. Dash patterns unchanged (`5 3` low, `2 3` forced).
- `--uncertain` (amber) stays and remains used by the Inspector's TEXT
  elements (`.confidence.uncertain`, `.confidence-note`) — in prose there is
  no collision with the chain color, and the caveat should stand out.
- Applies in both `showConfidence` states (it's the same classes, just a new
  color when they render).

## 2. Chain palette — `src/lib/chainpalette.ts` (new)

```ts
export type ChainColor = 'amber' | 'green' | 'violet' | 'none'
export const CHAIN_COLORS: ChainColor[] = ['amber', 'green', 'violet', 'none']
export const CHAIN_PALETTE: Record<Exclude<ChainColor, 'none'>, { line: string; soft: string }> = {
  amber: { line: '#b07a2a', soft: '#f7ead3' },
  green: { line: '#2e7d6e', soft: '#e2f2ec' },
  violet: { line: '#7b5ea5', soft: '#ece5f6' },
}
```

(The values are the companion-mockup colors the user chose between.)

## 3. Setting

- `Settings.chainColor: ChainColor`, DEFAULT `'amber'`, one validator line
  (`CHAIN_COLORS.includes(...)`), persisted like every field; older payloads
  fall back field-wise to `'amber'`.
- `settings.ts` imports the type/list from `chainpalette.ts` (same pattern as
  `Locale` from i18n).

## 4. Settings popup — `SettingsMenu.svelte`

New row after the confidence checkbox: standard `.row`/`.row-label` (label
above), containing a `<select>` bound to a new `chainColor = $bindable()`
prop (per-option `selected` is unnecessary here — plain `bind:value` is fine
because every value is a valid option; keep whichever matches the file's
style). Options in order: amber, green, violet, none — localized. Never
disabled by the no-voice state.

Catalog keys (all four locales):

| key | en | de | ja | zh |
| --- | --- | --- | --- | --- |
| `chainLabel` | chain to main verb | Kette zum Hauptverb | 主動詞への連鎖 | 主动词依存链 |
| `chainAmber` | amber | Bernstein | 琥珀色 | 琥珀色 |
| `chainGreen` | green | Grün | 緑 | 绿色 |
| `chainViolet` | violet | Violett | 紫 | 紫色 |
| `chainNone` | none | keine | なし | 无 |

## 5. Chain computation and rendering (all three views)

- Each view gains `chainColor?: ChainColor` (default `'none'`).
- With a selection `i` and `chainColor !== 'none'`:
  - **Unchanged:** the immediate link (connector of dep `i`) and the head box
    get `.hl` exactly as today; the selected box keeps its `selected` fill.
  - **Chain links:** the connectors of deps `head(i)`, `head(head(i))`, … up
    to (excluding) the root's null head get class `chain`.
  - **Chain boxes:** the boxes of `head(head(i))`, …, root get class `chain`
    on their `g.bunsetsu`. (The immediate head keeps plain `.hl`; boxes
    strictly beyond it are chain-tinted, root included — matching the
    approved mockup.)
  - Selected bunsetsu = root or its head = root → chain sets are empty (only
    today's behavior remains).
- Computation: shared helper `chainFrom(heads, selected): { links: Set<number>; boxes: Set<number> }`
  in `chainpalette.ts` — a bounded walk (visited-guard; sasara's parses are
  acyclic and rightward, the guard is defense only). Views call it in a
  `$derived`.
- **Color plumbing:** when `chainColor !== 'none'`, the view sets inline
  custom properties on its `<svg>`:
  `style="--chain: {line}; --chain-soft: {soft}"`. CSS is written once:

  ```css
  svg path.arc.chain, svg line.edge.chain { stroke: var(--chain); stroke-width: 3; }
  svg .bunsetsu.chain rect { fill: var(--chain-soft); stroke: var(--chain); }
  ```

- **Arrowheads:** each view's `<defs>` gains a second marker
  `arrowhead-chain-{uid}` with `fill: var(--chain)`; chain connectors use it,
  non-chain connectors keep the existing marker.
- **Hover:** unchanged — `hovered` never produces `chain` classes.
- **Confidence interplay:** a connector that is both `.low`/`.forced` and
  `.chain` keeps its dash pattern and takes the chain color (the `.chain`
  stroke rule wins — ordering/specificity ensures it). The trace stays
  continuous; uncertainty stays visible inside it.

## 6. Plumbing

App owns `chainColor` (from `loadSettings`), saves it in the existing
`$effect`, binds it into `SettingsMenu`, passes it plain to `SentenceCard`
→ the three views. Inspector is NOT involved (chain is a diagram concept).

## Not changing

- Hover behavior, selection mechanics, Escape handling, `viewmodel.ts`,
  `speech.ts`, Inspector markup (its amber text keeps `--uncertain`).
- The `showConfidence` setting semantics (only the color of `.low`/`.forced`
  lines changes, via CSS).

## Error handling

| Situation | Behavior |
| --- | --- |
| Stored payload without `chainColor` / junk value | field-wise fallback → `'amber'` |
| `chainColor: 'none'` | no `.chain` classes, no custom properties — DOM identical to today |
| Selected root (no head) | no immediate link (as today), no chain |
| Head = root (chain would be empty) | `.hl` only, no `.chain` elements |
| Malformed heads (cycle) | visited-guard terminates the walk |
| Chain link also uncertain | dashed line in chain color |

## Testing

- `chainpalette`: `chainFrom` on the standard fixture (chain from the first
  bunsetsu = all onward links/boxes; from the last = empty; visited-guard on
  a synthetic cycle).
- `settings`: `chainColor` validation (four codes pass, junk → `'amber'`).
- Per view: with `selected` + `chainColor: 'amber'` — chain connectors have
  `.chain` and the chain marker, chain boxes tinted via class, the immediate
  link still `.hl` and NOT `.chain`; `chainColor: 'none'` → zero `.chain`
  elements; hover alone → zero `.chain`; svg carries the palette custom
  properties.
- CSS interplay: uncertain chain link renders with dash + chain color
  (class assertions; visual verification in the final review's live pass).
- `SettingsMenu`: chain row present with localized label + four options,
  round-trips the bindable, enabled without voices.
- `App`: chain color persists; changing it re-renders without re-parse.
- Weak-attachment restyle: existing `.low`/`.forced` class assertions are
  color-agnostic (classes unchanged) — no test changes needed; the final
  review verifies the computed color live.
- README screenshots: `npm run shots` regenerates all three; tree + cabocha
  scenes (映画を selected) now show the amber chain — alt texts updated to
  mention the traced chain.

## Deferred (next iteration)

Help popup explaining the visual vocabulary: highlight/tint legend
(reusing the companion SVG mockups), and the weak-attachment rationale — the
parse comes from a statistical model and can be wrong; the confidence display
helps you stay critical of the results. Content ideas recorded in project
memory.

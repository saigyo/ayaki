# UI Cleanup — Three-Band Page Layout

**Date:** 2026-07-22
**Status:** Approved

## Goal

Reorganize the app's top-level page into three optically distinct regions —
header, text-entry, and results — separated by thin horizontal rules, so the
structure reads clearly at a glance. Fix two long-standing layout quirks along
the way: the input no longer spanning the full width, and the right-hand
inspector card floating up above the first view box.

## Motivation

Today the page is a header row followed by a two-column grid (`1fr / 320px`).
The `SentenceInput` lives *inside* the left grid column, which causes three
problems:

1. The input only spans the left `1fr` column instead of the full content width.
2. The parse button hugs the **bottom** of the textarea (`align-items: flex-end`).
3. Because the input shares the grid's first row, the inspector (right column,
   `align-items: start`) rises to the top of that row — sitting **higher than
   the top of the first view box**.

Pulling the input out of the grid into its own full-width band fixes all three
at once and gives the page a clear three-part rhythm.

## Design

### Structure

Inside `.app`, three regions stack vertically, separated by thin horizontal
rules:

```
header    brand + locale · toolbar (furigana + view buttons) · help · settings
────────  hairline rule
entry     full-width textarea + parse button; status messages beneath
────────  hairline rule   ← rendered only when results exist
results   grid: view cards (left) · inspector (right)
footer    unchanged (already has its own top border)
```

### Header

Unchanged in content and arrangement: brand (`文木 Ayaki` + locale switcher),
the toolbar (furigana toggle + view buttons), the help trigger, and the
settings menu. A hairline rule is added directly beneath it.

### Entry band

- The `SentenceInput` moves **out** of the left grid column and becomes a
  full-width band spanning the whole content area.
- The textarea keeps `flex: 1`. The parse button changes from
  `align-items: flex-end` (bottom-aligned) to **`flex-start`** (top-aligned),
  so it stays anchored to the top when the textarea is resized taller.
- The status messages — the idle hint (with the "parse the example" link),
  the `loading…` line, and the error banner with its retry button — render
  directly **below** the input, inside this band. They are outside the results
  grid.

### Results band — clean first load

- The second rule and the results grid render **only when
  `status === 'ready'`**. Before the first parse — and while `loading` or on
  `error` — there is no second rule and no inspector placeholder. The page
  shows only header · rule · input · status line.
- Once results exist, the grid appears: view cards in the left column,
  inspector in the right. Because the input is no longer in the grid, the
  grid's first row is the first view card, so the inspector starts **level
  with the top of the first view box**.
- The inspector keeps its existing `position: sticky; top: 1rem`, so it stays
  in view while scrolling long multi-sentence results. (The "not higher than
  the first view box" requirement is about its *initial* position, which the
  restructure fixes; sticky scroll behavior is unchanged and desirable.)
- The grid keeps `grid-template-columns: 1fr 320px` and collapses to a single
  column at `max-width: 800px`, exactly as today.

### Separators

Both rules are a **1px hairline** in the existing border color
(`--box-stroke`, `#b9c4d8`), spanning the full width of the content area —
matching the footer's existing `border-top` for visual consistency.

### Semantics & test compatibility

- The results grid stays wrapped in a `<main>` element. All `main`-scoped DOM
  queries in the unit tests and the Playwright scripts
  (`readme-shots.mjs`, `live-check.mjs`, `browser-smoke.mjs`) continue to
  target the real diagrams and exclude the always-mounted help-dialog demo,
  which remains inside `<header>`.
- On the idle screen `<main>` contains the entry band but no diagrams; the
  smoke/live-check scripts parse the example before querying, so the results
  grid exists by the time any diagram query runs.

## Out of Scope

- No component logic changes; no changes to the inspector, cards, or diagram
  internals.
- No new settings and nothing added to share links (there is no new state to
  persist).
- No new user-facing strings (the status messages and their copy are unchanged;
  they only move position).
- No responsive redesign beyond preserving the existing 800px single-column
  collapse.

## Testing

- Unit (component) tests assert the new DOM structure: a full-width entry
  region outside the grid, the results grid rendered only in the `ready`
  state, and two hairline rules in the expected places.
- The existing `main`-scoped queries must keep passing unchanged.
- A real-browser check (extending `live-check.mjs` if warranted, or the
  existing smoke gate) confirms: input spans full width, the button is
  top-aligned, and the inspector's top aligns with the first view card after a
  parse. Idle state shows no results band.
```

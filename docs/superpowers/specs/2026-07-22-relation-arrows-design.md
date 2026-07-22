# Relation Labels on Arrows + Clause Extents — Design

**Date:** 2026-07-22
**Status:** approved design, pre-implementation
**Predecessor:** `2026-07-21-relation-labels-design.md` (badge display, shipped in PR #27)

## Motivation

The shipped badge display puts relation labels *under bunsetsu boxes*, which
misreads for clause labels: "relative clause" under 新しい claims something
about one word, when the label really describes the **relation between the
whole subtree and its head** (in 新しい映画を, the relative clause is the whole
stretch; 新しい is only its predicate). This is true of every dependency label
(the "object" in 新しい映画を is the whole subtree too) — which is why UD
diagrams label the **arcs**, not the nodes. A second mismatch: our arrows point
dependent → head (the Japanese kakari-uke convention), while UD draws
head → dependent; mixing UD-style labels with kakari-uke arrows is confusing.

This feature moves relation labels onto the edges (as the new default), makes
arrow direction an explicit setting, marks clause heads as predicates of their
clauses, and visualizes clause extents on hover/selection.

Japanese dependencies are strictly head-final and projective, so **every
subtree is a contiguous span ending at its head** — extents are always clean
spans in every view.

## Two new settings

Both are global (apply to all three views), persisted in `ayaki-settings`,
and **excluded from share links** (like all display settings).

### `relationDisplay: 'off' | 'badges' | 'arrows'` — default `'arrows'`

Replaces the boolean `showRelations`.

- `off` — no relation labels anywhere in the diagrams.
- `badges` — the shipped PR #27 look: label under every bunsetsu box.
- `arrows` — labels on the edges; boxes carry badges only where a box-level
  statement is true: **"main predicate"** under the root, **"predicate"**
  under every relative-/linked-clause head (see Terminology).

**Migration** in `loadSettings()`: if the stored object has no
`relationDisplay` but has a boolean `showRelations`, map `false → 'off'` and
`true → 'arrows'` (true was the shipped default, not a deliberate badge
preference). Absent both → default `'arrows'`. The legacy key is dropped on
the next save. Validator: one of the three literals, else default.

### `arrowDirection: 'ud' | 'kakariuke'` — default `'ud'`

- `ud` — arrows point **head → dependent** (UD convention; reads "X has a
  ⟨label⟩: Y"). This flips the app's previous default appearance.
- `kakariuke` — arrows point **dependent → head** (the CaboCha / 係り受け
  convention; today's look), for users following Japanese linguistics
  materials.

Applies in **every** `relationDisplay` mode. Exception: the **tree view is
arrowless in both directions** (as today) — its top-down hierarchy already
encodes direction, so both settings render it identically.

### Settings UI

In `SettingsMenu.svelte`, replace the `showRelations` check-row with two
compact rows, each a labeled `<select>` (same pattern as the voice select),
placed where the relations check-row is today:

- `relationDisplayLabel` → options `relationDisplayOff` /
  `relationDisplayBadges` / `relationDisplayArrows`
- `arrowDirectionLabel` → options `arrowDirectionUd` /
  `arrowDirectionKakariuke`

## Terminology (global rename)

- The root's display term changes from "predicate" to **"main predicate"**
  everywhere it appears — diagram badges (all modes), Inspector relation
  line, help legend. Locales: en `main predicate`, de `Hauptprädikat`,
  ja `主節の述語`, zh `主要谓语`.
- A new term **"clause predicate badge"** (i18n key `relClausePredicate`)
  renders under relative-/linked-clause heads in arrows mode only, with the
  *old* predicate strings: en `predicate`, de `Prädikat`, ja `述語`,
  zh `谓语`. It is **not** a new `RelationLabel` — those heads keep their
  relation (`relclause` / `linkedclause`), which is shown on their arrow;
  the badge states their role *inside* their own clause.
- `src/lib/relations.ts` (labeler, `RELATION_LABELS`, `RELATION_UD`) is
  untouched. The Inspector's UD link for the root still points at `root`,
  and the topic hedge ("usually nsubj") is unchanged.

Rationale (Markus's call): the qualifier lands on the unique element — one
main predicate per sentence, possibly many clause predicates — and it teaches
the right generalization: *every clause has a predicate*.

## Arrows-mode rendering, per view

Shared: edge labels use the existing `.relation-label` styling (10px, muted)
plus a **halo** for legibility over lines (`paint-order: stroke` with the
app background color; both light and dark themes via `app.css`). All labels
and badges stay `aria-hidden="true"`; group aria-labels are unchanged.

### Arc view (`ArcDiagram.svelte`)

- Label at the **arc apex**: x = midpoint of the arc's endpoints, baseline
  ≈ 4px above the curve's peak (cubic peak is at `boxTop − 0.75 · top`).
- Direction: for `ud`, the path is drawn head → dependent so the existing
  `marker-end` arrowhead lands on the dependent; for `kakariuke`, as today.
- Box min-widths: keep the PR #27 `minWidths` growth (from each dependent's
  label width) in arrows mode too — it spaces the apex labels of adjacent
  same-level arcs.
- Badges: "main predicate" under the root, "predicate" under clause heads,
  in the existing under-box badge slot (`REL_H` headroom stays on in arrows
  mode since the root badge always exists).

### Stair view (`StairView.svelte`, `stairlayout.ts`)

- Geometry unchanged in essence: per-head rails, elbow connectors.
- Label at the **branch corner**: right-aligned (`text-anchor="end"`) at
  `railX − 4`, baseline ≈ 5px above the dependent's horizontal segment. The
  corner is where the clause's subtree visually branches off — that is the
  point the label describes (Markus's rationale for corner placement).
- To guarantee the label fits its own segment, `layoutStairs` accepts
  optional per-dependent label widths and widens rails as needed:
  `railX(head) ≥ depRightEdge + labelWidth(dep) + 8` for every dependent of
  that head, and rail order stays monotonic in head index (non-crossing
  parses guarantee a valid ordering exists; enforce
  `railX(h) ≥ railX(previous rail-owning head) + 8`).
- Direction: for `ud`, the connector path is drawn from the head's right
  edge to the dependent's right edge so `marker-end` puts the arrowhead on
  the **dependent** — a side benefit: each dependent gets its own arrowhead
  instead of several arrowheads stacking at a shared head edge. For
  `kakariuke`, today's path and arrowhead.
- Badges: same rule as arc view, under the boxes.

### Tree view (`NodeTree.svelte`, `treelayout.ts`)

- Always arrowless (both directions).
- Label at the **foot of each edge, directly above the dependent box**,
  centered on the box — visually capping the entire subtree hanging below
  it. With furigana on, the stack above each box is (top → bottom):
  **relation label → furigana → box**; the edge passes behind both texts
  (halo keeps the label legible).
- `layoutTree` gains an optional `levelH` parameter (default 70); NodeTree
  passes `70 + 18` in arrows mode (plus the existing furigana headroom) so
  rows have room for the label.
- Badges: same rule, under the boxes; edges keep starting below the badge
  slot as today.

Badges mode (`'badges'`) renders exactly as shipped, apart from the root
badge now reading "main predicate".

## Clause-extent bracket

- New pure helper `src/lib/extent.ts`:
  `subtreeSpan(heads: (number | null)[], i: number): { from: number; to: number }`
  — the contiguous index span of `i`'s subtree. Head-finality makes `to = i`;
  `from` = the leftmost transitive dependent. Unit-tested directly.
- Trigger: a bunsetsu with relation `relclause` or `linkedclause` is
  **hovered or selected** (the existing `hovered` / `selected` state in each
  view). Active in **all three** `relationDisplay` modes.
- Rendering: a thin bracket (~1.6px, muted amber `#b08d3e`-family with a
  dark-mode variant in `app.css`, class `extent-bracket`, `aria-hidden`),
  with short end-ticks toward the boxes:
  - **Arc view:** horizontal, below the span's boxes (beneath the badge
    slot), from the first box's left edge to the clause head's right edge.
  - **Stair view:** vertical, on the **left**, spanning the covered rows
    (left of the span's leftmost box edge; the staircase leaves that flank
    free below the first row).
  - **Tree view:** vertical, spanning the subtree's rows, on the **side
    with more clearance**: compare the horizontal gap between the subtree's
    bounding band and the nearest foreign box within the same row range on
    each side (diagram edge counts as open space); ties → right.
- Coexists with the chain highlight (bracket is additive; no z-order
  conflict — it renders behind boxes).

## Inspector, help, docs, tooling

- **Inspector:** unchanged except the root term now renders "main
  predicate" (it already displays relations relationally: "term → head").
- **Help dialog** (section 8, "relations"): intro updated to describe labels
  on arrows as the default and name both settings; the legend's predicate
  entry becomes "main predicate"; one added sentence for the extent
  bracket. The demo `StairView` renders in arrows mode + `ud` direction, so
  hovering the demo's clause bunsetsu shows the bracket live.
- **`scripts/live-check.mjs`** (13th check adapts): with the example
  sentence parsed, expect edge labels + badges under the arrows default —
  label texts include `object`, badge texts include `main predicate`; count
  of `.relation-label` texts in `main` = 6 edge labels + 3 badges = 9 for
  the 7-bunsetsu example; then select 見に and assert an `.extent-bracket`
  exists.
- **README screenshots:** regenerate all three via `npm run shots` (scenes
  unchanged; visuals now show the arrows default).
- **`docs/relation-labels.md`:** short addendum: display modes, direction
  setting, main-predicate terminology; measurement sections unchanged (the
  labeler didn't change).

## Component prop changes

All three views + `SentenceCard` + `HelpDialog` demo: replace
`showRelations?: boolean` with `relationDisplay?: RelationDisplay` (default
`'off'` at component level) and add `arrowDirection?: ArrowDirection`
(default `'ud'`). `App.svelte` threads both settings through and includes
them in the saved-settings effect.

## Testing

- `settings.test.ts`: migration table (`showRelations` false/true/absent ×
  `relationDisplay` present/absent), validator round-trips for both new
  fields.
- `extent.test.ts` (new): `subtreeSpan` — leaf (span = itself), chain,
  branching subtree, root span = whole sentence, nested clauses.
- Per-view component tests: arrows mode renders edge labels with expected
  texts; badges only under root + clause heads with "main predicate" /
  "predicate"; direction flips the path orientation (assert `d`/marker
  endpoints); badges mode unchanged apart from rename; extent bracket
  appears on hover and on selection of a clause bunsetsu, not for others.
- `HelpDialog.test.ts`: demo uses arrows mode; legend shows "main
  predicate". `App.test.ts`: settings flow for both new fields.
- German strings: per-codepoint verification in review (standing rule;
  `Hauptprädikat` contains `ä`).

## Out of scope

- No change to `relations.ts` rules or the eval pipeline.
- No share-link encoding of the new settings.
- Extent brackets only for clause-named labels (`relclause`,
  `linkedclause`) — not for nominalized clausal subjects/objects.

Design settled with visual mockups (session `.superpowers/brainstorm/`,
gitignored): arc/stair/tree arrows-mode renderings, stair label-corner
choice, tree label+furigana stack, tint-vs-bracket comparison across views.

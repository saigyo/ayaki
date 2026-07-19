# Diagram Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Confidence display becomes an opt-in setting (default off); connector hovers get a 12px hit area; furigana gets a halo plus arc headroom; CaboCha arrows get 6px more room.

**Architecture:** Lib layer first (settings field, `layoutArcs` base parameter, `RAIL_GAP`), then the three views (hit twins, gated classes, halo CSS), then the plumbing ring (SettingsMenu row, catalogs, Inspector gating, App/SentenceCard pass-through). Controller regenerates screenshots at the end.

**Tech Stack:** Svelte 5 (runes), TypeScript, vitest + @testing-library/svelte (jsdom).

**Spec:** `docs/superpowers/specs/2026-07-19-diagram-polish-design.md`

## Global Constraints

- `showConfidence` DEFAULT is `false`; older stored payloads fall back field-wise.
- Hover `<title>` tooltips (probability / forced explanation) exist in BOTH toggle states, in all three views — the title moves onto the connector `<g>`, gated only by `confidenceLabel` returning something, never by `showConfidence`.
- `.hl` hover/selected highlighting of connectors is NOT gated by the toggle — only `.low`/`.forced` are.
- Hit twins: identical geometry to the visible connector, `class="hit"`, styled ONLY via CSS (`stroke: transparent; fill: none; stroke-width: 12; pointer-events: stroke`), no marker, no classes beyond `hit`.
- Halo CSS applies to `svg text.furigana` globally (all three views): `paint-order: stroke; stroke: #fff; stroke-width: 3px` — appended as a NEW rule, existing rules untouched.
- Arc headroom: `layoutArcs(surfaces, heads, arcBase = 22)`; ArcDiagram passes `showFurigana ? 30 : 22`. `ARC_STEP` unchanged. `RAIL_GAP` becomes 16 in stairlayout; STEP and the right-aligned stair are untouched.
- Catalog key `confidenceToggle` (verb form): en `show attachment confidence`, de `Zeige Anbindungskonfidenz`, ja `係り受けの信頼度を表示`, zh `显示依存置信度`. No other catalog changes.
- The confidence row in the settings popup is NEVER disabled by the no-voice state.
- `src/lib/viewmodel.ts` and `src/lib/speech.ts` are NOT modified.
- Do not weaken existing tests: where an assertion depended on the old always-on behavior, the test gains `showConfidence: true` (or opens the popup) — assertions themselves stay.
- Conventional Commits; the local git hook adds the Co-Authored-By trailer — never add trailers manually.
- All commands run from the repo root `/Users/markus/IdeaProjects/ayaki`.

---

### Task 1: Lib layer — settings field, arc base, rail gap

**Files:**
- Modify: `src/lib/settings.ts`, `src/lib/arclayout.ts`, `src/lib/stairlayout.ts`
- Test: `tests/lib/settings.test.ts`, `tests/lib/arclayout.test.ts`, `tests/lib/stairlayout.test.ts` (read each first; keep their existing style)

**Interfaces:**
- Produces: `Settings.showConfidence: boolean` (default false, validated); `layoutArcs(surfaces, heads, arcBase = 22)`; `RAIL_GAP = 16` (stair connectors' `railX = xRight(head) + 16`). Tasks 2–3 consume these.

- [ ] **Step 1: Write the failing tests**

Append to `tests/lib/settings.test.ts` (inside the existing describe, using the file's existing localStorage seeding pattern):

```ts
it('validates showConfidence and defaults it to false', () => {
  localStorage.setItem('ayaki-settings', JSON.stringify({ showConfidence: true }))
  expect(loadSettings().showConfidence).toBe(true)
  localStorage.setItem('ayaki-settings', JSON.stringify({ showConfidence: 'yes' }))
  expect(loadSettings().showConfidence).toBe(false)
  localStorage.setItem('ayaki-settings', JSON.stringify({}))
  expect(loadSettings().showConfidence).toBe(false)
})
```

Append to `tests/lib/arclayout.test.ts`:

```ts
it('raises every arc and the area height by an arcBase delta, defaulting to today', () => {
  const surfaces = ['猫が', '魚を', '食べた。']
  const heads = [2, 2, null]
  const base = layoutArcs(surfaces, heads)
  const raised = layoutArcs(surfaces, heads, 30)
  raised.arcs.forEach((a, i) => expect(a.top).toBe(base.arcs[i].top + 8))
  expect(raised.arcAreaHeight).toBe(base.arcAreaHeight + 8)
  expect(layoutArcs(surfaces, heads)).toEqual(base)
})
```

Append to `tests/lib/stairlayout.test.ts` (adapting the fixture call style used there):

```ts
it('offsets each rail 16px right of its head column', () => {
  const layout = layoutStairs(['新しい', '映画を', '見に'], [1, 2, null], { rowHeight: 46, boxCenterOffset: 17 })
  const widths = ['新しい', '映画を', '見に'].map((s) => textWidth(s) + 20)
  const maxW = Math.max(...widths)
  for (const c of layout.connectors) expect(c.railX).toBe(maxW + c.head * 24 + 16)
})
```

- [ ] **Step 2: Run to verify failures**

Run: `npx vitest run tests/lib/settings.test.ts tests/lib/arclayout.test.ts tests/lib/stairlayout.test.ts`
Expected: the three new tests FAIL (missing field / no third parameter / railX still +10). If existing stairlayout tests hard-code the old `+10`, note them — they get updated in Step 3.

- [ ] **Step 3: Implement**

`src/lib/settings.ts` — three one-line insertions:
- Interface, after `showFurigana: boolean`: `showConfidence: boolean`
- DEFAULTS: `showConfidence: false,` (after `showFurigana: false,`)
- Validators, after the `showFurigana` line: `showConfidence: (v) => (typeof v === 'boolean' ? v : undefined),`

`src/lib/arclayout.ts` — signature and use:

```ts
export function layoutArcs(surfaces: string[], heads: (number | null)[], arcBase = ARC_BASE): ArcLayout {
```

and in the arc loop: `const top = arcBase + ARC_STEP * (levels[i] - 1)`.

`src/lib/stairlayout.ts`: `const RAIL_GAP = 16` (was 10). Update any existing stairlayout tests that hard-coded the old gap (numbers only — invariant assertions stay).

- [ ] **Step 4: Run the lib suites, then the full check**

Run: `npx vitest run tests/lib` then `npm test && npm run check`
Expected: lib suites PASS. Full suite: component tests must still pass (no component consumes the new pieces yet — the default parameter and additive field keep behavior identical).

- [ ] **Step 5: Commit**

```bash
git add src/lib/settings.ts src/lib/arclayout.ts src/lib/stairlayout.ts tests/lib
git commit -m "feat: showConfidence setting, arcBase parameter, wider stair rail gap"
```

---

### Task 2: Views — hit twins, gated classes, halo

**Files:**
- Modify: `src/components/ArcDiagram.svelte`, `src/components/NodeTree.svelte`, `src/components/StairView.svelte`, `src/app.css` (append two rules)
- Test: `tests/components/ArcDiagram.test.ts`, `tests/components/NodeTree.test.ts`, `tests/components/StairView.test.ts` (read each first)

**Interfaces:**
- Consumes: `layoutArcs(..., arcBase)` from Task 1.
- Produces: each view gains optional prop `showConfidence?: boolean` (default `false`); connectors render as `<g class="connector">` = optional `<title>` + visible connector + `.hit` twin. Task 3 passes the prop through SentenceCard.

- [ ] **Step 1: ArcDiagram.svelte**

Props gain `showConfidence = false` (type `showConfidence?: boolean`). Layout call becomes:

```ts
const layout = $derived(layoutArcs(bunsetsu.map((b) => b.surface), bunsetsu.map((b) => b.head), showFurigana ? 30 : 22))
```

`arcClass` gates the confidence classes only:

```ts
function arcClass(dep: number): string {
  const b = bunsetsu[dep]
  const cls = ['arc']
  if (showConfidence) {
    if (b.forced) cls.push('forced')
    else if (isUncertain(b)) cls.push('low')
  }
  if (hovered === dep || selected === dep) cls.push('hl')
  return cls.join(' ')
}
```

The arcs block becomes (title on the group; `d` hoisted so the twin shares it):

```svelte
{#each layout.arcs as a (a.dep)}
  {@const label = confidenceLabel(bunsetsu[a.dep])}
  {@const d = `M ${a.x1 + PAD_X} ${boxTop} C ${a.x1 + PAD_X} ${boxTop - a.top}, ${a.x2 + PAD_X} ${boxTop - a.top}, ${a.x2 + PAD_X} ${boxTop}`}
  <g class="connector">
    {#if label}
      <title>{label}</title>
    {/if}
    <path class={arcClass(a.dep)} {d} marker-end="url(#arrowhead-{uid})" />
    <path class="hit" {d} />
  </g>
{/each}
```

- [ ] **Step 2: NodeTree.svelte**

Props gain `showConfidence = false`. The edges block becomes:

```svelte
{#each layout.edges as e (e.to)}
  {@const from = pos.get(e.from)!}
  {@const to = pos.get(e.to)!}
  {@const label = confidenceLabel(bunsetsu[e.to])}
  <g class="connector">
    {#if label}
      <title>{label}</title>
    {/if}
    <line
      class="edge"
      class:low={showConfidence && !bunsetsu[e.to].forced && isUncertain(bunsetsu[e.to])}
      class:forced={showConfidence && bunsetsu[e.to].forced}
      class:hl={hovered === e.to || selected === e.to}
      x1={from.x + PAD_X}
      y1={from.y + BOX_H + topPad}
      x2={to.x + PAD_X}
      y2={to.y + topPad}
    />
    <line class="hit" x1={from.x + PAD_X} y1={from.y + BOX_H + topPad} x2={to.x + PAD_X} y2={to.y + topPad} />
  </g>
{/each}
```

- [ ] **Step 3: StairView.svelte**

Props gain `showConfidence = false`. `connectorClass` gets the same `if (showConfidence)` gate around its `forced`/`low` pushes as ArcDiagram's `arcClass` (leave `hl` outside the gate). The connectors block becomes:

```svelte
{#each layout.connectors as c (c.dep)}
  {@const label = confidenceLabel(bunsetsu[c.dep])}
  <g class="connector">
    {#if label}
      <title>{label}</title>
    {/if}
    <path class={connectorClass(c.dep)} d={c.d} marker-end="url(#arrowhead-{uid})" />
    <path class="hit" d={c.d} />
  </g>
{/each}
```

- [ ] **Step 4: CSS**

Append to `src/app.css` after the existing shared-SVG block:

```css
/* readings stay legible where connectors cross them (arcs view especially) */
svg text.furigana { paint-order: stroke; stroke: #fff; stroke-width: 3px; }
/* invisible fat twin of each connector: a forgiving hover target for the title */
svg .connector .hit { fill: none; stroke: transparent; stroke-width: 12; pointer-events: stroke; }
```

- [ ] **Step 5: Update the three view test files**

Pattern, applied per file after reading it:
- Every existing assertion on `.low`/`.forced` classes (and their titles) now renders with `showConfidence: true` in the props.
- Title lookups change from `<connector>.querySelector('title')` to the group: `el.closest('g.connector')?.querySelector('title')`.
- Add to each file the two behavior tests, adapted to the view's selectors (`path.arc` / `line.edge` / `svg.stairview path.arc`), shown here in the ArcDiagram version:

```ts
it('renders plain connectors by default but keeps the probability title', () => {
  const { container } = render(ArcDiagram, { props: { bunsetsu, onselect: () => {} } })
  expect(container.querySelectorAll('.low, .forced')).toHaveLength(0)
  const titles = [...container.querySelectorAll('g.connector title')].map((el) => el.textContent)
  expect(titles.some((text) => text?.includes('55'))).toBe(true)
})

it('gives every connector an identical-geometry hit twin', () => {
  const { container } = render(ArcDiagram, { props: { bunsetsu, onselect: () => {} } })
  const groups = [...container.querySelectorAll('g.connector')]
  expect(groups.length).toBeGreaterThan(0)
  for (const g of groups) {
    const visible = g.querySelector('path.arc')!
    const hit = g.querySelector('path.hit')!
    expect(hit.getAttribute('d')).toBe(visible.getAttribute('d'))
  }
})
```

(NodeTree's twin comparison checks the four `x1/y1/x2/y2` attributes instead of `d`.)

- [ ] **Step 6: Run the affected suites, then the full check**

Run: `npx vitest run tests/components/ArcDiagram.test.ts tests/components/NodeTree.test.ts tests/components/StairView.test.ts`, then `npm test && npm run check`
Expected: PASS, 0 errors 0 warnings.

- [ ] **Step 7: Commit**

```bash
git add src/components/ArcDiagram.svelte src/components/NodeTree.svelte src/components/StairView.svelte src/app.css tests/components/ArcDiagram.test.ts tests/components/NodeTree.test.ts tests/components/StairView.test.ts
git commit -m "feat: gate confidence styling behind showConfidence, add hover hit twins and furigana halo"
```

---

### Task 3: Plumbing — popup row, catalogs, Inspector gating, App

**Files:**
- Modify: `src/components/SettingsMenu.svelte`, `src/components/SentenceCard.svelte`, `src/components/Inspector.svelte`, `src/components/App.svelte`, `src/lib/locales/{en,de,ja,zh}.ts`
- Test: `tests/components/SettingsMenu.test.ts`, `tests/components/Inspector.test.ts`, `tests/components/App.test.ts` (read each first)

**Interfaces:**
- Consumes: `Settings.showConfidence` (Task 1), views' `showConfidence` prop (Task 2).
- Produces: end-to-end flow — popup checkbox ⇄ App state ⇄ persistence ⇄ views + Inspector.

- [ ] **Step 1: Catalog key**

After each catalog's `settingsLabel` line add:
- en: `confidenceToggle: 'show attachment confidence',`
- de: `confidenceToggle: 'Zeige Anbindungskonfidenz',`
- ja: `confidenceToggle: '係り受けの信頼度を表示',`
- zh: `confidenceToggle: '显示依存置信度',`

- [ ] **Step 2: SettingsMenu third row**

Props gain `showConfidence = $bindable(false)` (type `showConfidence?: boolean`). After the rate `.row` div (before the no-voice note), add:

```svelte
<div class="row">
  <label class="row-label" for="conf-{uid}">{t('confidenceToggle')}</label>
  <input id="conf-{uid}" type="checkbox" bind:checked={showConfidence} />
</div>
```

No `disabled`, no `title` — this row is independent of the voice state.

- [ ] **Step 3: Inspector gating**

Props gain `showConfidence = false` (type `showConfidence?: boolean`). Two gates:
- The bunsetsu-mode attachment line: `{#if label}` → `{#if showConfidence && label}` (the block rendering `t('attachment', { label })`).
- The sentence-mode uncertainty summary: wrap its existing condition with `showConfidence &&` (the block rendering `t('uncertaintyNote', …)`).

Nothing else in Inspector changes (speak buttons, morphemes, links untouched).

- [ ] **Step 4: SentenceCard pass-through**

Props gain `showConfidence = false` (type `showConfidence?: boolean`); pass `{showConfidence}` to all three view components.

- [ ] **Step 5: App wiring**

- `let showConfidence = $state(initialSettings.showConfidence)`
- Save effect object gains `showConfidence` (the `saveSettings({ … })` call).
- `<SettingsMenu bind:rate bind:voiceURI bind:showConfidence />`
- `<SentenceCard … {showConfidence} …>` and `<Inspector … {showConfidence} …>`

- [ ] **Step 6: Update tests**

`tests/components/SettingsMenu.test.ts` — add:

```ts
it('offers the confidence toggle, enabled even without voices', async () => {
  vi.stubGlobal('speechSynthesis', fakeSynth([]))
  const user = userEvent.setup()
  render(SettingsMenu, { props: { ...base, showConfidence: false } })
  await user.click(screen.getByRole('button', { name: 'settings' }))
  const box = screen.getByRole('checkbox', { name: 'show attachment confidence' })
  expect(box).toBeEnabled()
  expect(box).not.toBeChecked()
  await user.click(box)
  expect(box).toBeChecked()
})
```

`tests/components/Inspector.test.ts`:
- The existing tests asserting `'1 of 2 attachments uncertain'` and `/P = 55%/` / forced-attachment lines gain `showConfidence: true` in their props.
- Add default-off coverage:

```ts
it('hides the confidence labels unless enabled', () => {
  render(Inspector, { props: { sentence, index: 0, total: 1, selected: null, rate: 1, voiceURI: null } })
  expect(screen.queryByText(/attachments uncertain/)).toBeNull()
  const bunsetsuView = render(Inspector, { props: { sentence, index: 0, total: 1, selected: sentence.bunsetsu[1], rate: 1, voiceURI: null } })
  expect(bunsetsuView.queryByText(/P = 55%/)).toBeNull()
})
```

`tests/components/App.test.ts`:
- The `'restores settings from localStorage and persists changes'` equality object gains `showConfidence: false`.
- Add the round-trip test (after the voice-binding test):

```ts
it('persists the confidence toggle and styles arcs without re-parsing', async () => {
  vi.mocked(parseText).mockResolvedValue([sentenceFixture()])
  const user = userEvent.setup()
  render(App)
  await user.type(screen.getByRole('textbox'), '猫が魚を食べた。')
  await user.click(screen.getByRole('button', { name: /parse/i }))
  await screen.findByText('食べた。')
  expect(document.querySelectorAll('.low, .forced')).toHaveLength(0)
  await user.click(screen.getByRole('button', { name: 'settings' }))
  await user.click(screen.getByRole('checkbox', { name: 'show attachment confidence' }))
  await tick()
  expect(document.querySelectorAll('path.arc.low').length).toBeGreaterThan(0)
  expect(JSON.parse(localStorage.getItem('ayaki-settings')!).showConfidence).toBe(true)
  expect(parseText).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 7: Run the affected suites, then the full check**

Run: `npx vitest run tests/components/SettingsMenu.test.ts tests/components/Inspector.test.ts tests/components/App.test.ts`, then `npm test && npm run check`
Expected: PASS, 0 errors 0 warnings.

- [ ] **Step 8: Commit**

```bash
git add src/components src/lib/locales tests/components/SettingsMenu.test.ts tests/components/Inspector.test.ts tests/components/App.test.ts
git commit -m "feat: wire showConfidence through popup, inspector and views"
```

---

### Task 4: Screenshot refresh (controller-run, not a subagent task)

Diagram rendering changed (solid connectors by default, halo, wider rails) → all three screenshots invalid.

- [ ] **Step 1:** `npm run shots`; visually verify: arcs scene shows SOLID lines and readable state; no uncertainty note in the inspector panel; cabocha rails visibly roomier.
- [ ] **Step 2:** `README.md` arcs alt text: drop "with confidence styling" (becomes "…— dependency arcs, the active sentence highlighted, …").
- [ ] **Step 3:** Commit: `git add docs/images README.md && git commit -m "docs: refresh screenshots for confidence toggle default-off"`.

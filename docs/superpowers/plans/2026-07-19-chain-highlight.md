# Chain Highlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Selecting a bunsetsu traces its whole dependency chain to the main verb (colored connectors + tinted boxes, configurable amber/green/violet/none, default amber) in all three views; weak attachments drop amber for dotted + lighter-base-color.

**Architecture:** New `src/lib/chainpalette.ts` (type, palette, `chainFrom` walk); `Settings.chainColor`; each view computes chain sets in a `$derived` and emits `.chain` classes + per-svg `--chain`/`--chain-soft` custom properties; CSS written once against the variables; popup gains a select row; App plumbs.

**Tech Stack:** Svelte 5 (runes), TypeScript, vitest + @testing-library/svelte (jsdom).

**Spec:** `docs/superpowers/specs/2026-07-19-chain-highlight-design.md`

## Global Constraints

- Chain semantics exactly: for selected `i`, the immediate link (dep `i`'s connector) and head box keep `.hl` (unchanged, NOT `.chain`); `.chain` goes on the connectors of `head(i)…` (each non-root ancestor) and the boxes of `head(head(i))…root`. `chainColor: 'none'` or no selection ⇒ zero `.chain` elements and no custom properties (DOM identical to today). Hover alone never produces `.chain`.
- Palette values exactly: amber `#b07a2a`/`#f7ead3`, green `#2e7d6e`/`#e2f2ec`, violet `#7b5ea5`/`#ece5f6`. Setting DEFAULT `'amber'`.
- Weak-attachment restyle: ONLY the stroke color of the four diagram rules (`path.arc.low/.forced`, `line.edge.low/.forced`) changes to a new `--uncertain-line: #aab6d1`; dash patterns, classes, and the Inspector's amber text (`--uncertain`) are untouched.
- Hover priority: the chain stroke rule carries `:not(.hl)` so a hovered connector on the chain still shows the accent highlight; chain boxes that are also `.hl` keep the accent stroke (explicit override rule).
- NodeTree edges have no arrowheads — no marker changes there; arcs + stairs chain connectors switch to a second `arrowhead-chain-{uid}` marker filled `var(--chain)`.
- Inspector is NOT involved; `viewmodel.ts`/`speech.ts` NOT modified.
- Catalog keys exactly as in the spec table (`chainLabel`, `chainAmber`, `chainGreen`, `chainViolet`, `chainNone` — en/de/ja/zh values from the spec).
- Test discipline: never weaken existing assertions; the App settings-equality test gains `chainColor: 'amber'`.
- Conventional Commits; the local git hook adds the Co-Authored-By trailer.
- All commands run from the repo root `/Users/markus/IdeaProjects/ayaki`.

---

### Task 1: chainpalette lib + setting

**Files:**
- Create: `src/lib/chainpalette.ts`
- Modify: `src/lib/settings.ts`, `src/components/App.svelte` (minimal type-fix only, see Step 3)
- Test: Create `tests/lib/chainpalette.test.ts`; modify `tests/lib/settings.test.ts` (inside the ORIGINAL `describe('loadSettings')`), `tests/components/App.test.ts` (equality object only)

**Interfaces:**
- Produces: `ChainColor`, `CHAIN_COLORS`, `CHAIN_PALETTE`, `chainFrom(heads, selected): { links: Set<number>; boxes: Set<number> }`; `Settings.chainColor: ChainColor` default `'amber'`. Tasks 2–3 consume all of these.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/chainpalette.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { CHAIN_COLORS, CHAIN_PALETTE, chainFrom } from '../../src/lib/chainpalette'

describe('chainFrom', () => {
  const heads = [1, 2, 3, null]
  it('collects links and boxes beyond the immediate head', () => {
    const { links, boxes } = chainFrom(heads, 0)
    expect([...links].sort()).toEqual([1, 2])
    expect([...boxes].sort()).toEqual([2, 3])
  })
  it('is empty when the head is the root or the selected bunsetsu is the root', () => {
    expect(chainFrom(heads, 2).links.size).toBe(0)
    expect(chainFrom(heads, 2).boxes.size).toBe(0)
    expect(chainFrom(heads, 3).links.size).toBe(0)
  })
  it('terminates on malformed cyclic heads', () => {
    const { links } = chainFrom([1, 0], 0)
    expect(links.size).toBeLessThanOrEqual(2)
  })
})

describe('CHAIN_PALETTE', () => {
  it('covers every non-none color with line and soft values', () => {
    for (const c of CHAIN_COLORS) {
      if (c === 'none') continue
      const entry = CHAIN_PALETTE[c]
      expect(entry.line).toMatch(/^#[0-9a-f]{6}$/)
      expect(entry.soft).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})
```

Append inside the ORIGINAL `describe('loadSettings')` block of `tests/lib/settings.test.ts` (directly after the `showConfidence` test):

```ts
it('validates chainColor and defaults it to amber', () => {
  localStorage.setItem(KEY, JSON.stringify({ chainColor: 'violet' }))
  expect(loadSettings().chainColor).toBe('violet')
  localStorage.setItem(KEY, JSON.stringify({ chainColor: 'pink' }))
  expect(loadSettings().chainColor).toBe('amber')
  localStorage.setItem(KEY, JSON.stringify({}))
  expect(loadSettings().chainColor).toBe('amber')
})
```

- [ ] **Step 2: Run to verify failures**

Run: `npx vitest run tests/lib/chainpalette.test.ts tests/lib/settings.test.ts`
Expected: chainpalette FAILs on missing module; the new settings test FAILs on missing field.

- [ ] **Step 3: Implement**

Create `src/lib/chainpalette.ts`:

```ts
export type ChainColor = 'amber' | 'green' | 'violet' | 'none'

export const CHAIN_COLORS: ChainColor[] = ['amber', 'green', 'violet', 'none']

export const CHAIN_PALETTE: Record<Exclude<ChainColor, 'none'>, { line: string; soft: string }> = {
  amber: { line: '#b07a2a', soft: '#f7ead3' },
  green: { line: '#2e7d6e', soft: '#e2f2ec' },
  violet: { line: '#7b5ea5', soft: '#ece5f6' },
}

export interface ChainSets {
  /** deps whose outgoing connector lies on the chain beyond the immediate link */
  links: Set<number>
  /** boxes strictly beyond the immediate head, root included */
  boxes: Set<number>
}

/**
 * Walk head pointers from the selected bunsetsu's head up to the root. The
 * immediate link and head box keep the existing `.hl` treatment, so the chain
 * sets start one step further out: links from the immediate head onward,
 * boxes from the head's head onward. The visited guard is defense against
 * malformed input only — sasara's parses are acyclic.
 */
export function chainFrom(heads: (number | null)[], selected: number): ChainSets {
  const links = new Set<number>()
  const boxes = new Set<number>()
  const visited = new Set<number>([selected])
  let cur = heads[selected]
  while (cur !== null && cur !== undefined && !visited.has(cur)) {
    visited.add(cur)
    const next = heads[cur]
    if (next === null || next === undefined) break
    links.add(cur)
    boxes.add(next)
    cur = next
  }
  return { links, boxes }
}
```

In `src/lib/settings.ts`:
- Add to the imports: `import { CHAIN_COLORS, type ChainColor } from './chainpalette'`
- Interface, after `showConfidence: boolean`: `chainColor: ChainColor`
- DEFAULTS: `chainColor: 'amber',` (after `showConfidence: false,`)
- Validators, after the `showConfidence` line:
  `chainColor: (v) => (CHAIN_COLORS.includes(v as ChainColor) ? (v as ChainColor) : undefined),`

In `src/components/App.svelte` — the required-field type-fix ONLY (full wiring is Task 3):
- `let chainColor = $state(initialSettings.chainColor)` next to the other setting states
- add `chainColor` to the `saveSettings({ … })` object

In `tests/components/App.test.ts`: the `'restores settings from localStorage and persists changes'` equality object gains `chainColor: 'amber',`.

- [ ] **Step 4: Run lib suites, then the full check**

Run: `npx vitest run tests/lib tests/components/App.test.ts`, then `npm test && npm run check`
Expected: PASS everywhere (nothing consumes the new pieces yet).

- [ ] **Step 5: Commit**

```bash
git add src/lib/chainpalette.ts src/lib/settings.ts src/components/App.svelte tests/lib/chainpalette.test.ts tests/lib/settings.test.ts tests/components/App.test.ts
git commit -m "feat: chain palette, chainFrom walk, chainColor setting"
```

---

### Task 2: Views — chain classes, markers, CSS restyle

**Files:**
- Modify: `src/components/ArcDiagram.svelte`, `src/components/NodeTree.svelte`, `src/components/StairView.svelte`, `src/app.css`
- Test: Modify `tests/fixtures.ts` (one new fixture), `tests/components/ArcDiagram.test.ts`, `tests/components/NodeTree.test.ts`, `tests/components/StairView.test.ts`

**Interfaces:**
- Consumes: `ChainColor`, `CHAIN_PALETTE`, `chainFrom` from Task 1.
- Produces: each view accepts `chainColor?: ChainColor` (default `'none'`) and renders `.chain` classes + `--chain`/`--chain-soft` on its svg. Task 3 passes the prop through SentenceCard.

- [ ] **Step 1: Chain fixture**

Read `tests/fixtures.ts` first; add, modeled on `sentenceFixture()`'s style:

`chainSentenceFixture(): ParsedSentence` — four bunsetsu 新しい / 映画を / 見に / 行きました。 with `heads [1, 2, 3, null]`, readings あたらしい / えいがを / みに / いきました。, probabilities 0.9 / 0.55 / 0.9 / null (bunsetsu 1 uncertain for the chain+low interplay), `forced: false` everywhere, morphemes minimal (reuse the file's `morphemeFixture` helper). Export it.

- [ ] **Step 2: Write the failing view tests**

Add to `tests/components/ArcDiagram.test.ts` (adapt imports; the other two files get the same pair adapted to their selectors — NodeTree: `line.edge.chain`, no marker assertion; StairView: `path.arc.chain`, marker assertion like arcs):

```ts
it('traces the chain beyond the immediate link on selection', () => {
  const chainB = chainSentenceFixture().bunsetsu
  const { container } = render(ArcDiagram, { props: { bunsetsu: chainB, selected: 0, chainColor: 'amber', onselect: () => {} } })
  const chains = container.querySelectorAll('path.arc.chain')
  expect(chains).toHaveLength(2)
  expect(container.querySelectorAll('g.bunsetsu.chain')).toHaveLength(2)
  const hl = container.querySelector('path.arc.hl')!
  expect(hl.classList.contains('chain')).toBe(false)
  for (const c of chains) expect(c.getAttribute('marker-end')).toContain('arrowhead-chain-')
  expect(container.querySelector('svg')!.getAttribute('style')).toContain('--chain')
})

it('renders no chain elements without selection or with chainColor none', () => {
  const chainB = chainSentenceFixture().bunsetsu
  const none = render(ArcDiagram, { props: { bunsetsu: chainB, selected: 0, chainColor: 'none', onselect: () => {} } })
  expect(none.container.querySelectorAll('.chain')).toHaveLength(0)
  expect(none.container.querySelector('svg')!.getAttribute('style') ?? '').not.toContain('--chain')
  const unselected = render(ArcDiagram, { props: { bunsetsu: chainB, chainColor: 'amber', onselect: () => {} } })
  expect(unselected.container.querySelectorAll('.chain')).toHaveLength(0)
})
```

Run them: `npx vitest run tests/components/ArcDiagram.test.ts tests/components/NodeTree.test.ts tests/components/StairView.test.ts -t 'chain'`
Expected: FAIL (unknown prop is ignored, no `.chain` elements found).

- [ ] **Step 3: Component changes (same pattern ×3)**

Script additions in each view:

```ts
import { CHAIN_PALETTE, chainFrom, type ChainColor } from '../lib/chainpalette'
```

Props gain `chainColor = 'none'` (type `chainColor?: ChainColor`). Derived state:

```ts
const chain = $derived(
  selected !== null && chainColor !== 'none'
    ? chainFrom(bunsetsu.map((b) => b.head), selected)
    : { links: new Set<number>(), boxes: new Set<number>() },
)
const palette = $derived(chainColor !== 'none' ? CHAIN_PALETTE[chainColor] : null)
```

Markup:
- The `<svg>` element gains `style={palette ? `--chain: ${palette.line}; --chain-soft: ${palette.soft}` : undefined}`.
- ArcDiagram + StairView `<defs>` gain a second marker after the existing one:

```svelte
<marker id="arrowhead-chain-{uid}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
  <path d="M 0 0 L 10 5 L 0 10 z" style="fill: var(--chain)" />
</marker>
```

- ArcDiagram: `arcClass` appends `if (chain.links.has(dep)) cls.push('chain')` (after the hl push); the visible path's marker becomes
  `marker-end={chain.links.has(a.dep) ? `url(#arrowhead-chain-${uid})` : `url(#arrowhead-${uid})`}`;
  the box `<g>` gains `class:chain={chain.boxes.has(i)}`.
- StairView: same three changes (`connectorClass`, connector `marker-end` with `c.dep`, box `class:chain={chain.boxes.has(i)}`).
- NodeTree: the visible edge `<line>` gains `class:chain={chain.links.has(e.to)}`; the box `<g>` gains `class:chain={chain.boxes.has(n.index)}`. No marker changes (edges have no arrowheads).

- [ ] **Step 4: CSS**

In `src/app.css`:
- `:root` gains `--uncertain-line: #aab6d1;` (after the `--uncertain` line).
- In the four existing rules `svg path.arc.low`, `svg path.arc.forced`, `svg line.edge.low`, `svg line.edge.forced`: change `stroke: var(--uncertain)` to `stroke: var(--uncertain-line)`. Nothing else in those rules changes.
- Append after the `.hit` rule:

```css
/* chain-to-main-verb trace; colors arrive per-view via --chain/--chain-soft.
   :not(.hl) keeps the hover/selection accent on top of a traced connector */
svg path.arc.chain:not(.hl), svg line.edge.chain:not(.hl) { stroke: var(--chain); stroke-width: 3; }
svg .bunsetsu.chain rect { fill: var(--chain-soft); stroke: var(--chain); }
svg .bunsetsu.chain.hl rect { stroke: var(--accent); stroke-width: 2; }
```

- [ ] **Step 5: Run the view suites, then the full check**

Run: `npx vitest run tests/components/ArcDiagram.test.ts tests/components/NodeTree.test.ts tests/components/StairView.test.ts`, then `npm test && npm run check`
Expected: PASS, 0 errors 0 warnings. All pre-existing view tests pass unchanged (default `'none'` keeps the DOM identical).

- [ ] **Step 6: Commit**

```bash
git add src/components/ArcDiagram.svelte src/components/NodeTree.svelte src/components/StairView.svelte src/app.css tests/fixtures.ts tests/components/ArcDiagram.test.ts tests/components/NodeTree.test.ts tests/components/StairView.test.ts
git commit -m "feat: chain-to-root tracing in all views, weak attachments restyled dotted-light"
```

---

### Task 3: Popup row, catalogs, plumbing

**Files:**
- Modify: `src/components/SettingsMenu.svelte`, `src/components/SentenceCard.svelte`, `src/components/App.svelte`, `src/lib/locales/{en,de,ja,zh}.ts`
- Test: `tests/components/SettingsMenu.test.ts`, `tests/components/App.test.ts` (read each first)

**Interfaces:**
- Consumes: `ChainColor` (Task 1), views' `chainColor` prop (Task 2), App's existing `chainColor` state (Task 1's type-fix).
- Produces: popup select ⇄ App state ⇄ persistence ⇄ views.

- [ ] **Step 1: Catalog keys**

After each catalog's `confidenceToggle` line add (values per locale from the spec table):

```ts
chainLabel: 'chain to main verb',
chainAmber: 'amber',
chainGreen: 'green',
chainViolet: 'violet',
chainNone: 'none',
```

(de: `Kette zum Hauptverb` / `Bernstein` / `Grün` / `Violett` / `keine`; ja: `主動詞への連鎖` / `琥珀色` / `緑` / `紫` / `なし`; zh: `主动词依存链` / `琥珀色` / `绿色` / `紫色` / `无`.)

- [ ] **Step 2: SettingsMenu row**

Props gain `chainColor = $bindable('amber')` (type `chainColor?: ChainColor`; import the type from `../lib/chainpalette`). After the confidence `.check-row` div (before the no-voice note), add:

```svelte
<div class="row">
  <label class="row-label" for="chain-{uid}">{t('chainLabel')}</label>
  <select id="chain-{uid}" bind:value={chainColor}>
    <option value="amber">{t('chainAmber')}</option>
    <option value="green">{t('chainGreen')}</option>
    <option value="violet">{t('chainViolet')}</option>
    <option value="none">{t('chainNone')}</option>
  </select>
</div>
```

(`bind:value` is correct here — every option value is valid, unlike the voice select's stored-but-absent case. No `disabled`, no `title`.)

- [ ] **Step 3: Plumbing**

- `SentenceCard.svelte`: props gain `chainColor = 'none'` (type `chainColor?: ChainColor`, import the type); pass `{chainColor}` to all three views.
- `App.svelte`: `<SettingsMenu bind:rate bind:voiceURI bind:showConfidence bind:chainColor />`; `<SentenceCard … {chainColor} …>`. (State + save effect already exist from Task 1.)

- [ ] **Step 4: Tests**

`tests/components/SettingsMenu.test.ts` — add:

```ts
it('offers the chain color select and round-trips it', async () => {
  vi.stubGlobal('speechSynthesis', fakeSynth([]))
  const user = userEvent.setup()
  render(SettingsMenu, { props: { ...base, chainColor: 'amber' } })
  await user.click(screen.getByRole('button', { name: 'settings' }))
  const select = screen.getByRole('combobox', { name: 'chain to main verb' }) as HTMLSelectElement
  expect(select).toBeEnabled()
  expect(select.value).toBe('amber')
  expect([...select.options].map((o) => o.textContent)).toEqual(['amber', 'green', 'violet', 'none'])
  await user.selectOptions(select, 'green')
  expect(select.value).toBe('green')
})
```

`tests/components/App.test.ts` — add (import `chainSentenceFixture` from the fixtures):

```ts
it('traces the chain by default and stops when set to none, without re-parsing', async () => {
  vi.mocked(parseText).mockResolvedValue([chainSentenceFixture()])
  const user = userEvent.setup()
  render(App)
  await user.type(screen.getByRole('textbox'), '新しい映画を見に行きました。')
  await user.click(screen.getByRole('button', { name: /parse/i }))
  const box = await screen.findByText('新しい')
  box.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await tick()
  expect(document.querySelectorAll('path.arc.chain')).toHaveLength(2)
  await user.click(screen.getByRole('button', { name: 'settings' }))
  await user.selectOptions(screen.getByRole('combobox', { name: 'chain to main verb' }), 'none')
  await tick()
  expect(document.querySelectorAll('.chain')).toHaveLength(0)
  expect(JSON.parse(localStorage.getItem('ayaki-settings')!).chainColor).toBe('none')
  expect(parseText).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 5: Run the affected suites, then the full check**

Run: `npx vitest run tests/components/SettingsMenu.test.ts tests/components/App.test.ts`, then `npm test && npm run check`
Expected: PASS, 0 errors 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add src/components src/lib/locales tests/components/SettingsMenu.test.ts tests/components/App.test.ts
git commit -m "feat: chain color setting wired through popup and views"
```

---

### Task 4: Screenshot refresh (controller-run, not a subagent task)

The tree + cabocha scenes have 映画を selected — they now showcase the amber chain.

- [ ] **Step 1:** `npm run shots`; verify: tree + cabocha scenes show the amber chain (tinted boxes + colored connectors beyond the immediate blue link); arcs scene (no selection) unchanged apart from nothing — confirm no stray chain artifacts.
- [ ] **Step 2:** Update the tree and cabocha alt texts in `README.md` to mention the traced chain to the main verb.
- [ ] **Step 3:** Commit: `git add docs/images README.md && git commit -m "docs: refresh screenshots showing the chain trace"`.

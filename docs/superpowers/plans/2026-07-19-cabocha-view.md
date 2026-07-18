# CaboCha Stair View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A third visualization — the classic CaboCha stair: one bunsetsu per row, indented stepwise, dependents connected to their heads by right-hand rails.

**Architecture:** `src/lib/stairlayout.ts` computes rows, stair indents and rail columns; rail assignment reuses the arcs view's nesting-level computation, **extracted from `arclayout.ts` as a shared `nestingLevels()` helper**, preserving the no-crossing invariant. `StairView.svelte` mirrors `ArcDiagram.svelte`'s interaction shell (same `g.bunsetsu` buttons, same `.arc` connector classes, per-instance marker ids). `Settings.view` widens to `'arcs' | 'tree' | 'cabocha'` (exported as `ViewKind`); the toolbar gains a 🎃 CaboCha button.

**Tech Stack:** Svelte 5 runes, TypeScript strict, vitest + @testing-library/svelte.

**Spec:** `docs/superpowers/specs/2026-07-19-cabocha-view-design.md`

## Global Constraints

- Rail columns are assigned by arc nesting level (enclosing arc → rail further right); the helper is EXTRACTED from `arclayout.ts` and shared — no duplicated nesting logic. Existing arc tests must stay green after the extraction.
- `StairView` props are identical to the other views: `{ bunsetsu: BunsetsuVM[]; showFurigana?: boolean; selected?: number | null; onselect: (index: number) => void }`.
- Interaction parity: `role="button"`/`tabindex`/`aria-label={b.surface}`/Enter+Space/`stopPropagation()` click/selection fill/hover-highlights-head — byte-for-byte the ArcDiagram patterns. Uncertain/forced connectors reuse the `.arc.low`/`.arc.forced` classes and the shared `confidenceLabel()` `<title>` (no new CSS).
- New catalog keys in ALL FOUR locales: `viewCabocha` = `'CaboCha'` in every locale (proper noun, untranslated); `stairsGroupLabel` = en `'CaboCha dependency stairs'`, de `'CaboCha-Abhängigkeitstreppe'`, ja `'CaboCha式係り受け表示'`, zh `'CaboCha 依存阶梯'`.
- Toggle order: ⌒ arcs | 🌳 tree | 🎃 CaboCha, all with `aria-pressed`.
- `Settings.view` validator accepts exactly the three codes; anything else → `'arcs'` default.
- Unkeyed vs keyed `{#each}`: follow ArcDiagram exactly (`(a.dep)` / `(b.index)` keys are fine — indices are unique).
- Svelte 5 runes only; TypeScript strict; commits get the Co-Authored-By trailer via the repo hook.
- Every task ends green: `npm test -- --run` and `npm run check` before each commit.

---

### Task 1: nestingLevels extraction + stair layout

**Files:**
- Modify: `src/lib/arclayout.ts` (extract `nestingLevels`)
- Create: `src/lib/stairlayout.ts`
- Test: create `tests/lib/stairlayout.test.ts` (existing `tests/lib/arclayout.test.ts` must stay green untouched)

**Interfaces:**
- Produces:
  - `arclayout.ts`: `export interface DepPair { dep: number; head: number }`, `export function nestingLevels(pairs: DepPair[]): number[]` (in addition to the existing exports; `layoutArcs` behavior unchanged)
  - `stairlayout.ts`:
    - `export interface StairBox { x: number; y: number; width: number }`
    - `export interface StairConnector { dep: number; head: number; railX: number; d: string }`
    - `export interface StairLayout { boxes: StairBox[]; connectors: StairConnector[]; width: number; height: number }`
    - `export interface StairOptions { rowHeight: number; boxCenterOffset: number }`
    - `export function layoutStairs(surfaces: string[], heads: (number | null)[], opts: StairOptions): StairLayout`
    - constant `STEP = 24` (stair indent per row), `RAIL_BASE = 16`, `RAIL_STEP = 12`, `BOX_PAD = 10` (box padding identical to arclayout)

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/stairlayout.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { layoutStairs } from '../../src/lib/stairlayout'
import { textWidth } from '../../src/lib/arclayout'

// sentenceFixture shape: 猫が(→2) 魚を(→2) 食べた。(root)
const surfaces = ['猫が', '魚を', '食べた。']
const heads: (number | null)[] = [2, 2, null]
const opts = { rowHeight: 46, boxCenterOffset: 17 }

describe('layoutStairs', () => {
  it('places one row per bunsetsu with a uniform stair indent', () => {
    const l = layoutStairs(surfaces, heads, opts)
    expect(l.boxes.map((b) => b.x)).toEqual([0, 24, 48])
    expect(l.boxes.map((b) => b.y)).toEqual([0, 46, 92])
    expect(l.boxes[0].width).toBe(textWidth('猫が') + 20)
    expect(l.height).toBe(3 * 46)
  })
  it('assigns rails by nesting level: the enclosing arc gets the farther rail', () => {
    const l = layoutStairs(surfaces, heads, opts)
    // (魚を→食べた。) nests inside (猫が→食べた。): dep0's rail must be right of dep1's
    const byDep = Object.fromEntries(l.connectors.map((c) => [c.dep, c]))
    expect(byDep[0].railX).toBeGreaterThan(byDep[1].railX)
    // both rails clear the widest box's right edge
    const maxRight = Math.max(...l.boxes.map((b) => b.x + b.width))
    expect(byDep[1].railX).toBeGreaterThanOrEqual(maxRight + 16)
    expect(l.width).toBe(byDep[0].railX)
  })
  it('draws each connector from the dependent box edge via the rail into the head box edge', () => {
    const l = layoutStairs(surfaces, heads, opts)
    const c = l.connectors.find((x) => x.dep === 1)!
    const dep = l.boxes[1]
    const head = l.boxes[2]
    expect(c.d).toBe(
      `M ${dep.x + dep.width} ${dep.y + 17} H ${c.railX} V ${head.y + 17} H ${head.x + head.width}`,
    )
  })
  it('reflects the row height option (furigana headroom)', () => {
    const tall = layoutStairs(surfaces, heads, { rowHeight: 62, boxCenterOffset: 33 })
    expect(tall.boxes[2].y).toBe(124)
    expect(tall.connectors[0].d).toContain(` ${124 + 33} `)
  })
  it('handles a single bunsetsu without connectors', () => {
    const l = layoutStairs(['猫。'], [null], opts)
    expect(l.connectors).toEqual([])
    expect(l.boxes).toHaveLength(1)
    expect(l.width).toBe(l.boxes[0].width)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --run tests/lib/stairlayout.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Extract nestingLevels in arclayout.ts**

In `src/lib/arclayout.ts`, add after `textWidth`:

```ts
export interface DepPair {
  dep: number
  head: number
}

/** Nesting level per arc: 1 + the deepest level of any arc it encloses (B nests
 *  in A iff A.dep <= B.dep && B.head <= A.head). Shortest spans are processed
 *  first so nested levels are known before their enclosing arcs. */
export function nestingLevels(pairs: DepPair[]): number[] {
  const order = pairs
    .map((_, i) => i)
    .sort((a, b) => (pairs[a].head - pairs[a].dep) - (pairs[b].head - pairs[b].dep))
  const levels = new Array(pairs.length).fill(0)
  for (const i of order) {
    const a = pairs[i]
    let maxNestedLevel = 0
    for (let j = 0; j < pairs.length; j++) {
      if (j === i) continue
      const b = pairs[j]
      if (a.dep <= b.dep && b.head <= a.head) {
        maxNestedLevel = Math.max(maxNestedLevel, levels[j])
      }
    }
    levels[i] = 1 + maxNestedLevel
  }
  return levels
}
```

and in `layoutArcs`, replace the inline level computation (the `order`/`levels` block between the `pairs` construction and the `arcs` construction, including its comment) with:

```ts
  const levels = nestingLevels(pairs)
```

`layoutArcs`'s observable behavior must not change.

- [ ] **Step 4: Create stairlayout.ts**

Create `src/lib/stairlayout.ts`:

```ts
import { nestingLevels, textWidth } from './arclayout'

const BOX_PAD = 10
const STEP = 24
const RAIL_BASE = 16
const RAIL_STEP = 12

export interface StairBox {
  x: number
  y: number
  width: number
}

export interface StairConnector {
  dep: number
  head: number
  railX: number
  d: string
}

export interface StairLayout {
  boxes: StairBox[]
  connectors: StairConnector[]
  width: number
  height: number
}

export interface StairOptions {
  /** full row height incl. furigana headroom and inter-row gap */
  rowHeight: number
  /** y offset of the box's vertical center within its row */
  boxCenterOffset: number
}

/**
 * CaboCha-style stair layout: one row per bunsetsu in sentence order, each row
 * indented STEP px further right. Connectors run from the dependent box's right
 * edge to a vertical rail, down to the head's row, and back into the head box's
 * right edge. Rail columns are assigned by arc nesting level — the arc view's
 * height rule rotated 90° — so sasara's non-crossing input never renders
 * crossing connectors. Disjoint arcs may share a rail column; their vertical
 * segments occupy disjoint row ranges.
 */
export function layoutStairs(
  surfaces: string[],
  heads: (number | null)[],
  opts: StairOptions,
): StairLayout {
  const boxes: StairBox[] = surfaces.map((s, i) => ({
    x: i * STEP,
    y: i * opts.rowHeight,
    width: textWidth(s) + 2 * BOX_PAD,
  }))
  const pairs: { dep: number; head: number }[] = []
  heads.forEach((head, dep) => {
    if (head !== null) pairs.push({ dep, head })
  })
  const levels = nestingLevels(pairs)
  const maxRight = Math.max(0, ...boxes.map((b) => b.x + b.width))
  const connectors: StairConnector[] = pairs.map(({ dep, head }, i) => {
    const railX = maxRight + RAIL_BASE + RAIL_STEP * (levels[i] - 1)
    const y1 = boxes[dep].y + opts.boxCenterOffset
    const y2 = boxes[head].y + opts.boxCenterOffset
    return {
      dep,
      head,
      railX,
      d: `M ${boxes[dep].x + boxes[dep].width} ${y1} H ${railX} V ${y2} H ${boxes[head].x + boxes[head].width}`,
    }
  })
  const width = connectors.length ? Math.max(...connectors.map((c) => c.railX)) : maxRight
  return { boxes, connectors, width, height: surfaces.length * opts.rowHeight }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- --run tests/lib/stairlayout.test.ts tests/lib/arclayout.test.ts`
Expected: PASS — new suite green AND every existing arclayout test green (extraction regression guard).

- [ ] **Step 6: Full suite, check, commit**

Run: `npm test -- --run && npm run check` — all green. Then:

```bash
git add src/lib/arclayout.ts src/lib/stairlayout.ts tests/lib/stairlayout.test.ts
git commit -m "feat: stair layout with shared nesting-level rails"
```

---

### Task 2: StairView component + catalog keys

**Files:**
- Create: `src/components/StairView.svelte`
- Modify: `src/lib/locales/en.ts`, `src/lib/locales/de.ts`, `src/lib/locales/ja.ts`, `src/lib/locales/zh.ts` (two new keys each)
- Test: create `tests/components/StairView.test.ts`

**Interfaces:**
- Consumes (Task 1): `layoutStairs(surfaces, heads, opts): StairLayout`.
- Produces: `StairView` component with the standard view props (see Global Constraints); catalog keys `viewCabocha`, `stairsGroupLabel` (Task 3's toolbar uses `viewCabocha`).

- [ ] **Step 1: Add the catalog keys**

In `src/lib/locales/en.ts`, after `viewTree`:

```ts
  viewCabocha: 'CaboCha',
  stairsGroupLabel: 'CaboCha dependency stairs',
```

In `de.ts` (same position): `viewCabocha: 'CaboCha',` and `stairsGroupLabel: 'CaboCha-Abhängigkeitstreppe',`
In `ja.ts`: `viewCabocha: 'CaboCha',` and `stairsGroupLabel: 'CaboCha式係り受け表示',`
In `zh.ts`: `viewCabocha: 'CaboCha',` and `stairsGroupLabel: 'CaboCha 依存阶梯',`

(The catalog-parity test enforces that all four gain both keys.)

- [ ] **Step 2: Write the failing component tests**

Create `tests/components/StairView.test.ts`:

```ts
// @vitest-environment jsdom
import { render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import StairView from '../../src/components/StairView.svelte'
import { forcedSentenceFixture, sentenceFixture } from '../fixtures'

const bunsetsu = sentenceFixture().bunsetsu

describe('StairView', () => {
  it('renders one box per bunsetsu and one connector per non-root', () => {
    const { container } = render(StairView, { props: { bunsetsu, onselect: () => {} } })
    expect(container.querySelectorAll('g.bunsetsu rect')).toHaveLength(3)
    expect(container.querySelectorAll('path.arc')).toHaveLength(2)
  })
  it('marks low-confidence connectors and titles them with the probability', () => {
    const { container } = render(StairView, { props: { bunsetsu, onselect: () => {} } })
    const low = container.querySelectorAll('path.arc.low')
    expect(low).toHaveLength(1)
    expect(low[0].querySelector('title')?.textContent).toContain('55')
  })
  it('titles forced attachments', () => {
    const forced = forcedSentenceFixture().bunsetsu
    const { container } = render(StairView, { props: { bunsetsu: forced, onselect: () => {} } })
    const f = container.querySelectorAll('path.arc.forced')
    expect(f.length).toBeGreaterThan(0)
    expect(f[0].querySelector('title')?.textContent).toMatch(/forced/i)
  })
  it('shows furigana only when enabled', () => {
    const off = render(StairView, { props: { bunsetsu, onselect: () => {} } })
    expect(off.container.querySelectorAll('text.furigana')).toHaveLength(0)
    const on = render(StairView, { props: { bunsetsu, showFurigana: true, onselect: () => {} } })
    expect(on.container.querySelectorAll('text.furigana')).toHaveLength(3)
  })
  it('invokes onselect on click and Enter, and stops click propagation', () => {
    const onselect = vi.fn()
    const outer = vi.fn()
    const { getByText } = render(StairView, { props: { bunsetsu, onselect } })
    document.body.addEventListener('click', outer)
    try {
      getByText('魚を').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(onselect).toHaveBeenCalledWith(1)
      expect(outer).not.toHaveBeenCalled()
    } finally {
      document.body.removeEventListener('click', outer)
    }
    const g = getByText('猫が').closest('g')!
    g.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onselect).toHaveBeenCalledWith(0)
  })
  it('uses per-instance arrowhead marker ids and a localized group label', () => {
    const a = render(StairView, { props: { bunsetsu, onselect: () => {} } })
    const b = render(StairView, { props: { bunsetsu, onselect: () => {} } })
    const idA = a.container.querySelector('marker')!.id
    const idB = b.container.querySelector('marker')!.id
    expect(idA).not.toBe(idB)
    expect(a.container.querySelector('svg')!.getAttribute('aria-label')).toBe('CaboCha dependency stairs')
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- --run tests/components/StairView.test.ts`
Expected: FAIL — component does not exist. (The i18n parity test from Task 1's suite run must already be green after Step 1.)

- [ ] **Step 4: Implement the component**

Create `src/components/StairView.svelte`:

```svelte
<script lang="ts">
  import { layoutStairs } from '../lib/stairlayout'
  import { confidenceLabel, isUncertain } from '../lib/viewmodel'
  import type { BunsetsuVM } from '../lib/types'
  import { t } from '../lib/i18n.svelte'

  let {
    bunsetsu,
    showFurigana = false,
    selected = null,
    onselect,
  }: {
    bunsetsu: BunsetsuVM[]
    showFurigana?: boolean
    selected?: number | null
    onselect: (index: number) => void
  } = $props()

  const uid = $props.id()

  let hovered = $state<number | null>(null)

  const BOX_H = 34
  const FURI_H = 16
  const ROW_GAP = 12
  const PAD = 4

  const furiH = $derived(showFurigana ? FURI_H : 0)
  const layout = $derived(
    layoutStairs(
      bunsetsu.map((b) => b.surface),
      bunsetsu.map((b) => b.head),
      { rowHeight: furiH + BOX_H + ROW_GAP, boxCenterOffset: furiH + BOX_H / 2 },
    ),
  )

  function connectorClass(dep: number): string {
    const b = bunsetsu[dep]
    const cls = ['arc']
    if (b.forced) cls.push('forced')
    else if (isUncertain(b)) cls.push('low')
    if (hovered === dep || selected === dep) cls.push('hl')
    return cls.join(' ')
  }
</script>

<div class="tree-scroll">
  <svg
    width={layout.width + 2 * PAD}
    height={layout.height + PAD}
    class="stairview"
    role="group"
    aria-label={t('stairsGroupLabel')}
  >
    <defs>
      <marker id="arrowhead-{uid}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" />
      </marker>
    </defs>
    <g transform="translate({PAD}, 2)">
      {#each layout.connectors as c (c.dep)}
        {@const label = confidenceLabel(bunsetsu[c.dep])}
        <path class={connectorClass(c.dep)} d={c.d} marker-end="url(#arrowhead-{uid})">
          {#if label}
            <title>{label}</title>
          {/if}
        </path>
      {/each}
      {#each bunsetsu as b, i (b.index)}
        {@const box = layout.boxes[i]}
        <g
          class="bunsetsu"
          class:selected={selected === i}
          class:hl={hovered === i || (hovered !== null && bunsetsu[hovered].head === i)}
          class:root={b.head === null}
          role="button"
          tabindex="0"
          aria-label={b.surface}
          onmouseenter={() => (hovered = i)}
          onmouseleave={() => (hovered = null)}
          onclick={(e) => {
            e.stopPropagation()
            onselect(i)
          }}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onselect(i)
            }
          }}
        >
          {#if showFurigana && b.reading}
            <text class="furigana" x={box.x + box.width / 2} y={box.y + FURI_H - 4} text-anchor="middle">{b.reading}</text>
          {/if}
          <rect x={box.x} y={box.y + furiH} width={box.width} height={BOX_H} rx="6" />
          <text class="surface" x={box.x + box.width / 2} y={box.y + furiH + 22} text-anchor="middle">{b.surface}</text>
        </g>
      {/each}
    </g>
  </svg>
</div>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- --run tests/components/StairView.test.ts tests/lib/i18n.test.ts`
Expected: PASS (StairView 6, i18n incl. catalog parity green).

- [ ] **Step 6: Full suite, check, commit**

Run: `npm test -- --run && npm run check` — all green. Then:

```bash
git add src/components/StairView.svelte src/lib/locales tests/components/StairView.test.ts
git commit -m "feat: CaboCha stair view component"
```

---

### Task 3: view wiring — settings, toolbar, card

**Files:**
- Modify: `src/lib/settings.ts` (ViewKind type + validator)
- Modify: `src/components/App.svelte:25` (view state type)
- Modify: `src/components/Toolbar.svelte` (view prop type + third button)
- Modify: `src/components/SentenceCard.svelte` (view prop type + third branch)
- Test: `tests/lib/settings.test.ts`, `tests/components/Toolbar.test.ts`, `tests/components/SentenceCard.test.ts`, `tests/components/App.test.ts`

**Interfaces:**
- Consumes: `StairView` (Task 2), `viewCabocha` catalog key (Task 2).
- Produces: `export type ViewKind = 'arcs' | 'tree' | 'cabocha'` from `src/lib/settings.ts`; all view props typed `ViewKind`.

- [ ] **Step 1: Write the failing tests**

In `tests/lib/settings.test.ts`, append inside `describe('loadSettings', …)`:

```ts
  it('accepts the cabocha view and rejects unknown views', () => {
    localStorage.setItem(KEY, JSON.stringify({ view: 'cabocha' }))
    expect(loadSettings().view).toBe('cabocha')
    localStorage.setItem(KEY, JSON.stringify({ view: 'spiral' }))
    expect(loadSettings().view).toBe('arcs')
  })
```

In `tests/components/Toolbar.test.ts`, append (inside the main describe; `base` exists):

```ts
  it('offers three view buttons and reports the cabocha state', async () => {
    const user = userEvent.setup()
    render(Toolbar, { props: { ...base, view: 'cabocha' as const } })
    const cabocha = screen.getByRole('button', { name: /CaboCha/ })
    expect(cabocha).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /arcs/ })).toHaveAttribute('aria-pressed', 'false')
    await user.click(screen.getByRole('button', { name: /arcs/ }))
    expect(screen.getByRole('button', { name: /arcs/ })).toHaveAttribute('aria-pressed', 'true')
  })
```

In `tests/components/SentenceCard.test.ts`, append inside `describe('SentenceCard', …)`:

```ts
  it('renders the stair view for view=cabocha', () => {
    const { container } = render(SentenceCard, { props: { ...base, view: 'cabocha' as const } })
    expect(container.querySelector('svg.stairview')).not.toBeNull()
  })
```

In `tests/components/App.test.ts`, append inside `describe('App', …)`:

```ts
  it('switches to the cabocha view and persists the choice', async () => {
    vi.mocked(parseText).mockResolvedValue([sentenceFixture()])
    const user = userEvent.setup()
    const { container } = render(App)
    await user.type(screen.getByRole('textbox'), '猫が魚を食べた。')
    await user.click(screen.getByRole('button', { name: /parse/i }))
    await screen.findByText('食べた。')
    await user.click(screen.getByRole('button', { name: /CaboCha/ }))
    expect(container.querySelector('svg.stairview')).not.toBeNull()
    await tick()
    expect(JSON.parse(localStorage.getItem('ayaki-settings')!).view).toBe('cabocha')
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --run tests/lib/settings.test.ts tests/components/Toolbar.test.ts tests/components/SentenceCard.test.ts tests/components/App.test.ts`
Expected: the four new tests FAIL.

- [ ] **Step 3: Implement**

In `src/lib/settings.ts`:

```ts
export type ViewKind = 'arcs' | 'tree' | 'cabocha'
```

change the `Settings.view` field to `view: ViewKind` and the validator line to:

```ts
  view: (v) => (v === 'arcs' || v === 'tree' || v === 'cabocha' ? v : undefined),
```

In `src/components/App.svelte`, add `type ViewKind` to the settings import and change:

```ts
  let view = $state<ViewKind>(initialSettings.view)
```

In `src/components/Toolbar.svelte`, import `type ViewKind` from `'../lib/settings'`, change the prop type `view: 'arcs' | 'tree'` to `view: ViewKind`, and add after the tree button:

```svelte
    <button class:active={view === 'cabocha'} aria-pressed={view === 'cabocha'} onclick={() => (view = 'cabocha')}>🎃 {t('viewCabocha')}</button>
```

In `src/components/SentenceCard.svelte`, import `StairView` and `type ViewKind` (from `'../lib/settings'`), change the prop type to `view: ViewKind`, and replace the view branches:

```svelte
  {#if sentence.error}
    <p class="sentence-error"><span lang="ja">{sentence.text}</span> — {t('sentenceError', { message: sentence.error })}</p>
  {:else if view === 'arcs'}
    <ArcDiagram bunsetsu={sentence.bunsetsu} {showFurigana} {selected} {onselect} />
  {:else if view === 'tree'}
    <NodeTree bunsetsu={sentence.bunsetsu} {showFurigana} {selected} {onselect} />
  {:else}
    <StairView bunsetsu={sentence.bunsetsu} {showFurigana} {selected} {onselect} />
  {/if}
```

- [ ] **Step 4: Run the full suite and check**

Run: `npm test -- --run && npm run check`
Expected: all PASS, 0 check errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/settings.ts src/components/App.svelte src/components/Toolbar.svelte src/components/SentenceCard.svelte tests/lib/settings.test.ts tests/components/Toolbar.test.ts tests/components/SentenceCard.test.ts tests/components/App.test.ts
git commit -m "feat: cabocha view selectable and persisted"
```

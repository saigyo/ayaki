# Relation Labels on Arrows + Clause Extents — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relation labels move onto the dependency edges (new default), arrow direction becomes a setting (UD default), clause heads get predicate badges, and hovering/selecting a clause-labeled bunsetsu draws a bracket along its whole subtree span.

**Architecture:** Two new persisted settings (`relationDisplay: 'off'|'badges'|'arrows'`, `arrowDirection: 'ud'|'kakariuke'`) replace the `showRelations` boolean and thread through App → SentenceCard → the three views. Rendering is per-view: arc-apex labels (arc view), branch-corner labels with rail widening (stair view), above-box labels with a furigana stack (tree view). A pure `subtreeSpan` helper powers the extent bracket. The labeler `src/lib/relations.ts` is untouched.

**Tech Stack:** Svelte 5 (runes), TypeScript strict, Vitest + @testing-library/svelte (jsdom), Playwright (live-check/screenshots).

**Spec:** `docs/superpowers/specs/2026-07-22-relation-arrows-design.md`

## Global Constraints

- Defaults: `relationDisplay: 'arrows'`, `arrowDirection: 'ud'`. Migration: stored `showRelations: false → 'off'`, `true → 'arrows'`; an explicit stored `relationDisplay` wins.
- `arrowDirection` applies in every relationDisplay mode and every view — except the tree view, which stays **arrowless in both directions**.
- Neither new setting appears in share links (`src/lib/share.ts` is untouched).
- Terminology: root term `relPredicate` becomes en `main predicate`, de `Hauptprädikat`, ja `主節の述語`, zh `主要谓语` — globally (badges mode, Inspector, help). New key `relClausePredicate` carries the old strings: en `predicate`, de `Prädikat`, ja `述語`, zh `谓语` — used only for arrows-mode badges under relative-/linked-clause heads.
- All diagram labels, badges, and brackets are `aria-hidden="true"`; bunsetsu accessible names stay the bare surface.
- Extent brackets trigger only for relations `relclause` and `linkedclause`, on hover OR selection, in ALL relationDisplay modes. Stair bracket side: left. Tree bracket side: larger horizontal clearance within the subtree's rows; ties → right.
- `src/lib/relations.ts` and `scripts/relation-eval.ts` are NOT modified.
- German strings must be verified per-codepoint in review (standing rule; `Hauptprädikat`, `Relationsbeschriftung`, `ausgeblendet` etc. contain umlauts/sharp letters).
- The app is light-theme only; text halos use `stroke: #fff` (cards are white).
- Run tests with `npm test`, types with `npm run check`. IDE TS diagnostics on fresh files are known false positives — the two commands are the authority.

## File Structure

- `src/lib/extent.ts` (new) — `subtreeSpan` pure helper.
- `src/lib/settings.ts` — new setting types/fields/validators/migration.
- `src/lib/stairlayout.ts` — connector coords instead of baked `d`; label-aware rail widening.
- `src/lib/treelayout.ts` — `levelH` parameter.
- `src/lib/locales/{en,de,ja,zh}.ts` — renamed + new keys.
- `src/components/{ArcDiagram,StairView,NodeTree}.svelte` — prop swap, direction, arrows rendering, brackets.
- `src/components/{App,SentenceCard,SettingsMenu,HelpDialog}.svelte` — plumbing, settings UI, demo/help content.
- `src/app.css` — edge-label halo + bracket styles.
- `scripts/live-check.mjs` — relations check adapted; `docs/relation-labels.md` — addendum; `docs/images/*.png` — regenerated.

---

### Task 1: `subtreeSpan` helper

**Files:**
- Create: `src/lib/extent.ts`
- Test: `tests/lib/extent.test.ts` (new)

**Interfaces:**
- Produces: `subtreeSpan(heads: (number | null)[], i: number): { from: number; to: number }` — consumed by Task 7.

- [ ] **Step 1: Write the failing tests** — create `tests/lib/extent.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { subtreeSpan } from '../../src/lib/extent'

describe('subtreeSpan', () => {
  // 昨日、私は友達と新しい映画を見に行きました。
  const heads: (number | null)[] = [6, 6, 6, 4, 5, 6, null]

  it('leaf → itself', () => {
    expect(subtreeSpan(heads, 3)).toEqual({ from: 3, to: 3 })
  })
  it('first bunsetsu leaf', () => {
    expect(subtreeSpan(heads, 0)).toEqual({ from: 0, to: 0 })
  })
  it('intermediate node carries its dependents', () => {
    expect(subtreeSpan(heads, 4)).toEqual({ from: 3, to: 4 })
  })
  it('clause head spans its whole chain', () => {
    expect(subtreeSpan(heads, 5)).toEqual({ from: 3, to: 5 })
  })
  it('root spans the whole sentence', () => {
    expect(subtreeSpan(heads, 6)).toEqual({ from: 0, to: 6 })
  })
  it('branching subtree is contiguous', () => {
    // 0→2, 1→2, 2→3, root 3
    expect(subtreeSpan([2, 2, 3, null], 2)).toEqual({ from: 0, to: 2 })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/lib/extent.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/extent`

- [ ] **Step 3: Implement** — create `src/lib/extent.ts`:

```ts
/**
 * Contiguous index span of bunsetsu i's subtree.
 *
 * Japanese dependencies are strictly head-final (every head index > dependent
 * index) and projective (spans never cross), so a subtree is always the
 * contiguous range [leftmost transitive dependent, i]. Scanning left from i:
 * an index j belongs to the subtree iff its head lands at or before i — the
 * first j whose head escapes past i (or is the root) ends the span, and
 * projectivity guarantees nothing further left can re-enter it.
 */
export function subtreeSpan(heads: (number | null)[], i: number): { from: number; to: number } {
  let from = i
  for (let j = i - 1; j >= 0; j--) {
    const h = heads[j]
    if (h !== null && h <= i) from = j
    else break
  }
  return { from, to: i }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/lib/extent.test.ts`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/extent.ts tests/lib/extent.test.ts
git commit -m "feat: subtreeSpan — contiguous subtree span of a bunsetsu"
```

---

### Task 2: Terminology + new i18n keys + help extent note

**Files:**
- Modify: `src/lib/locales/en.ts`, `src/lib/locales/de.ts`, `src/lib/locales/ja.ts`, `src/lib/locales/zh.ts`
- Modify: `src/components/HelpDialog.svelte` (one added paragraph)
- Test: `tests/components/HelpDialog.test.ts`, `tests/components/Inspector.test.ts`

**Interfaces:**
- Produces: message keys `relClausePredicate`, `relationDisplayLabel`, `relationDisplayOff`, `relationDisplayBadges`, `relationDisplayArrows`, `arrowDirectionLabel`, `arrowDirectionUd`, `arrowDirectionKakariuke`, `helpRelationsExtent`; changed values for `relPredicate` and `helpRelationsIntro`. Consumed by Tasks 3–6.
- Do NOT remove `relationsToggle` yet — `SettingsMenu` still uses it until Task 3.

- [ ] **Step 1: Update failing test expectations first** — in `tests/components/HelpDialog.test.ts`, change the relations-legend test and add an extent-note test:

```ts
  it('lists all nine relations with glosses', async () => {
    const user = userEvent.setup()
    render(HelpDialog, { props: { chainColor: 'amber' } })
    await user.click(screen.getByRole('button', { name: 'help' }))
    const dialog = getDialog()
    const items = [...dialog.querySelectorAll('.relations-legend li')]
    expect(items.length).toBe(9)
    expect(items[0].textContent).toContain('subject')
    expect(items[8].textContent).toContain('main predicate')
  })

  it('explains the clause-extent bracket', async () => {
    const user = userEvent.setup()
    render(HelpDialog, { props: { chainColor: 'amber' } })
    await user.click(screen.getByRole('button', { name: 'help' }))
    expect(getDialog().textContent).toContain('draws a bracket along the whole clause')
  })
```

In `tests/components/Inspector.test.ts`, tighten the root test (it selects the root `食べた。`):

```ts
    expect(line.textContent).toContain('main predicate')
```

(replacing `expect(line.textContent).toContain('predicate')` in the `'root shows predicate without an arrow'` test only).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/components/HelpDialog.test.ts tests/components/Inspector.test.ts`
Expected: FAIL — legend/inspector show `predicate`, extent note missing

- [ ] **Step 3: Update `src/lib/locales/en.ts`**

Change:
```ts
  relPredicate: 'main predicate',
```
Insert directly after `relPredicate`:
```ts
  relClausePredicate: 'predicate',
```
Insert after `relationsToggle`:
```ts
  relationDisplayLabel: 'relation labels',
  relationDisplayOff: 'hidden',
  relationDisplayBadges: 'under bunsetsu',
  relationDisplayArrows: 'on arrows',
  arrowDirectionLabel: 'arrow direction',
  arrowDirectionUd: 'head → dependent (UD)',
  arrowDirectionKakariuke: 'dependent → head (kakari-uke)',
```
Replace the `helpRelationsIntro` value and add `helpRelationsExtent` after it:
```ts
  helpRelationsIntro:
    'Each dependency is labeled with its grammatical relation — by default on the arrows, with arrows pointing from head to dependent (read: 行きました。 "has a" topic 私は). The labels are derived by rules from particles and word classes and are right about 9 times out of 10 — the inspector links the matching Universal Dependencies relation for every label. Label placement and arrow direction are configurable in the settings.',
  helpRelationsExtent:
    'For clause labels (relative clause, linked clause), hovering or selecting the labeled bunsetsu draws a bracket along the whole clause — the label describes that entire stretch, and the labeled bunsetsu is its predicate.',
```

- [ ] **Step 4: Update `src/lib/locales/de.ts`** (same key positions; verify every codepoint):

```ts
  relPredicate: 'Hauptprädikat',
  relClausePredicate: 'Prädikat',
  relationDisplayLabel: 'Relationsbeschriftung',
  relationDisplayOff: 'ausgeblendet',
  relationDisplayBadges: 'unter den Bunsetsu',
  relationDisplayArrows: 'an den Pfeilen',
  arrowDirectionLabel: 'Pfeilrichtung',
  arrowDirectionUd: 'Kopf → abhängig (UD)',
  arrowDirectionKakariuke: 'abhängig → Kopf (Kakari-uke)',
  helpRelationsIntro:
    'Jede Abhängigkeit ist mit ihrer grammatischen Relation beschriftet — standardmäßig an den Pfeilen, wobei die Pfeile vom Kopf zum abhängigen Element zeigen (lies: 行きました。 „hat ein" Thema 私は). Die Labels werden regelbasiert aus Partikeln und Wortarten abgeleitet und stimmen in etwa 9 von 10 Fällen — der Inspektor verlinkt zu jedem Label die passende Universal-Dependencies-Relation. Position und Pfeilrichtung sind in den Einstellungen wählbar.',
  helpRelationsExtent:
    'Bei Satz-Labels (Relativsatz, Nebensatz) zeichnet Überfahren oder Auswählen des beschrifteten Bunsetsu eine Klammer entlang des ganzen Teilsatzes — das Label beschreibt diesen gesamten Abschnitt, dessen Prädikat das beschriftete Bunsetsu ist.',
```

- [ ] **Step 5: Update `src/lib/locales/ja.ts`**:

```ts
  relPredicate: '主節の述語',
  relClausePredicate: '述語',
  relationDisplayLabel: '関係ラベル',
  relationDisplayOff: '非表示',
  relationDisplayBadges: '文節の下',
  relationDisplayArrows: '矢印上',
  arrowDirectionLabel: '矢印の向き',
  arrowDirectionUd: '受け → 係り（UD）',
  arrowDirectionKakariuke: '係り → 受け（係り受け）',
  helpRelationsIntro:
    '各係り受けには文法的な関係のラベルが付きます。標準では矢印上に表示され、矢印は受け（主辞）から係りへ向かいます。ラベルは助詞と品詞から規則で導かれ、およそ10回中9回は正確です。インスペクターには各ラベルに対応する Universal Dependencies の関係へのリンクがあります。表示位置と矢印の向きは設定で変更できます。',
  helpRelationsExtent:
    '節のラベル（連体修飾節・接続節）では、その文節にカーソルを合わせるか選択すると、節全体に沿ってブラケットが表示されます。ラベルはその範囲全体を指し、ラベルの付いた文節はその節の述語です。',
```

- [ ] **Step 6: Update `src/lib/locales/zh.ts`**:

```ts
  relPredicate: '主要谓语',
  relClausePredicate: '谓语',
  relationDisplayLabel: '关系标签',
  relationDisplayOff: '隐藏',
  relationDisplayBadges: '文节下方',
  relationDisplayArrows: '箭头上',
  arrowDirectionLabel: '箭头方向',
  arrowDirectionUd: '中心语 → 从属语（UD）',
  arrowDirectionKakariuke: '从属语 → 中心语（係り受け）',
  helpRelationsIntro:
    '每个依存关系都标有语法关系标签——默认显示在箭头上，箭头从中心语指向从属语。标签由助词和词类规则推导，约十次中有九次正确；检查器为每个标签链接对应的 Universal Dependencies 关系。标签位置和箭头方向可在设置中更改。',
  helpRelationsExtent:
    '对于从句标签（定语从句、连接分句），悬停或选中该文节时会沿整个从句绘制一条括线——标签描述的是整个片段，被标记的文节是该从句的谓语。',
```

- [ ] **Step 7: Add the extent note to `src/components/HelpDialog.svelte`** — after the `</ul>` of the `relations-legend` list, add:

```svelte
      <p class="help-note">{t('helpRelationsExtent')}</p>
```

- [ ] **Step 8: Run tests and types**

Run: `npx vitest run tests/components/HelpDialog.test.ts tests/components/Inspector.test.ts && npm run check`
Expected: PASS (the substring assertions elsewhere — e.g. live-check is not a unit test — are unaffected; `main predicate` contains `predicate` so untouched loose assertions keep passing)

- [ ] **Step 9: Run the whole suite**

Run: `npm test`
Expected: all pass (fixtures use relation *codes*, not display strings)

- [ ] **Step 10: Commit**

```bash
git add src/lib/locales src/components/HelpDialog.svelte tests/components/HelpDialog.test.ts tests/components/Inspector.test.ts
git commit -m "feat: main-predicate terminology, relation-display/arrow-direction strings, help extent note"
```

---

### Task 3: Settings model + plumbing + arrow direction

**Files:**
- Modify: `src/lib/settings.ts`, `src/lib/stairlayout.ts`
- Modify: `src/components/App.svelte`, `src/components/SettingsMenu.svelte`, `src/components/SentenceCard.svelte`, `src/components/ArcDiagram.svelte`, `src/components/StairView.svelte`, `src/components/NodeTree.svelte`, `src/components/HelpDialog.svelte`
- Modify: `src/lib/locales/{en,de,ja,zh}.ts` (remove `relationsToggle`)
- Test: `tests/lib/settings.test.ts`, `tests/lib/stairlayout.test.ts`, `tests/components/SettingsMenu.test.ts`, `tests/components/App.test.ts`, `tests/components/{ArcDiagram,StairView,NodeTree}.test.ts`

**Interfaces:**
- Produces: `type RelationDisplay = 'off' | 'badges' | 'arrows'`, `type ArrowDirection = 'ud' | 'kakariuke'` (exported from `src/lib/settings.ts`); view props `relationDisplay?: RelationDisplay` (all three views), `arrowDirection?: ArrowDirection` (ArcDiagram + StairView only — NodeTree does not accept it); `StairConnector { dep, head, railX, x1, y1, x2, y2 }` (x1/y1 = dependent box right edge/center, x2/y2 = head's).
- Behavior after this task: `badges` mode renders exactly as before; `arrows` mode renders **no labels yet** (Tasks 4–6 add them); direction flip works everywhere; default direction is `ud` (arrowheads at the dependent). Help demo stays on `relationDisplay="badges"` until Task 5.

- [ ] **Step 1: Update `tests/lib/settings.test.ts`** — in the round-trip test object (line ~22) replace `showRelations: false` with `relationDisplay: 'badges' as const, arrowDirection: 'kakariuke' as const`. Replace the `'rejects non-boolean showRelations values'` test with:

```ts
  it('rejects invalid relationDisplay and arrowDirection values', () => {
    localStorage.setItem(KEY, JSON.stringify({ relationDisplay: 'sometimes', arrowDirection: 'up' }))
    expect(loadSettings().relationDisplay).toBe('arrows')
    expect(loadSettings().arrowDirection).toBe('ud')
  })

  it('migrates the legacy showRelations boolean', () => {
    localStorage.setItem(KEY, JSON.stringify({ showRelations: false }))
    expect(loadSettings().relationDisplay).toBe('off')
    localStorage.setItem(KEY, JSON.stringify({ showRelations: true }))
    expect(loadSettings().relationDisplay).toBe('arrows')
    // an explicit relationDisplay wins over the legacy flag
    localStorage.setItem(KEY, JSON.stringify({ showRelations: false, relationDisplay: 'badges' }))
    expect(loadSettings().relationDisplay).toBe('badges')
  })
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/lib/settings.test.ts` → FAIL

- [ ] **Step 3: Rewrite `src/lib/settings.ts`** — full new content of the changed parts:

```ts
export type ViewKind = 'arcs' | 'tree' | 'cabocha'
export type RelationDisplay = 'off' | 'badges' | 'arrows'
export type ArrowDirection = 'ud' | 'kakariuke'

const RELATION_DISPLAYS: readonly RelationDisplay[] = ['off', 'badges', 'arrows']
const ARROW_DIRECTIONS: readonly ArrowDirection[] = ['ud', 'kakariuke']

export interface Settings {
  showFurigana: boolean
  showConfidence: boolean
  confidenceThreshold: number
  quietParts: boolean
  relationDisplay: RelationDisplay
  arrowDirection: ArrowDirection
  view: ViewKind
  rate: number
  voiceURI: string | null
  locale: Locale | null
  chainColor: ChainColor
}

export const DEFAULTS: Settings = { showFurigana: false, showConfidence: false, confidenceThreshold: 0.7, quietParts: false, relationDisplay: 'arrows', arrowDirection: 'ud', view: 'arcs', rate: 1, voiceURI: null, locale: null, chainColor: 'amber' }
```

In `validators`, replace the `showRelations` entry with:

```ts
  relationDisplay: (v) => (RELATION_DISPLAYS.includes(v as RelationDisplay) ? (v as RelationDisplay) : undefined),
  arrowDirection: (v) => (ARROW_DIRECTIONS.includes(v as ArrowDirection) ? (v as ArrowDirection) : undefined),
```

In `loadSettings`, after the `for (const key of …) applyField(…)` loop and before `return settings`:

```ts
    // pre-arrows migration: the boolean showRelations became relationDisplay
    if (obj.relationDisplay === undefined && typeof obj.showRelations === 'boolean') {
      settings.relationDisplay = obj.showRelations ? 'arrows' : 'off'
    }
```

- [ ] **Step 4: Run** — `npx vitest run tests/lib/settings.test.ts` → PASS

- [ ] **Step 5: Update `tests/lib/stairlayout.test.ts`** for the coords API. Replace the two `d`-based tests:

```ts
  it('exposes each connector as dependent-edge and head-edge coordinates via the shared rail', () => {
    const l = layoutStairs(surfaces, heads, opts)
    const c = l.connectors.find((x) => x.dep === 1)!
    const dep = l.boxes[1]
    const head = l.boxes[2]
    expect(c).toEqual({ dep: 1, head: 2, railX: c.railX, x1: dep.x + dep.width, y1: dep.y + 17, x2: head.x + head.width, y2: head.y + 17 })
  })
  it('reflects the row height option (furigana headroom)', () => {
    const tall = layoutStairs(surfaces, heads, { rowHeight: 62, boxCenterOffset: 33 })
    expect(tall.boxes[2].y).toBe(124)
    expect(tall.connectors[0].y2).toBe(124 + 33)
  })
```

- [ ] **Step 6: Update `src/lib/stairlayout.ts`** — new `StairConnector`:

```ts
export interface StairConnector {
  dep: number
  head: number
  railX: number
  /** dependent box right edge / vertical center */
  x1: number
  y1: number
  /** head box right edge / vertical center */
  x2: number
  y2: number
}
```

and the connector construction becomes:

```ts
  const connectors: StairConnector[] = pairs.map(({ dep, head }) => {
    const railX = xRight(head) + RAIL_GAP
    return {
      dep,
      head,
      railX,
      x1: boxes[dep].x + boxes[dep].width,
      y1: boxes[dep].y + opts.boxCenterOffset,
      x2: boxes[head].x + boxes[head].width,
      y2: boxes[head].y + opts.boxCenterOffset,
    }
  })
```

Run: `npx vitest run tests/lib/stairlayout.test.ts` → PASS (StairView is fixed next step; full `npm test` still red here)

- [ ] **Step 7: Swap props + direction in the three views.**

`src/components/ArcDiagram.svelte`: add to imports `import type { ArrowDirection, RelationDisplay } from '../lib/settings'`. Replace the `showRelations = false` prop (and its type line) with:

```ts
    relationDisplay = 'off',
    arrowDirection = 'ud',
```
```ts
    relationDisplay?: RelationDisplay
    arrowDirection?: ArrowDirection
```

Replace `const relH = $derived(showRelations ? REL_H : 0)` with `const relH = $derived(relationDisplay === 'badges' ? REL_H : 0)`, the `layoutArcs` minWidths argument with `relationDisplay === 'badges' ? bunsetsu.map(relWidth) : undefined`, and the badge condition with `{#if relationDisplay === 'badges' && relText(b)}`. Change the arc path constant to honor direction:

```svelte
      {@const [xFrom, xTo] = arrowDirection === 'ud' ? [a.x2, a.x1] : [a.x1, a.x2]}
      {@const d = `M ${xFrom + PAD_X} ${boxTop} C ${xFrom + PAD_X} ${boxTop - a.top}, ${xTo + PAD_X} ${boxTop - a.top}, ${xTo + PAD_X} ${boxTop}`}
```

`src/components/StairView.svelte`: same prop swap (both props), same `relH` and badge-condition changes (StairView has no minWidths). Build the path from the new connector coords:

```svelte
      {#each layout.connectors as c (c.dep)}
        {@const label = confidenceLabel(bunsetsu[c.dep])}
        {@const d = arrowDirection === 'ud'
          ? `M ${c.x2} ${c.y2} H ${c.railX} V ${c.y1} H ${c.x1}`
          : `M ${c.x1} ${c.y1} H ${c.railX} V ${c.y2} H ${c.x2}`}
```

(the two `<path>`s below use `{d}` exactly as before).

`src/components/NodeTree.svelte`: swap `showRelations` for `relationDisplay = 'off'` ONLY (`relationDisplay?: RelationDisplay` — no `arrowDirection`). `relH` → `relationDisplay === 'badges' ? REL_H : 0`; widths min-width term → `relationDisplay === 'badges' ? relWidth(b) : 0`; badge condition → `relationDisplay === 'badges' && relText(b)`.

- [ ] **Step 8: Plumb through `SentenceCard`, `App`, `SettingsMenu`, `HelpDialog`.**

`SentenceCard.svelte`: replace the `showRelations` prop with

```ts
    relationDisplay = 'off',
    arrowDirection = 'ud',
```
typed `relationDisplay?: RelationDisplay; arrowDirection?: ArrowDirection` (import types from `'../lib/settings'`). Pass `{relationDisplay} {arrowDirection}` to `ArcDiagram` and `StairView`, and only `{relationDisplay}` to `NodeTree`.

`App.svelte`: replace the `showRelations` state with

```ts
  let relationDisplay = $state(initialSettings.relationDisplay)
  let arrowDirection = $state(initialSettings.arrowDirection)
```

update the `saveSettings({ … })` call (replace `showRelations,` with `relationDisplay, arrowDirection,`), the `SettingsMenu` binding (`bind:relationDisplay bind:arrowDirection` instead of `bind:showRelations`), and the `SentenceCard` props (`{relationDisplay} {arrowDirection}` instead of `{showRelations}`).

`SettingsMenu.svelte`: replace the `showRelations = $bindable(true)` prop with

```ts
    relationDisplay = $bindable('arrows'),
    arrowDirection = $bindable('ud'),
```
typed `relationDisplay?: RelationDisplay; arrowDirection?: ArrowDirection` (import from `'../lib/settings'`). Replace the relations check-row with two select rows:

```svelte
      <div class="row">
        <label class="row-label" for="reldisp-{uid}">{t('relationDisplayLabel')}</label>
        <select id="reldisp-{uid}" bind:value={relationDisplay}>
          <option value="off">{t('relationDisplayOff')}</option>
          <option value="badges">{t('relationDisplayBadges')}</option>
          <option value="arrows">{t('relationDisplayArrows')}</option>
        </select>
      </div>
      <div class="row">
        <label class="row-label" for="arrowdir-{uid}">{t('arrowDirectionLabel')}</label>
        <select id="arrowdir-{uid}" bind:value={arrowDirection}>
          <option value="ud">{t('arrowDirectionUd')}</option>
          <option value="kakariuke">{t('arrowDirectionKakariuke')}</option>
        </select>
      </div>
```

`HelpDialog.svelte`: change the demo's `showRelations={true}` to `relationDisplay="badges"` (Task 5 switches it to `"arrows"`).

Remove the now-unused `relationsToggle` key from all four locale files.

- [ ] **Step 9: Update component tests.**

`tests/components/{ArcDiagram,StairView,NodeTree}.test.ts`: in the badge tests, replace `showRelations: true` with `relationDisplay: 'badges'`. Add direction tests to `ArcDiagram.test.ts` (import `layoutArcs` from `'../../src/lib/arclayout'`):

```ts
  it('points arrows head → dependent by default (ud)', () => {
    const { container } = render(ArcDiagram, { props: { bunsetsu, onselect: () => {} } })
    const l = layoutArcs(bunsetsu.map((b) => b.surface), bunsetsu.map((b) => b.head))
    const arc0 = l.arcs.find((a) => a.dep === 0)!
    const d = container.querySelector('path.arc')!.getAttribute('d')!
    expect(d.startsWith(`M ${arc0.x2 + 4} `)).toBe(true)
    expect(d.endsWith(` ${arc0.x1 + 4} ${l.arcAreaHeight}`)).toBe(true)
  })
  it('kakariuke direction restores dependent → head', () => {
    const { container } = render(ArcDiagram, { props: { bunsetsu, onselect: () => {}, arrowDirection: 'kakariuke' } })
    const l = layoutArcs(bunsetsu.map((b) => b.surface), bunsetsu.map((b) => b.head))
    const arc0 = l.arcs.find((a) => a.dep === 0)!
    expect(container.querySelector('path.arc')!.getAttribute('d')!.startsWith(`M ${arc0.x1 + 4} `)).toBe(true)
  })
```

and to `StairView.test.ts` (import `layoutStairs` from `'../../src/lib/stairlayout'`):

```ts
  it('ud direction draws head edge → rail → dependent edge', () => {
    const { container } = render(StairView, { props: { bunsetsu, onselect: () => {} } })
    const l = layoutStairs(bunsetsu.map((b) => b.surface), bunsetsu.map((b) => b.head), { rowHeight: 46, boxCenterOffset: 17 })
    const c = l.connectors.find((x) => x.dep === 0)!
    expect(container.querySelector('.connector path.arc')!.getAttribute('d')).toBe(`M ${c.x2} ${c.y2} H ${c.railX} V ${c.y1} H ${c.x1}`)
  })
  it('kakariuke direction draws dependent edge → rail → head edge', () => {
    const { container } = render(StairView, { props: { bunsetsu, onselect: () => {}, arrowDirection: 'kakariuke' } })
    const l = layoutStairs(bunsetsu.map((b) => b.surface), bunsetsu.map((b) => b.head), { rowHeight: 46, boxCenterOffset: 17 })
    const c = l.connectors.find((x) => x.dep === 0)!
    expect(container.querySelector('.connector path.arc')!.getAttribute('d')).toBe(`M ${c.x1} ${c.y1} H ${c.railX} V ${c.y2} H ${c.x2}`)
  })
```

`tests/components/SettingsMenu.test.ts`: replace the `'binds the relation-labels checkbox'` test with:

```ts
  it('binds the relation-display and arrow-direction selects', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([kyoko]))
    const user = userEvent.setup()
    render(SettingsMenu, { props: { ...base } })
    await user.click(screen.getByRole('button', { name: 'settings' }))
    const rel = screen.getByRole('combobox', { name: 'relation labels' }) as HTMLSelectElement
    expect(rel.value).toBe('arrows')
    await user.selectOptions(rel, 'badges')
    expect(rel.value).toBe('badges')
    const dir = screen.getByRole('combobox', { name: 'arrow direction' }) as HTMLSelectElement
    expect(dir.value).toBe('ud')
    await user.selectOptions(dir, 'kakariuke')
    expect(dir.value).toBe('kakariuke')
  })
```

`tests/components/App.test.ts`: in the persisted-settings expectation, replace `showRelations: true,` with `relationDisplay: 'arrows', arrowDirection: 'ud',`.

- [ ] **Step 10: Run everything**

Run: `npm test && npm run check`
Expected: all green (`shows no badges by default` tests still pass — default `relationDisplay` is `'off'` at component level)

- [ ] **Step 11: Commit**

```bash
git add -A src tests
git commit -m "feat: relationDisplay + arrowDirection settings, UD-default arrow direction in all views"
```

---

### Task 4: Arc view — labels on arcs + predicate badges

**Files:**
- Modify: `src/components/ArcDiagram.svelte`, `src/app.css`
- Test: `tests/components/ArcDiagram.test.ts`

**Interfaces:**
- Consumes: `relClausePredicate`/`relPredicate` keys (Task 2), `relationDisplay` prop (Task 3).
- Produces: the badge-helper pattern reused verbatim in Tasks 5–6:

```ts
  const isClauseHead = (b: BunsetsuVM) => b.relation === 'relclause' || b.relation === 'linkedclause'
  // arrows mode: a box badge only where it is true of the box itself — the
  // root is the main predicate, a clause head is its own clause's predicate
  const badgeText = (b: BunsetsuVM): string | null => {
    if (relationDisplay === 'badges') return relText(b)
    if (relationDisplay !== 'arrows') return null
    if (b.head === null) return t('relPredicate')
    return isClauseHead(b) ? t('relClausePredicate') : null
  }
```

- [ ] **Step 1: Write failing tests** — append to `tests/components/ArcDiagram.test.ts` (uses `chainSentenceFixture`, relations relclause/object/adverbial/predicate):

```ts
describe('arrows mode', () => {
  const chainB = chainSentenceFixture().bunsetsu
  it('labels ride the arcs; badges only for root and clause heads', () => {
    const { container } = render(ArcDiagram, { props: { bunsetsu: chainB, onselect: () => {}, relationDisplay: 'arrows' } })
    const onEdge = [...container.querySelectorAll('text.relation-label.on-edge')]
    expect(onEdge.map((l) => l.textContent)).toEqual(['relative clause', 'object', 'adverbial'])
    const badges = [...container.querySelectorAll('text.relation-label:not(.on-edge)')]
    expect(badges.map((l) => l.textContent)).toEqual(['predicate', 'main predicate'])
    expect([...container.querySelectorAll('.relation-label')].every((l) => l.getAttribute('aria-hidden') === 'true')).toBe(true)
  })
  it('apex labels sit above the box row', () => {
    const { container } = render(ArcDiagram, { props: { bunsetsu: chainB, onselect: () => {}, relationDisplay: 'arrows' } })
    const label = container.querySelector('text.relation-label.on-edge')!
    const box = container.querySelector('g.bunsetsu rect')!
    expect(Number(label.getAttribute('y'))).toBeLessThan(Number(box.getAttribute('y')))
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/components/ArcDiagram.test.ts` → FAIL (no `.on-edge` labels)

- [ ] **Step 3: Implement in `ArcDiagram.svelte`**
  - `const relH = $derived(relationDisplay !== 'off' ? REL_H : 0)`
  - minWidths argument: `relationDisplay !== 'off' ? bunsetsu.map(relWidth) : undefined`
  - add the `isClauseHead`/`badgeText` helpers from the Interfaces block above
  - badge markup becomes:

```svelte
        {#if badgeText(b)}
          <text class="relation-label" aria-hidden="true" x={box.cx + PAD_X} y={boxTop + BOX_H + 11} text-anchor="middle">{badgeText(b)}</text>
        {/if}
```

  - inside the connector `{#each}` group, after `<path class="hit" …/>`:

```svelte
        {#if relationDisplay === 'arrows' && relText(bunsetsu[a.dep])}
          <text class="relation-label on-edge" aria-hidden="true" x={(a.x1 + a.x2) / 2 + PAD_X} y={boxTop - a.top * 0.75 - 4} text-anchor="middle">{relText(bunsetsu[a.dep])}</text>
        {/if}
```

- [ ] **Step 4: Add the halo rule to `src/app.css`** (next to the furigana halo rule):

```css
/* arrows mode: relation labels ride the connectors — same halo trick as furigana */
svg text.relation-label.on-edge { paint-order: stroke; stroke: #fff; stroke-width: 3px; }
```

- [ ] **Step 5: Run** — `npx vitest run tests/components/ArcDiagram.test.ts && npm run check` → PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/ArcDiagram.svelte src/app.css tests/components/ArcDiagram.test.ts
git commit -m "feat: arc view arrows mode — apex labels, main-predicate and clause-predicate badges"
```

---

### Task 5: Stair view — corner labels, rail widening, help demo

**Files:**
- Modify: `src/lib/stairlayout.ts`, `src/components/StairView.svelte`, `src/components/HelpDialog.svelte`
- Test: `tests/lib/stairlayout.test.ts`, `tests/components/StairView.test.ts`, `tests/components/HelpDialog.test.ts`

**Interfaces:**
- Consumes: `badgeText` pattern (Task 4), connector coords (Task 3).
- Produces: `layoutStairs(surfaces, heads, opts, labelWidths?: number[])` — rails widen so `railX ≥ xRight(dep) + labelWidths[dep] + 8` for every dependent, monotone in head index.

- [ ] **Step 1: Write failing layout tests** — append to `tests/lib/stairlayout.test.ts`:

```ts
  it('widens the rail so a corner label fits the dependent segment', () => {
    const l = layoutStairs(surfaces, heads, opts, [90, 0, 0])
    const c0 = l.connectors.find((x) => x.dep === 0)!
    expect(c0.railX).toBeGreaterThanOrEqual(c0.x1 + 90 + 8)
    // both dependents of the head still share the widened rail
    expect(l.connectors.find((x) => x.dep === 1)!.railX).toBe(c0.railX)
  })
  it('keeps rails monotone when an early rail is widened past a later base', () => {
    const l = layoutStairs(['新しい', '映画を', '見に'], [1, 2, null], opts, [200, 0, 0])
    const byDep = Object.fromEntries(l.connectors.map((c) => [c.dep, c]))
    expect(byDep[0].railX).toBeGreaterThanOrEqual(byDep[0].x1 + 200 + 8)
    expect(byDep[1].railX).toBeGreaterThan(byDep[0].railX)
  })
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/lib/stairlayout.test.ts` → FAIL (extra argument ignored / rail too small)

- [ ] **Step 3: Implement rail widening in `layoutStairs`** — signature `layoutStairs(surfaces, heads, opts, labelWidths?: number[])`; replace the per-connector `railX` computation with a per-head rail map built before `connectors`:

```ts
  // per-head rails: right of the head's stair column, widened so every
  // dependent's horizontal segment fits its corner label, and monotone in
  // head index so nested connectors keep nested rails
  const railFor = new Map<number, number>()
  let prevRail = 0
  for (const h of [...new Set(pairs.map((p) => p.head))].sort((a, b) => a - b)) {
    let rail = xRight(h) + RAIL_GAP
    for (const p of pairs) {
      if (p.head !== h) continue
      const labelW = labelWidths?.[p.dep] ?? 0
      if (labelW > 0) rail = Math.max(rail, xRight(p.dep) + labelW + 8)
    }
    rail = Math.max(rail, prevRail + 8)
    railFor.set(h, rail)
    prevRail = rail
  }
```

and in the connector map: `const railX = railFor.get(head)!`. (With no `labelWidths`, rails are `xRight(h) + RAIL_GAP` exactly as before — the monotone guard never binds because `xRight` grows 24/step; existing tests stay green.)

- [ ] **Step 4: Run** — `npx vitest run tests/lib/stairlayout.test.ts` → PASS

- [ ] **Step 5: Write failing StairView tests** — append (uses `chainSentenceFixture` already imported):

```ts
  it('arrows mode: corner labels right-aligned at the rail, badges on predicates only', () => {
    const chainB = chainSentenceFixture().bunsetsu
    const { container } = render(StairView, { props: { bunsetsu: chainB, onselect: () => {}, relationDisplay: 'arrows' } })
    const onEdge = [...container.querySelectorAll('text.relation-label.on-edge')]
    expect(onEdge.map((l) => l.textContent)).toEqual(['relative clause', 'object', 'adverbial'])
    expect(onEdge.every((l) => l.getAttribute('text-anchor') === 'end')).toBe(true)
    const badges = [...container.querySelectorAll('text.relation-label:not(.on-edge)')]
    expect(badges.map((l) => l.textContent)).toEqual(['predicate', 'main predicate'])
  })
```

and replace the HelpDialog demo test with:

```ts
  it('demo diagram labels arrows and marks the predicates', async () => {
    const user = userEvent.setup()
    render(HelpDialog, { props: { chainColor: 'amber' } })
    await user.click(screen.getByRole('button', { name: 'help' }))
    // HELP_SENTENCE: relclause / object / linkedclause / predicate
    expect(document.querySelectorAll('dialog .relation-label.on-edge').length).toBe(3)
    const badges = [...document.querySelectorAll('dialog .relation-label:not(.on-edge)')]
    expect(badges.map((b) => b.textContent)).toEqual(['predicate', 'predicate', 'main predicate'])
  })
```

- [ ] **Step 6: Run to verify failure** — `npx vitest run tests/components/StairView.test.ts tests/components/HelpDialog.test.ts` → FAIL

- [ ] **Step 7: Implement in `StairView.svelte`**
  - import `textWidth` from `'../lib/arclayout'`; add after `relText`:

```ts
  // latin badge at 10px is ~0.6× the 17px-font estimate textWidth gives
  const relWidth = (b: BunsetsuVM) => {
    const label = relText(b)
    return label ? Math.ceil(textWidth(label) * 0.6) + 8 : 0
  }
```

  - `const relH = $derived(relationDisplay !== 'off' ? REL_H : 0)`
  - pass label widths to layout: `layoutStairs(surfaces, heads, { rowHeight: …, boxCenterOffset: … }, relationDisplay === 'arrows' ? bunsetsu.map(relWidth) : undefined)`
  - add the `isClauseHead`/`badgeText` helpers exactly as in Task 4's Interfaces block; badge markup becomes `{#if badgeText(b)}` with `{badgeText(b)}` as content (position attributes unchanged)
  - corner label inside the connector `{#each}` after `<path class="hit" …/>`:

```svelte
          {#if relationDisplay === 'arrows' && relText(bunsetsu[c.dep])}
            <text class="relation-label on-edge" aria-hidden="true" x={c.railX - 4} y={c.y1 - 5} text-anchor="end">{relText(bunsetsu[c.dep])}</text>
          {/if}
```

  - `HelpDialog.svelte`: demo prop `relationDisplay="badges"` → `relationDisplay="arrows"`

- [ ] **Step 8: Run** — `npm test && npm run check` → PASS

- [ ] **Step 9: Commit**

```bash
git add src/lib/stairlayout.ts src/components/StairView.svelte src/components/HelpDialog.svelte tests/lib/stairlayout.test.ts tests/components/StairView.test.ts tests/components/HelpDialog.test.ts
git commit -m "feat: stair view arrows mode — branch-corner labels with label-aware rails; help demo on arrows"
```

---

### Task 6: Tree view — above-box labels with furigana stack

**Files:**
- Modify: `src/lib/treelayout.ts`, `src/components/NodeTree.svelte`
- Test: `tests/lib/treelayout.test.ts`, `tests/components/NodeTree.test.ts`

**Interfaces:**
- Consumes: `badgeText` pattern (Task 4), `relationDisplay` prop (Task 3).
- Produces: `layoutTree(widths, heads, gap = 20, levelH = 70)`.

- [ ] **Step 1: Write failing layout test** — append to `tests/lib/treelayout.test.ts`:

```ts
  it('honors a custom level height', () => {
    const tall = layoutTree([50, 60], [1, null], 20, 88)
    const pos = new Map(tall.nodes.map((n) => [n.index, n]))
    expect(pos.get(1)!.y).toBe(0)
    expect(pos.get(0)!.y).toBe(88)
    expect(tall.height).toBe(88)
  })
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/lib/treelayout.test.ts` → FAIL

- [ ] **Step 3: Implement** — `export function layoutTree(widths: number[], heads: (number | null)[], gap = 20, levelH = LEVEL_H): TreeLayout`, with `y: depth * levelH` in `place` and `height: maxDepth * levelH`. Run the test → PASS.

- [ ] **Step 4: Write failing NodeTree tests** — append (import `chainSentenceFixture` if not present):

```ts
  it('arrows mode: labels cap each dependent, badges on predicates only', () => {
    const chainB = chainSentenceFixture().bunsetsu
    const { container } = render(NodeTree, { props: { bunsetsu: chainB, onselect: () => {}, relationDisplay: 'arrows' } })
    // DOM order follows layout.nodes = root-first DFS: 行きました。→ 見に → 映画を → 新しい
    const onEdge = [...container.querySelectorAll('text.relation-label.on-edge')]
    expect(onEdge.map((l) => l.textContent)).toEqual(['adverbial', 'object', 'relative clause'])
    const badges = [...container.querySelectorAll('text.relation-label:not(.on-edge)')]
    expect(badges.map((l) => l.textContent)).toEqual(['main predicate', 'predicate'])
  })
  it('arrows mode stacks the label above the furigana above the box', () => {
    const chainB = chainSentenceFixture().bunsetsu
    const { container } = render(NodeTree, { props: { bunsetsu: chainB, onselect: () => {}, relationDisplay: 'arrows', showFurigana: true } })
    const g = [...container.querySelectorAll('g.bunsetsu')].find((el) => el.getAttribute('aria-label') === '新しい')!
    const labelY = Number(g.querySelector('text.relation-label.on-edge')!.getAttribute('y'))
    const furiY = Number(g.querySelector('text.furigana')!.getAttribute('y'))
    const boxY = Number(g.querySelector('rect')!.getAttribute('y'))
    expect(labelY).toBeLessThan(furiY)
    expect(furiY).toBeLessThan(boxY + 34)
  })
```

- [ ] **Step 5: Run to verify failure** — `npx vitest run tests/components/NodeTree.test.ts` → FAIL

- [ ] **Step 6: Implement in `NodeTree.svelte`**
  - change `relWidth` to take the label string: `const relWidth = (label: string | null) => (label ? Math.ceil(textWidth(label) * 0.6) + 8 : 0)`
  - add `isClauseHead`/`badgeText` helpers (Task 4 Interfaces block)
  - widths account for whichever under/over texts exist:

```ts
  const widths = $derived(
    bunsetsu.map((b) =>
      Math.max(
        textWidth(b.surface) + 2 * BOX_PAD,
        relationDisplay === 'badges' ? relWidth(relText(b)) : 0,
        relationDisplay === 'arrows' ? Math.max(relWidth(badgeText(b)), b.head !== null ? relWidth(relText(b)) : 0) : 0,
      ),
    ),
  )
```

  - `const relH = $derived(relationDisplay !== 'off' ? REL_H : 0)`
  - layout: `layoutTree(widths, bunsetsu.map((b) => b.head), 20, relationDisplay === 'arrows' ? 88 : 70)`
  - badge markup → `{#if badgeText(b)}` … `{badgeText(b)}`
  - above-box label inside the node `<g>` (before the `rect`):

```svelte
        {#if relationDisplay === 'arrows' && b.head !== null && relText(b)}
          <text class="relation-label on-edge" aria-hidden="true" x={n.x + PAD_X} y={n.y + topPad - (showFurigana ? FURI_H : 0) - 4} text-anchor="middle">{relText(b)}</text>
        {/if}
```

- [ ] **Step 7: Run** — `npm test && npm run check` → PASS

- [ ] **Step 8: Commit**

```bash
git add src/lib/treelayout.ts src/components/NodeTree.svelte tests/lib/treelayout.test.ts tests/components/NodeTree.test.ts
git commit -m "feat: tree view arrows mode — subtree-capping labels with furigana stack"
```

---

### Task 7: Clause-extent brackets in all three views

**Files:**
- Modify: `src/components/ArcDiagram.svelte`, `src/components/StairView.svelte`, `src/components/NodeTree.svelte`, `src/app.css`
- Test: `tests/components/{ArcDiagram,StairView,NodeTree}.test.ts`

**Interfaces:**
- Consumes: `subtreeSpan` (Task 1). Shared per-view state (add to each view's script):

```ts
import { subtreeSpan } from '../lib/extent'
  const extentFor = (i: number | null) =>
    i !== null && (bunsetsu[i]?.relation === 'relclause' || bunsetsu[i]?.relation === 'linkedclause') ? i : null
  const extentIdx = $derived(extentFor(hovered) ?? extentFor(selected))
  const extentSpan = $derived(extentIdx !== null ? subtreeSpan(bunsetsu.map((b) => b.head), extentIdx) : null)
```

Brackets render in every `relationDisplay` mode (including `off`).

- [ ] **Step 1: Write failing tests.** Shared fixture — add to each of the three test files (or a local const per file):

```ts
const clauseB = [
  bunsetsuFixture(0, '本屋で', 1, 0.9, 'ほんやで', [morphemeFixture({ surface: '本屋' })], 'adverbial'),
  bunsetsuFixture(1, '買った', 2, 0.9, 'かった', [morphemeFixture({ surface: '買った', posJa: '動詞・自立' })], 'relclause'),
  bunsetsuFixture(2, '本を', 3, 0.9, 'ほんを', [morphemeFixture({ surface: '本' })], 'object'),
  bunsetsuFixture(3, '読んだ。', null, null, 'よんだ。', [morphemeFixture({ surface: '読んだ' })], 'predicate'),
]
```

(import `bunsetsuFixture, morphemeFixture` from `'../fixtures'`; `fireEvent` from `'@testing-library/svelte'` if not imported.) `subtreeSpan(heads, 1)` = `{ from: 0, to: 1 }`.

`ArcDiagram.test.ts`:

```ts
describe('extent bracket', () => {
  it('hovering the clause head draws the bracket over its span; leaving removes it', async () => {
    const { container } = render(ArcDiagram, { props: { bunsetsu: clauseB, onselect: () => {} } })
    expect(container.querySelector('.extent-bracket')).toBeNull()
    await fireEvent.mouseEnter([...container.querySelectorAll('g.bunsetsu')][1])
    const br = container.querySelector('.extent-bracket')!
    const l = layoutArcs(clauseB.map((b) => b.surface), clauseB.map((b) => b.head))
    expect(br.getAttribute('d')!.startsWith(`M ${l.boxes[0].x + 4} `)).toBe(true)
    await fireEvent.mouseLeave([...container.querySelectorAll('g.bunsetsu')][1])
    expect(container.querySelector('.extent-bracket')).toBeNull()
  })
  it('selection draws it too; non-clause bunsetsu never do', () => {
    const sel = render(ArcDiagram, { props: { bunsetsu: clauseB, selected: 1, onselect: () => {} } })
    expect(sel.container.querySelector('.extent-bracket')).not.toBeNull()
    expect(sel.container.querySelector('.extent-bracket')!.getAttribute('aria-hidden')).toBe('true')
    const non = render(ArcDiagram, { props: { bunsetsu: clauseB, selected: 0, onselect: () => {} } })
    expect(non.container.querySelector('.extent-bracket')).toBeNull()
  })
})
```

`StairView.test.ts` (layout note: brackets clamp at `-2` inside the `translate(4, 2)` group):

```ts
  it('draws the extent bracket left of the covered rows on selection', () => {
    const { container } = render(StairView, { props: { bunsetsu: clauseB, selected: 1, onselect: () => {} } })
    const br = container.querySelector('.extent-bracket')!
    const l = layoutStairs(clauseB.map((b) => b.surface), clauseB.map((b) => b.head), { rowHeight: 46, boxCenterOffset: 17 })
    const bx = Math.max(-2, Math.min(l.boxes[0].x, l.boxes[1].x) - 8)
    expect(br.getAttribute('d')).toBe(`M ${bx + 6} ${l.boxes[0].y} H ${bx} V ${l.boxes[1].y + 34} H ${bx + 6}`)
  })
```

`NodeTree.test.ts` — side selection (import `layoutTree` from `'../../src/lib/treelayout'` and `textWidth` from `'../../src/lib/arclayout'`):

```ts
describe('extent bracket side', () => {
  it('ties resolve to the right side (chain subtree, equal gaps)', () => {
    // clauseB is a pure chain → the subtree band of 買った is centered, so
    // left and right clearance are equal and the tie-break picks right
    const { container } = render(NodeTree, { props: { bunsetsu: clauseB, onselect: () => {}, selected: 1 } })
    const br = container.querySelector('.extent-bracket')!
    const widths = clauseB.map((b) => textWidth(b.surface) + 20)
    const l = layoutTree(widths, clauseB.map((b) => b.head))
    const nodesIn = l.nodes.filter((n) => n.index <= 1) // span of 買った = {0, 1}
    const maxX = Math.max(...nodesIn.map((n) => n.x + widths[n.index] / 2))
    const m = br.getAttribute('d')!.match(/H (-?[\d.]+) V/)!
    expect(Number(m[1])).toBeGreaterThanOrEqual(maxX)
  })
  it('hover works like selection and only for clause labels', async () => {
    const { container } = render(NodeTree, { props: { bunsetsu: clauseB, onselect: () => {} } })
    const clauseG = [...container.querySelectorAll('g.bunsetsu')].find((el) => el.getAttribute('aria-label') === '買った')!
    await fireEvent.mouseEnter(clauseG)
    expect(container.querySelector('.extent-bracket')).not.toBeNull()
    await fireEvent.mouseLeave(clauseG)
    expect(container.querySelector('.extent-bracket')).toBeNull()
    const nonClause = [...container.querySelectorAll('g.bunsetsu')].find((el) => el.getAttribute('aria-label') === '本屋で')!
    await fireEvent.mouseEnter(nonClause)
    expect(container.querySelector('.extent-bracket')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/components/ArcDiagram.test.ts tests/components/StairView.test.ts tests/components/NodeTree.test.ts` → FAIL

- [ ] **Step 3: Add the bracket style to `src/app.css`:**

```css
/* clause-extent bracket: shown while a relative/linked-clause bunsetsu is hovered or selected */
svg path.extent-bracket { fill: none; stroke: #b08d3e; stroke-width: 1.6; opacity: 0.8; }
```

- [ ] **Step 4: Implement per view.** Add the shared state block (Interfaces above) to each view's script.

`ArcDiagram.svelte` — change `svgHeight` to `boxTop + BOX_H + 6 + relH + 8` (if an existing test asserts the svg height, adjust it by +8) and add before `</svg>`:

```svelte
    {#if extentSpan}
      {@const bx1 = layout.boxes[extentSpan.from].x + PAD_X}
      {@const bx2 = layout.boxes[extentSpan.to].x + layout.boxes[extentSpan.to].width + PAD_X}
      {@const by = boxTop + BOX_H + relH + 6}
      <path class="extent-bracket" aria-hidden="true" d="M {bx1} {by - 5} V {by} H {bx2} V {by - 5}" />
    {/if}
```

`StairView.svelte` — add inside the translated `<g>`, after the boxes `{#each}`:

```svelte
      {#if extentSpan}
        {@const rows = layout.boxes.slice(extentSpan.from, extentSpan.to + 1)}
        {@const bx = Math.max(-2, Math.min(...rows.map((r) => r.x)) - 8)}
        {@const top = rows[0].y + furiH}
        {@const bottom = rows[rows.length - 1].y + furiH + BOX_H + relH}
        <path class="extent-bracket" aria-hidden="true" d="M {bx + 6} {top} H {bx} V {bottom} H {bx + 6}" />
      {/if}
```

(with `relationDisplay: 'off'` and no furigana, `furiH` and `relH` are 0, matching the test's expected `d`.)

`NodeTree.svelte` — add a derived bracket and render it after the nodes `{#each}`:

```ts
  const bracket = $derived.by(() => {
    if (!extentSpan) return null
    const span = extentSpan
    const inSpan = (i: number) => i >= span.from && i <= span.to
    const nodesIn = layout.nodes.filter((n) => inSpan(n.index))
    const minX = Math.min(...nodesIn.map((n) => n.x - widths[n.index] / 2))
    const maxX = Math.max(...nodesIn.map((n) => n.x + widths[n.index] / 2))
    const rows = new Set(nodesIn.map((n) => n.y))
    let leftGap = minX
    let rightGap = layout.width - maxX
    for (const n of layout.nodes) {
      if (inSpan(n.index) || !rows.has(n.y)) continue
      const l = n.x - widths[n.index] / 2
      const r = n.x + widths[n.index] / 2
      if (r <= minX) leftGap = Math.min(leftGap, minX - r)
      if (l >= maxX) rightGap = Math.min(rightGap, l - maxX)
    }
    const right = rightGap >= leftGap
    const x = (right ? Math.min(maxX + 8, layout.width + PAD_X) : Math.max(minX - 8, -2)) + PAD_X
    const tick = right ? -6 : 6
    const top = Math.min(...nodesIn.map((n) => n.y)) + topPad
    const bottom = Math.max(...nodesIn.map((n) => n.y)) + topPad + BOX_H + relH
    return `M ${x + tick} ${top} H ${x} V ${bottom} H ${x + tick}`
  })
```

```svelte
    {#if bracket}
      <path class="extent-bracket" aria-hidden="true" d={bracket} />
    {/if}
```

- [ ] **Step 5: Run** — `npm test && npm run check` → PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/ArcDiagram.svelte src/components/StairView.svelte src/components/NodeTree.svelte src/app.css tests/components
git commit -m "feat: clause-extent brackets on hover/selection in all three views"
```

---

### Task 8: live-check, docs addendum, screenshots

**Files:**
- Modify: `scripts/live-check.mjs`, `docs/relation-labels.md`
- Regenerate: `docs/images/*.png` (`npm run shots`)

**Interfaces:**
- Consumes: everything shipped in Tasks 1–7; the example sentence 昨日、私は友達と新しい映画を見に行きました。 (7 bunsetsu; relations adverbial/topic/adverbial/relclause/object/linkedclause/predicate → arrows mode shows 6 edge labels + 3 badges).

- [ ] **Step 1: Replace the relations check in `scripts/live-check.mjs`** (the `try` block currently comparing badge count to box count):

```js
    try {
      const labels = await page.locator('main .relation-label').allTextContents()
      const onEdge = await page.locator('main .relation-label.on-edge').count()
      // arrows default: 6 edge labels + 3 predicate badges (main + 2 clause heads)
      if (labels.length !== 9 || onEdge !== 6) throw new Error(`labels=${labels.length} onEdge=${onEdge}`)
      if (!labels.includes('object') || !labels.includes('main predicate'))
        throw new Error(`unexpected label texts: ${labels.join(',')}`)
      // selecting the linked-clause bunsetsu (見に) draws the extent bracket
      await page.locator('main g.bunsetsu').nth(5).click()
      await page.waitForSelector('main .extent-bracket', { timeout: 5_000 })
      await page.keyboard.press('Escape')
      ok('relations: 6 arrow labels + 3 predicate badges, extent bracket on 見に')
    } catch (e) {
      fail('relations', String(e))
    }
```

- [ ] **Step 2: Verify against a local production build**

Run: `npm run build -- --base=/ayaki/ && npx vite preview --base=/ayaki/ --port 4173 &` then `node scripts/live-check.mjs http://localhost:4173/ayaki/`
Expected: 13/13 checks pass (all pre-existing checks unaffected; the relations line reads as above). Kill the preview server afterwards.

- [ ] **Step 3: Append the addendum to `docs/relation-labels.md`:**

```markdown
## Display update (2026-07-22): labels on arrows

Since the relation-arrows feature, labels render **on the dependency arrows
by default** (setting "relation labels": hidden / under bunsetsu / on
arrows), with arrows pointing head → dependent (UD convention; a
kakari-uke setting restores dependent → head — the tree view stays
arrowless either way). The root's learner term is now **"main predicate"**;
in arrows mode the head of a relative/linked clause carries a plain
**"predicate"** badge while its relation stays on the arrow. Hovering or
selecting a clause-labeled bunsetsu draws a bracket along the clause's full
subtree span. None of this changes the labeler or the measurements above —
`scripts/relation-eval.ts` is unaffected.
```

- [ ] **Step 4: Regenerate the README screenshots**

Run: `npm run shots`
Expected: all three `docs/images/*.png` change (arrows-mode visuals); `git status` shows exactly those three files modified.

- [ ] **Step 5: Full gates**

Run: `npm test && npm run check && npm run smoke`
Expected: all green

- [ ] **Step 6: Commit**

```bash
git add scripts/live-check.mjs docs/relation-labels.md docs/images
git commit -m "chore: live-check arrows-mode relations check, docs addendum, refreshed screenshots"
```

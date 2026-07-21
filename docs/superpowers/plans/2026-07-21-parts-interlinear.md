# Parts Interlinear (Ruby + Role Labels) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each heading segment becomes an interlinear stack — kana ruby above (following `showFurigana`), the pill, and a localized short role label below.

**Architecture:** `PART_SHORT_KEYS` + 5 catalog keys ×4 → `SegmentedSurface` restructure (`.part-col` column wrapper carries role attrs and hover; `.part` pill keeps its class semantics) → `showFurigana` threading (Inspector/App, help pins it on) → extended live-check + screenshots.

**Tech Stack:** Svelte 5, TypeScript, vitest/jsdom, Playwright (scripts).

**Spec:** `docs/superpowers/specs/2026-07-21-parts-interlinear-design.md`

## Global Constraints

- Catalog values VERBATIM from this plan (de unabbreviated: Kopf/Hilfsverb/Partikel/Affix/Zeichen; ja 主辞/助動詞/助詞/接辞/記号; zh 中心语/助动词/助词/词缀/标点; en head/aux/particle/affix/punct.); `partHeadShort`…`partSymbolShort` inserted directly after the `partSymbol` line in each of the four catalogs.
- `.part` stays the pill's class with `quiet`/`active` — every existing `.part` count keeps meaning "one per morpheme". Role attributes (`data-role`, `--part`, `title`) and the `mouseenter` handler move to the new `.part-col` wrapper; `mouseleave` stays on `.parts`.
- Ruby renders only when `showFurigana` AND the morpheme's reading exists AND differs from its surface; otherwise an empty `.part-ruby` placeholder (row absent entirely when furigana is off).
- No `role`/`tabindex` attributes to silence a11y warnings — the scoped, justified `svelte-ignore` comments move with their elements.
- The help dialog is always mounted — tests scope queries to the render container or dialog.
- Conventional Commits; the git hook adds the Co-Authored-By trailer — do not add it manually.
- All commands run from `/Users/markus/IdeaProjects/ayaki`.

## Branch setup (controller, before Task 1)

Branch `feat/parts-interlinear` from main; first commit: spec + this plan —
`docs: parts-interlinear spec and plan`.

---

### Task 1: Short label keys

**Files:**
- Modify: `src/lib/partroles.ts`, `src/lib/locales/{en,de,ja,zh}.ts` (5 keys each)
- Test: `tests/lib/partroles.test.ts`

**Interfaces:**
- Consumes: existing `PART_ROLES`, catalogs.
- Produces: `PART_SHORT_KEYS: Record<PartRole, 'partHeadShort' | …>` — Task 2 renders `t(PART_SHORT_KEYS[role])`.

- [ ] **Step 1: Failing test**

In `tests/lib/partroles.test.ts`, extend the import to include `PART_SHORT_KEYS` and add inside the `describe('palette', ...)` block:

```ts
  it('maps every role to a short label key', () => {
    expect(Object.keys(PART_SHORT_KEYS).sort()).toEqual([...PART_ROLES].sort())
  })
```

Run: `npx vitest run tests/lib/partroles.test.ts`
Expected: FAIL (no export).

- [ ] **Step 2: Module**

In `src/lib/partroles.ts`, directly after the `PART_LABEL_KEYS` constant, add:

```ts
/** i18n catalog key holding the SHORT under-pill label of each role */
export const PART_SHORT_KEYS = {
  head: 'partHeadShort',
  aux: 'partAuxShort',
  particle: 'partParticleShort',
  affix: 'partAffixShort',
  symbol: 'partSymbolShort',
} as const
```

- [ ] **Step 3: Catalog keys**

Insert directly after the `partSymbol` line in each catalog:

`src/lib/locales/en.ts`:
```ts
  partHeadShort: 'head',
  partAuxShort: 'aux',
  partParticleShort: 'particle',
  partAffixShort: 'affix',
  partSymbolShort: 'punct.',
```
`src/lib/locales/de.ts`:
```ts
  partHeadShort: 'Kopf',
  partAuxShort: 'Hilfsverb',
  partParticleShort: 'Partikel',
  partAffixShort: 'Affix',
  partSymbolShort: 'Zeichen',
```
`src/lib/locales/ja.ts`:
```ts
  partHeadShort: '主辞',
  partAuxShort: '助動詞',
  partParticleShort: '助詞',
  partAffixShort: '接辞',
  partSymbolShort: '記号',
```
`src/lib/locales/zh.ts`:
```ts
  partHeadShort: '中心语',
  partAuxShort: '助动词',
  partParticleShort: '助词',
  partAffixShort: '词缀',
  partSymbolShort: '标点',
```

- [ ] **Step 4: Gates**

Run: `npx vitest run tests/lib/partroles.test.ts`, then `npm test && npm run check`
Expected: PASS, 0 errors 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add src/lib/partroles.ts src/lib/locales tests/lib/partroles.test.ts
git commit -m "feat: short localized role labels for part segments"
```

---

### Task 2: SegmentedSurface interlinear restructure

**Files:**
- Modify: `src/components/SegmentedSurface.svelte`, `src/app.css`
- Test: `tests/components/SegmentedSurface.test.ts`, `tests/components/Inspector.test.ts` (one hover-target line — mechanical fallout, keeps the commit green)

**Interfaces:**
- Consumes: `PART_SHORT_KEYS` (Task 1).
- Produces: new prop `showFurigana?: boolean` (default false); DOM contract — `.part-col` wrapper (role attrs, tooltip, mouseenter), optional `.part-ruby`, `.part` pill (quiet/active), `.part-label`. Tasks 3–4 rely on these class names.

- [ ] **Step 1: Failing tests**

Replace the entire content of `tests/components/SegmentedSurface.test.ts` with:

```ts
// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import SegmentedSurface from '../../src/components/SegmentedSurface.svelte'
import { morphemeFixture } from '../fixtures'

const morphemes = [
  morphemeFixture({ surface: '行き', reading: 'いき', posJa: '動詞・自立' }),
  morphemeFixture({ surface: 'ましょ', reading: 'ましょ', posJa: '助動詞' }),
  morphemeFixture({ surface: 'う', reading: 'う', posJa: '助動詞' }),
  morphemeFixture({ surface: 'ね', reading: 'ね', posJa: '助詞・終助詞' }),
  morphemeFixture({ surface: '。', reading: null, posJa: '記号・句点' }),
]

describe('SegmentedSurface', () => {
  it('renders one column per morpheme with role, color, tooltip, and label', () => {
    const { container } = render(SegmentedSurface, { props: { morphemes } })
    const cols = container.querySelectorAll('.part-col')
    const parts = container.querySelectorAll('.part')
    expect(cols).toHaveLength(5)
    expect(parts).toHaveLength(5)
    expect(parts[0].textContent).toBe('行き')
    expect(cols[0].getAttribute('data-role')).toBe('head')
    expect(cols[1].getAttribute('data-role')).toBe('aux')
    expect(cols[3].getAttribute('data-role')).toBe('particle')
    expect(cols[4].getAttribute('data-role')).toBe('symbol')
    expect(cols[0].getAttribute('style')).toContain('#3b82f6')
    expect(cols[0].getAttribute('title')).toBe('head (content word)')
    const labels = [...container.querySelectorAll('.part-label')].map((l) => l.textContent)
    expect(labels).toEqual(['head', 'aux', 'aux', 'particle', 'punct.'])
  })
  it('applies quiet and active classes to the pills, labels present in quiet mode', () => {
    const { container } = render(SegmentedSurface, { props: { morphemes, quiet: true, active: 1 } })
    const parts = container.querySelectorAll('.part')
    expect(parts[0]).toHaveClass('quiet')
    expect(parts[1]).toHaveClass('active')
    expect(parts[0]).not.toHaveClass('active')
    expect(container.querySelectorAll('.part-label')).toHaveLength(5)
  })
  it('renders ruby only for differing readings when furigana is on', () => {
    const off = render(SegmentedSurface, { props: { morphemes } })
    expect(off.container.querySelectorAll('.part-ruby')).toHaveLength(0)
    const on = render(SegmentedSurface, { props: { morphemes, showFurigana: true } })
    const rubies = [...on.container.querySelectorAll('.part-ruby')].map((r) => r.textContent)
    expect(rubies).toEqual(['いき', '', '', '', ''])
  })
  it('reports hover enter and leave on the columns', async () => {
    const onhover = vi.fn()
    const { container } = render(SegmentedSurface, { props: { morphemes, onhover } })
    await fireEvent.mouseEnter(container.querySelectorAll('.part-col')[2])
    expect(onhover).toHaveBeenLastCalledWith(2)
    await fireEvent.mouseLeave(container.querySelector('.parts')!)
    expect(onhover).toHaveBeenLastCalledWith(null)
  })
})
```

Run: `npx vitest run tests/components/SegmentedSurface.test.ts`
Expected: FAIL (no `.part-col`).

Additionally (mechanical fallout of the DOM change — the mouseenter handler moves to the wrapper, and mouseenter does not bubble): in `tests/components/Inspector.test.ts`, inside `links segments to entries bidirectionally and scrolls on segment hover`, replace

```ts
      await fireEvent.mouseEnter(parts[1])
```

with

```ts
      await fireEvent.mouseEnter(container.querySelectorAll('.part-col')[1])
```

(all `parts[i]`/`entries[i]` class assertions stay unchanged).

- [ ] **Step 2: Component**

Replace the entire content of `src/components/SegmentedSurface.svelte` with:

```svelte
<script lang="ts">
  import { morphemeRole, PART_LABEL_KEYS, PART_PALETTE, PART_SHORT_KEYS } from '../lib/partroles'
  import { t } from '../lib/i18n.svelte'
  import type { MorphemeVM } from '../lib/types'

  let {
    morphemes,
    quiet = false,
    active = null,
    showFurigana = false,
    onhover = () => {},
  }: {
    morphemes: MorphemeVM[]
    quiet?: boolean
    active?: number | null
    showFurigana?: boolean
    onhover?: (index: number | null) => void
  } = $props()
</script>

<!-- Pointer-only hover affordance: keyboard users get the segment↔entry link
     via :focus-within on the entries. Making parts focusable would add dead
     tab stops that announce as buttons doing nothing. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<span class="parts" lang="ja" onmouseleave={() => onhover(null)}>
  {#each morphemes as m, i}
    {@const role = morphemeRole(m.posJa)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span
      class="part-col"
      data-role={role}
      style="--part: {PART_PALETTE[role]}"
      title={t(PART_LABEL_KEYS[role])}
      onmouseenter={() => onhover(i)}
    >
      {#if showFurigana}
        <span class="part-ruby">{m.reading && m.reading !== m.surface ? m.reading : ''}</span>
      {/if}
      <span class="part" class:quiet class:active={active === i}>{m.surface}</span>
      <span class="part-label">{t(PART_SHORT_KEYS[role])}</span>
    </span>
  {/each}
</span>
```

- [ ] **Step 3: CSS**

In `src/app.css`, replace

```css
.parts { display: inline; }
.part { background: color-mix(in srgb, var(--part) 16%, transparent); border-radius: 7px; padding: 0.05em 0.12em; margin-right: 3px; transition: background 0.12s; }
.part:last-child { margin-right: 0; }
```

with

```css
.parts { display: inline-flex; align-items: flex-end; gap: 3px; vertical-align: bottom; }
.part-col { display: inline-flex; flex-direction: column; align-items: center; }
.part-ruby { font-size: 0.62rem; font-weight: 400; line-height: 1.3; min-height: 0.85em; color: color-mix(in srgb, currentColor 75%, transparent); }
.part { background: color-mix(in srgb, var(--part) 16%, transparent); border-radius: 7px; padding: 0.05em 0.12em; transition: background 0.12s; align-self: stretch; text-align: center; }
.part-label { font-size: 0.6rem; font-weight: 400; line-height: 1.5; margin-top: 2px; color: color-mix(in srgb, currentColor 55%, transparent); }
```

(the `.part.active`/`.part.quiet`/`.part.quiet.active` rules below stay unchanged).

- [ ] **Step 4: Gates**

Run: `npx vitest run tests/components/SegmentedSurface.test.ts tests/components/Inspector.test.ts`, then `npm test && npm run check`
Expected: PASS (full suite), 0 errors 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add src/components/SegmentedSurface.svelte src/app.css tests/components/SegmentedSurface.test.ts tests/components/Inspector.test.ts
git commit -m "feat: interlinear part columns with ruby and role labels"
```

---

### Task 3: Consumers — Inspector, App, HelpDialog

**Files:**
- Modify: `src/components/Inspector.svelte`, `src/components/App.svelte`, `src/components/HelpDialog.svelte`
- Test: `tests/components/Inspector.test.ts`, `tests/components/HelpDialog.test.ts`

**Interfaces:**
- Consumes: `SegmentedSurface` DOM contract (Task 2); App's existing `showFurigana` state.
- Produces: Inspector prop `showFurigana?: boolean` (default false).

- [ ] **Step 1: Failing tests**

In `tests/components/Inspector.test.ts`, inside `describe('segmented parts', ...)` (the hover-target line was already adapted in Task 2), add after the `keeps the segment highlight while focus moves within the same entry` test:

```ts
  it('shows ruby in the heading when furigana is on', () => {
    const s = sentenceFixture()
    const { container } = render(Inspector, { props: { sentence: s, index: 0, total: 1, selected: s.bunsetsu[0], rate: 1, voiceURI: null, showFurigana: true } })
    const rubies = [...container.querySelectorAll('.part-ruby')].map((r) => r.textContent)
    expect(rubies).toEqual(['ねこ', ''])
    const off = render(Inspector, { props: { sentence: s, index: 0, total: 1, selected: s.bunsetsu[0], rate: 1, voiceURI: null } })
    expect(off.container.querySelectorAll('.part-ruby')).toHaveLength(0)
  })
```

(猫が = 猫→ねこ differs, が→が same.)

In `tests/components/HelpDialog.test.ts`, in the seven-sections test after the `.parts-example .part` length assertion, add:

```ts
    expect([...dialog.querySelectorAll('.parts-example .part-ruby')].map((r) => r.textContent)).toEqual(['いき', '', '', '', ''])
    expect(dialog.querySelectorAll('.parts-example .part-label')).toHaveLength(5)
```

Run: `npx vitest run tests/components/Inspector.test.ts tests/components/HelpDialog.test.ts`
Expected: the two new ruby assertions FAIL (Inspector renders no `.part-ruby` without the prop threaded; the help example renders none while unpinned).

- [ ] **Step 2: Inspector + App + HelpDialog**

`Inspector.svelte`: add prop `showFurigana = false,` after `quietParts = false,` and `showFurigana?: boolean` after `quietParts?: boolean`; the heading becomes:

```svelte
      <SegmentedSurface morphemes={selected.morphemes} quiet={quietParts} {showFurigana} active={hoverPart} onhover={hoverSegment} />
```

`App.svelte`: add `{showFurigana}` to the `<Inspector ...>` line, directly after `{quietParts}` (App already holds the state; SentenceCard already receives it separately).

`HelpDialog.svelte`: the parts example pins furigana on:

```svelte
      <p class="parts-example"><SegmentedSurface morphemes={HELP_PARTS} showFurigana={true} /></p>
```

- [ ] **Step 3: Gates**

Run: `npx vitest run tests/components/Inspector.test.ts tests/components/HelpDialog.test.ts`, then `npm test && npm run check`
Expected: PASS (full suite), 0 errors 0 warnings.

- [ ] **Step 4: Commit**

```bash
git add src/components/Inspector.svelte src/components/App.svelte src/components/HelpDialog.svelte tests/components/Inspector.test.ts tests/components/HelpDialog.test.ts
git commit -m "feat: thread furigana into the segmented heading; help example pins it on"
```

---

### Task 4: live-check + screenshots

**Files:**
- Modify: `scripts/live-check.mjs`, `docs/images/screenshot{,-tree,-cabocha}.png` (regenerated)

**Interfaces:**
- Consumes: the shipped `.part-label` DOM (Tasks 1–3).

- [ ] **Step 1: Extend the parts check**

In `scripts/live-check.mjs`, replace

```js
      const parts = await page.locator('.inspector .part').count()
      const entries = await page.locator('.inspector .morpheme').count()
      if (parts < 2 || parts !== entries) throw new Error(`parts=${parts} entries=${entries}`)
      await page.keyboard.press('Escape')
      ok(`parts: segmented heading with ${parts} parts matching ${entries} entries`)
```

with

```js
      const parts = await page.locator('.inspector .part').count()
      const entries = await page.locator('.inspector .morpheme').count()
      const labels = await page.locator('.inspector .part-label').count()
      if (parts < 2 || parts !== entries || labels !== parts)
        throw new Error(`parts=${parts} entries=${entries} labels=${labels}`)
      await page.keyboard.press('Escape')
      ok(`parts: segmented heading with ${parts} labeled parts matching ${entries} entries`)
```

- [ ] **Step 2: Verify against a local preview**

```bash
npm run build -- --base=/ayaki/
npx vite preview --base=/ayaki/ --port 4186 &
node scripts/live-check.mjs http://localhost:4186/ayaki/
kill %1
```

Expected: 12 × `ok`, including `ok parts: segmented heading with 2 labeled parts matching 2 entries`.

- [ ] **Step 3: Screenshots**

```bash
npm run shots
git status --short docs/images
```

Expected: all three PNGs modified.

- [ ] **Step 4: Commit**

```bash
git add scripts/live-check.mjs docs/images
git commit -m "feat: live-check asserts part labels; refreshed README screenshots"
```

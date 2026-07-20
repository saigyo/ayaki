# Bunsetsu Parts Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the selected bunsetsu as role-colored segment pills linked bidirectionally to the morpheme entries, with a quiet-color mode, a help legend, and a clear card-level share-row separator.

**Architecture:** Pure role mapping (`partroles.ts`) → presentational `SegmentedSurface.svelte` (interactive in Inspector, static in help) → `quietParts` setting → Inspector hover-state integration → help section + live-check + screenshots.

**Tech Stack:** Svelte 5, TypeScript, vitest/jsdom, Playwright (scripts).

**Spec:** `docs/superpowers/specs/2026-07-20-bunsetsu-parts-design.md`

## Global Constraints

- Role palette VERBATIM: head `#3b82f6`, aux `#d97706`, particle `#059669`, affix `#8b5cf6`, symbol `#64748b`. 接頭詞 and POS containing 接尾 are affix, never head.
- Catalog values VERBATIM from this plan (typographic characters: ja fullwidth （）・。、〜, zh —— and fullwidth ，, de umlauts); new keys inserted at the exact positions named per task, identically in all four catalogs.
- The help dialog is ALWAYS mounted: any test or script query for `.part`/`.morpheme` outside a dialog-scoped context must scope to `main`, `.inspector`, or the render container.
- `HELP_SENTENCE`, share-link schema, diagrams, sentence card, speech, and chain palette are unchanged.
- Conventional Commits; the git hook adds the Co-Authored-By trailer — do not add it manually.
- All commands run from `/Users/markus/IdeaProjects/ayaki`.

## Branch setup (controller, before Task 1)

Branch `feat/bunsetsu-parts` from main; first commit: the spec and this plan —
`docs: bunsetsu-parts spec and plan`.

---

### Task 1: Role mapping + role-label catalog keys

**Files:**
- Create: `src/lib/partroles.ts`
- Modify: `src/lib/locales/{en,de,ja,zh}.ts` (5 keys each)
- Test: `tests/lib/partroles.test.ts`

**Interfaces:**
- Consumes: nothing app-specific (pure module + catalogs).
- Produces (later tasks rely on these exact names): `type PartRole`, `PART_PALETTE: Record<PartRole, string>`, `PART_ROLES: PartRole[]` (legend order), `PART_LABEL_KEYS: Record<PartRole, catalog key>`, `morphemeRole(posJa: string): PartRole`.

- [ ] **Step 1: Failing test**

Create `tests/lib/partroles.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { morphemeRole, PART_PALETTE, PART_ROLES } from '../../src/lib/partroles'

describe('morphemeRole', () => {
  it.each([
    ['動詞・自立', 'head'],
    ['名詞・一般', 'head'],
    ['名詞・代名詞', 'head'],
    ['形容詞・自立', 'head'],
    ['副詞・一般', 'head'],
    ['助動詞', 'aux'],
    ['助詞・終助詞', 'particle'],
    ['助詞・格助詞', 'particle'],
    ['記号・句点', 'symbol'],
    ['記号・読点', 'symbol'],
    ['接頭詞・名詞接続', 'affix'],
    ['名詞・接尾', 'affix'],
    ['動詞・接尾', 'affix'],
  ])('%s → %s', (posJa, role) => {
    expect(morphemeRole(posJa)).toBe(role)
  })
})

describe('palette', () => {
  it('covers every role, in legend order', () => {
    expect(PART_ROLES).toEqual(['head', 'aux', 'particle', 'affix', 'symbol'])
    for (const r of PART_ROLES) expect(PART_PALETTE[r]).toMatch(/^#[0-9a-f]{6}$/)
  })
})
```

Run: `npx vitest run tests/lib/partroles.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 2: Module**

Create `src/lib/partroles.ts`:

```ts
export type PartRole = 'head' | 'aux' | 'particle' | 'affix' | 'symbol'

/** legend/display order */
export const PART_ROLES: PartRole[] = ['head', 'aux', 'particle', 'affix', 'symbol']

export const PART_PALETTE: Record<PartRole, string> = {
  head: '#3b82f6',
  aux: '#d97706',
  particle: '#059669',
  affix: '#8b5cf6',
  symbol: '#64748b',
}

/** i18n catalog key holding the localized label of each role */
export const PART_LABEL_KEYS = {
  head: 'partHead',
  aux: 'partAux',
  particle: 'partParticle',
  affix: 'partAffix',
  symbol: 'partSymbol',
} as const

/**
 * Structural role of a morpheme within its bunsetsu, from the combined
 * IPAdic POS (`pos・detail1`). Head is the default: any content word that
 * is not an auxiliary, particle, symbol, or affix. 接尾 appears as a
 * detail on several POS classes (名詞・接尾, 動詞・接尾, …), hence the
 * substring check.
 */
export function morphemeRole(posJa: string): PartRole {
  if (posJa.startsWith('助動詞')) return 'aux'
  if (posJa.startsWith('助詞')) return 'particle'
  if (posJa.startsWith('記号')) return 'symbol'
  if (posJa.startsWith('接頭詞') || posJa.includes('接尾')) return 'affix'
  return 'head'
}
```

- [ ] **Step 3: Catalog keys**

Insert directly after the `confForcedOnly` line in each catalog:

`src/lib/locales/en.ts`:
```ts
  partHead: 'head (content word)',
  partAux: 'auxiliary',
  partParticle: 'particle',
  partAffix: 'prefix/suffix',
  partSymbol: 'punctuation',
```
`src/lib/locales/de.ts`:
```ts
  partHead: 'Kopf (Inhaltswort)',
  partAux: 'Hilfsverb',
  partParticle: 'Partikel',
  partAffix: 'Präfix/Suffix',
  partSymbol: 'Interpunktion',
```
`src/lib/locales/ja.ts`:
```ts
  partHead: '主辞（内容語）',
  partAux: '助動詞',
  partParticle: '助詞',
  partAffix: '接頭辞・接尾辞',
  partSymbol: '記号',
```
`src/lib/locales/zh.ts`:
```ts
  partHead: '中心语（实词）',
  partAux: '助动词',
  partParticle: '助词',
  partAffix: '前缀/后缀',
  partSymbol: '标点',
```

- [ ] **Step 4: Gates**

Run: `npx vitest run tests/lib/partroles.test.ts`, then `npm test && npm run check`
Expected: PASS, 0 errors 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add src/lib/partroles.ts src/lib/locales tests/lib/partroles.test.ts
git commit -m "feat: structural part roles with palette and labels"
```

---

### Task 2: SegmentedSurface component

**Files:**
- Create: `src/components/SegmentedSurface.svelte`
- Modify: `src/app.css`
- Test: `tests/components/SegmentedSurface.test.ts`

**Interfaces:**
- Consumes: Task 1's `morphemeRole`, `PART_PALETTE`, `PART_LABEL_KEYS`; `t()`; `MorphemeVM`.
- Produces: `SegmentedSurface` with props `morphemes: MorphemeVM[]`, `quiet?: boolean` (default false), `active?: number | null` (default null), `onhover?: (index: number | null) => void` (default no-op). Tasks 4–5 rely on exactly these prop names.

- [ ] **Step 1: Failing test**

Create `tests/components/SegmentedSurface.test.ts`:

```ts
// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import SegmentedSurface from '../../src/components/SegmentedSurface.svelte'
import { morphemeFixture } from '../fixtures'

const morphemes = [
  morphemeFixture({ surface: '行き', posJa: '動詞・自立' }),
  morphemeFixture({ surface: 'ましょ', posJa: '助動詞' }),
  morphemeFixture({ surface: 'う', posJa: '助動詞' }),
  morphemeFixture({ surface: 'ね', posJa: '助詞・終助詞' }),
  morphemeFixture({ surface: '。', posJa: '記号・句点' }),
]

describe('SegmentedSurface', () => {
  it('renders one colored part per morpheme with role, color, and tooltip', () => {
    const { container } = render(SegmentedSurface, { props: { morphemes } })
    const parts = container.querySelectorAll('.part')
    expect(parts).toHaveLength(5)
    expect(parts[0].textContent).toBe('行き')
    expect(parts[0].getAttribute('data-role')).toBe('head')
    expect(parts[1].getAttribute('data-role')).toBe('aux')
    expect(parts[3].getAttribute('data-role')).toBe('particle')
    expect(parts[4].getAttribute('data-role')).toBe('symbol')
    expect(parts[0].getAttribute('style')).toContain('#3b82f6')
    expect(parts[0].getAttribute('title')).toBe('head (content word)')
    expect(parts[0]).not.toHaveClass('quiet')
  })
  it('applies quiet and active classes', () => {
    const { container } = render(SegmentedSurface, { props: { morphemes, quiet: true, active: 1 } })
    const parts = container.querySelectorAll('.part')
    expect(parts[0]).toHaveClass('quiet')
    expect(parts[1]).toHaveClass('active')
    expect(parts[0]).not.toHaveClass('active')
  })
  it('reports hover enter and leave', async () => {
    const onhover = vi.fn()
    const { container } = render(SegmentedSurface, { props: { morphemes, onhover } })
    await fireEvent.mouseEnter(container.querySelectorAll('.part')[2])
    expect(onhover).toHaveBeenLastCalledWith(2)
    await fireEvent.mouseLeave(container.querySelector('.parts')!)
    expect(onhover).toHaveBeenLastCalledWith(null)
  })
})
```

Run: `npx vitest run tests/components/SegmentedSurface.test.ts`
Expected: FAIL (component missing).

- [ ] **Step 2: Component**

Create `src/components/SegmentedSurface.svelte`:

```svelte
<script lang="ts">
  import { morphemeRole, PART_LABEL_KEYS, PART_PALETTE } from '../lib/partroles'
  import { t } from '../lib/i18n.svelte'
  import type { MorphemeVM } from '../lib/types'

  let {
    morphemes,
    quiet = false,
    active = null,
    onhover = () => {},
  }: {
    morphemes: MorphemeVM[]
    quiet?: boolean
    active?: number | null
    onhover?: (index: number | null) => void
  } = $props()
</script>

<span class="parts" lang="ja" onmouseleave={() => onhover(null)}>
  {#each morphemes as m, i}
    {@const role = morphemeRole(m.posJa)}
    <span
      class="part"
      class:quiet
      class:active={active === i}
      data-role={role}
      style="--part: {PART_PALETTE[role]}"
      title={t(PART_LABEL_KEYS[role])}
      onmouseenter={() => onhover(i)}
    >{m.surface}</span>
  {/each}
</span>
```

- [ ] **Step 3: CSS**

In `src/app.css`, directly after the `.inspector .confidence.uncertain` rule, add:

```css
.parts { display: inline; }
.part { background: color-mix(in srgb, var(--part) 16%, transparent); border-radius: 7px; padding: 0.05em 0.12em; margin-right: 3px; transition: background 0.12s; }
.part:last-child { margin-right: 0; }
.part.active { background: color-mix(in srgb, var(--part) 34%, transparent); }
.part.quiet { background: color-mix(in srgb, currentColor 7%, transparent); }
.part.quiet.active { background: color-mix(in srgb, var(--part) 30%, transparent); }
```

- [ ] **Step 4: Gates**

Run: `npx vitest run tests/components/SegmentedSurface.test.ts`, then `npm test && npm run check`
Expected: PASS, 0 errors 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add src/components/SegmentedSurface.svelte src/app.css tests/components/SegmentedSurface.test.ts
git commit -m "feat: SegmentedSurface part pills with roles and hover reporting"
```

---

### Task 3: quietParts setting

**Files:**
- Modify: `src/lib/settings.ts`, `src/components/SettingsMenu.svelte`, `src/components/App.svelte`, `src/lib/locales/{en,de,ja,zh}.ts` (1 key each)
- Test: `tests/lib/settings.test.ts`, `tests/components/SettingsMenu.test.ts`, `tests/components/App.test.ts`

**Interfaces:**
- Consumes: existing settings validator pattern.
- Produces: `Settings.quietParts: boolean` (default false); App state `quietParts` saved by the settings effect and bound into SettingsMenu. Task 4 passes the same App state to Inspector.

- [ ] **Step 1: Failing tests**

`tests/lib/settings.test.ts`: extend the round-trip object with `quietParts: true` (append inside the literal, after `confidenceThreshold: 0.85`), and after the `rejects non-numeric confidenceThreshold values` test add:

```ts
  it('rejects non-boolean quietParts values', () => {
    localStorage.setItem(KEY, JSON.stringify({ quietParts: 'yes' }))
    expect(loadSettings().quietParts).toBe(false)
  })
```

`tests/components/SettingsMenu.test.ts`: after the `disables the threshold slider while confidence display is off` test add:

```ts
  it('renders the quiet-parts checkbox unchecked by default', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([kyoko]))
    const user = userEvent.setup()
    render(SettingsMenu, { props: { ...base } })
    await user.click(screen.getByRole('button', { name: 'settings' }))
    expect(screen.getByRole('checkbox', { name: 'quiet part colors' })).not.toBeChecked()
  })
```

`tests/components/App.test.ts`: add `quietParts: false,` to the persisted-object literal in `restores settings from localStorage and persists changes` (after `confidenceThreshold: 0.7,`).

Run: `npx vitest run tests/lib/settings.test.ts tests/components/SettingsMenu.test.ts tests/components/App.test.ts`
Expected: FAIL.

- [ ] **Step 2: settings.ts**

Interface: add `quietParts: boolean` directly after `confidenceThreshold: number`. `DEFAULTS` (one line) gains `quietParts: false,` directly after `confidenceThreshold: 0.7,`. Validators: directly after the `confidenceThreshold` entry add:

```ts
  quietParts: (v) => (typeof v === 'boolean' ? v : undefined),
```

- [ ] **Step 3: Catalog key**

Insert directly after the `confidenceThresholdLabel` line in each catalog:

`en.ts`: `  quietPartsToggle: 'quiet part colors',`
`de.ts`: `  quietPartsToggle: 'Dezente Teilfarben',`
`ja.ts`: `  quietPartsToggle: '部分の色を控えめに',`
`zh.ts`: `  quietPartsToggle: '低调的组成部分配色',`

- [ ] **Step 4: SettingsMenu + App**

`SettingsMenu.svelte`: add prop `quietParts = $bindable(false),` after `confidenceThreshold = $bindable(0.7),` and `quietParts?: boolean` after `confidenceThreshold?: number` in the type block. Insert directly after the chain `</fieldset>`:

```svelte
      <div class="row check-row">
        <label class="row-label" for="quiet-{uid}">{t('quietPartsToggle')}</label>
        <input id="quiet-{uid}" type="checkbox" bind:checked={quietParts} />
      </div>
```

`App.svelte`: after `let confidenceThreshold = $state(initialSettings.confidenceThreshold)` add:

```ts
  let quietParts = $state(initialSettings.quietParts)
```

Save effect gains the field (keep one line):

```ts
    saveSettings({ showFurigana, showConfidence, confidenceThreshold, quietParts, view: viewFromLink ? storedView : view, rate, voiceURI, locale, chainColor })
```

SettingsMenu line becomes:

```svelte
    <SettingsMenu bind:rate bind:voiceURI bind:showConfidence bind:confidenceThreshold bind:quietParts bind:chainColor />
```

- [ ] **Step 5: Gates**

Run: `npx vitest run tests/lib/settings.test.ts tests/components/SettingsMenu.test.ts tests/components/App.test.ts`, then `npm test && npm run check`
Expected: PASS, 0 errors 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add src/lib/settings.ts src/components/SettingsMenu.svelte src/components/App.svelte src/lib/locales tests/lib/settings.test.ts tests/components/SettingsMenu.test.ts tests/components/App.test.ts
git commit -m "feat: quietParts setting with settings-menu checkbox"
```

---

### Task 4: Inspector integration

**Files:**
- Modify: `src/components/Inspector.svelte`, `src/components/App.svelte`, `src/app.css`
- Test: `tests/components/Inspector.test.ts`

**Interfaces:**
- Consumes: `SegmentedSurface` (Task 2 props), `PART_PALETTE`/`morphemeRole` (Task 1), App's `quietParts` state (Task 3).
- Produces: Inspector prop `quietParts?: boolean` (default false).

- [ ] **Step 1: Failing tests**

In `tests/components/Inspector.test.ts` add a describe block (mirror the file's existing render conventions; `sentenceFixture` is already imported there):

```ts
describe('segmented parts', () => {
  it('links segments to entries bidirectionally and scrolls on segment hover', async () => {
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    const s = sentenceFixture()
    const { container } = render(Inspector, { props: { sentence: s, index: 0, total: 1, selected: s.bunsetsu[2], rate: 1, voiceURI: null } })
    const parts = container.querySelectorAll('.part')
    const entries = container.querySelectorAll('.morpheme')
    expect(parts.length).toBe(entries.length)
    await fireEvent.mouseEnter(parts[1])
    expect(entries[1]).toHaveClass('active')
    expect(parts[1]).toHaveClass('active')
    expect(scrollSpy).toHaveBeenCalled()
    await fireEvent.mouseEnter(entries[0])
    expect(parts[0]).toHaveClass('active')
    expect(entries[1]).not.toHaveClass('active')
    await fireEvent.mouseLeave(entries[0])
    expect(parts[0]).not.toHaveClass('active')
  })
  it('renders quiet parts and entries when quietParts is on', () => {
    const s = sentenceFixture()
    const { container } = render(Inspector, { props: { sentence: s, index: 0, total: 1, selected: s.bunsetsu[0], rate: 1, voiceURI: null, quietParts: true } })
    expect(container.querySelector('.part')).toHaveClass('quiet')
    expect(container.querySelector('.morpheme')).toHaveClass('quiet')
  })
})
```

(`s.bunsetsu[2]` is 食べた。 — two morphemes, one head + one symbol.) If `fireEvent` or `vi` are not yet imported in the file, extend the existing import lines.

Run: `npx vitest run tests/components/Inspector.test.ts`
Expected: the new tests FAIL (no `.part` elements).

- [ ] **Step 2: Inspector script**

Extend imports:

```ts
  import SegmentedSurface from './SegmentedSurface.svelte'
  import { morphemeRole, PART_PALETTE } from '../lib/partroles'
```

Props: add `quietParts = false,` after `confidenceThreshold = LOW_CONFIDENCE,` and `quietParts?: boolean` after `confidenceThreshold?: number`.

After the `speakGen` declaration block (before `toggleSpeech`), add:

```ts
  let hoverPart = $state<number | null>(null)
  let entryEls: HTMLElement[] = []

  // switching bunsetsu must not carry a stale highlight over
  $effect(() => {
    void selected
    hoverPart = null
  })

  function hoverSegment(i: number | null) {
    hoverPart = i
    if (i !== null) entryEls[i]?.scrollIntoView({ block: 'nearest' })
  }
```

- [ ] **Step 3: Inspector markup**

Replace the heading's `{selected.surface}` line:

```svelte
      <SegmentedSurface morphemes={selected.morphemes} quiet={quietParts} active={hoverPart} onhover={hoverSegment} />
```

(the `<h2 lang="ja">` wrapper and the speak button stay unchanged).

Replace the entries' `{#each selected.morphemes as m}` opening and the `<div class="morpheme">` line:

```svelte
    {#each selected.morphemes as m, mi}
      {@const pg = posGloss(m.posJa, currentLocale())}
      <div
        class="morpheme"
        class:active={hoverPart === mi}
        class:quiet={quietParts}
        style="--part: {PART_PALETTE[morphemeRole(m.posJa)]}"
        bind:this={entryEls[mi]}
        onmouseenter={() => (hoverPart = mi)}
        onmouseleave={() => (hoverPart = null)}
      >
```

(the entry's inner content and closing tag are unchanged).

- [ ] **Step 4: App + CSS**

`App.svelte`: add `{quietParts}` to the `<Inspector ...>` props (after `{confidenceThreshold}`).

`src/app.css`: replace

```css
.morpheme { border-top: 1px solid #eaeef2; padding: 0.5rem 0; font-size: 0.92rem; }
```

with

```css
.morpheme { border-top: 1px solid #eaeef2; padding: 0.5rem 0 0.5rem 0.45rem; font-size: 0.92rem; border-left: 3px solid var(--part, transparent); transition: background 0.12s, border-color 0.12s; }
.morpheme.quiet { border-left-color: color-mix(in srgb, currentColor 15%, transparent); }
.morpheme.active, .morpheme:focus-within { background: color-mix(in srgb, var(--part) 10%, transparent); }
.morpheme.quiet.active, .morpheme.quiet:focus-within { border-left-color: var(--part); }
```

and replace

```css
.actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
```

with

```css
.actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; border-top: 1px solid #eaeef2; margin-top: 0.75rem; padding-top: 0.75rem; }
```

- [ ] **Step 5: Gates**

Run: `npx vitest run tests/components/Inspector.test.ts`, then `npm test && npm run check`
Expected: PASS, 0 errors 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add src/components/Inspector.svelte src/components/App.svelte src/app.css tests/components/Inspector.test.ts
git commit -m "feat: segmented bunsetsu heading with linked entries and share-row separator"
```

---

### Task 5: Help section

**Files:**
- Modify: `src/lib/helpexample.ts`, `src/components/HelpDialog.svelte`, `src/app.css`, `src/lib/locales/{en,de,ja,zh}.ts` (2 keys each)
- Test: `tests/components/HelpDialog.test.ts`

**Interfaces:**
- Consumes: `SegmentedSurface` (static usage), `PART_ROLES`/`PART_PALETTE`/`PART_LABEL_KEYS` (Task 1).
- Produces: `HELP_PARTS: MorphemeVM[]` in `helpexample.ts`.

- [ ] **Step 1: Failing test**

In `tests/components/HelpDialog.test.ts`, the test `renders the trigger and opens a dialog with all six sections` becomes `…all seven sections`: add `'The parts of a bunsetsu'` to its expected headings list, and after the headings assertion add:

```ts
    expect(within(dialog).getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('auxiliary')]),
    )
    expect(dialog.querySelectorAll('.parts-example .part')).toHaveLength(5)
```

Run: `npx vitest run tests/components/HelpDialog.test.ts`
Expected: FAIL.

- [ ] **Step 2: Fixture**

In `src/lib/helpexample.ts`: change the type import to `import type { BunsetsuVM, MorphemeVM } from './types'` and append:

```ts
/** canned word for the help dialog's parts example — 行きましょうね。 */
export const HELP_PARTS: MorphemeVM[] = [
  { surface: '行き', reading: 'いき', posJa: '動詞・自立', baseForm: '行く', conjugationJa: '連用形', jishoUrl: null },
  { surface: 'ましょ', reading: 'ましょ', posJa: '助動詞', baseForm: 'ます', conjugationJa: '未然ウ接続', jishoUrl: null },
  { surface: 'う', reading: 'う', posJa: '助動詞', baseForm: null, conjugationJa: '基本形', jishoUrl: null },
  { surface: 'ね', reading: 'ね', posJa: '助詞・終助詞', baseForm: null, conjugationJa: null, jishoUrl: null },
  { surface: '。', reading: null, posJa: '記号・句点', baseForm: null, conjugationJa: null, jishoUrl: null },
]
```

- [ ] **Step 3: Catalog keys**

Insert directly after the `helpTermBody` entry (the full multi-line value) in each catalog:

`en.ts`:
```ts
  helpPartsTitle: 'The parts of a bunsetsu',
  helpPartsIntro:
    'When a bunsetsu is selected, its surface is shown split into its parts, colored by role — hover a part to highlight its entry below. A quieter style is available in the settings.',
```
`de.ts`:
```ts
  helpPartsTitle: 'Die Teile eines Bunsetsu',
  helpPartsIntro:
    'Bei einem ausgewählten Bunsetsu wird die Oberfläche in ihre Teile zerlegt angezeigt, nach Rolle eingefärbt — beim Überfahren eines Teils wird der zugehörige Eintrag darunter hervorgehoben. Eine dezentere Darstellung lässt sich in den Einstellungen wählen.',
```
`ja.ts`:
```ts
  helpPartsTitle: '文節の内部構造',
  helpPartsIntro:
    '文節を選択すると、その表層が部分ごとに分割され、役割別の色で表示されます。部分にカーソルを合わせると、下の対応する項目が強調されます。控えめな配色は設定で選べます。',
```
`zh.ts`:
```ts
  helpPartsTitle: '文节的组成部分',
  helpPartsIntro:
    '选中文节后，其表层会按组成部分拆分，并按角色着色——将鼠标悬停在某一部分上，可高亮下方对应的条目。可在设置中改用低调配色。',
```

- [ ] **Step 4: HelpDialog markup + CSS**

Extend HelpDialog's imports:

```ts
  import SegmentedSurface from './SegmentedSurface.svelte'
  import { HELP_PARTS } from '../lib/helpexample'
  import { PART_LABEL_KEYS, PART_PALETTE, PART_ROLES } from '../lib/partroles'
```

(`HELP_SENTENCE` is already imported from helpexample — merge into one import line.)

Insert a new section directly after the `helpTermTitle`/`helpTermBody` section's `</section>`:

```svelte
    <section>
      <h3>{t('helpPartsTitle')}</h3>
      <p>{t('helpPartsIntro')}</p>
      <p class="parts-example"><SegmentedSurface morphemes={HELP_PARTS} /></p>
      <ul class="help-legend">
        {#each PART_ROLES as r (r)}
          <li><span class="legend-swatch" style="background: color-mix(in srgb, {PART_PALETTE[r]} 30%, transparent); border-color: {PART_PALETTE[r]}" aria-hidden="true"></span>{t(PART_LABEL_KEYS[r])}</li>
        {/each}
      </ul>
    </section>
```

`src/app.css`, after the `.part.quiet.active` rule:

```css
.parts-example { font-size: 1.5rem; font-weight: 600; margin: 0.4rem 0; }
```

- [ ] **Step 5: Gates**

Run: `npx vitest run tests/components/HelpDialog.test.ts`, then `npm test && npm run check`
Expected: PASS, 0 errors 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add src/lib/helpexample.ts src/components/HelpDialog.svelte src/app.css src/lib/locales tests/components/HelpDialog.test.ts
git commit -m "feat: help section explaining bunsetsu parts with legend"
```

---

### Task 6: live-check + README screenshots

**Files:**
- Modify: `scripts/live-check.mjs`, `docs/images/screenshot{,-tree,-cabocha}.png` (regenerated)

**Interfaces:**
- Consumes: the shipped Inspector behavior (Tasks 1–5).
- Produces: live-check with 12 checks.

- [ ] **Step 1: New check**

In `scripts/live-check.mjs`, insert directly after the help check's closing `}` (after `fail('help', String(e))` block) and before the share check:

```js
    try {
      await page.locator('main g.bunsetsu').first().click()
      await page.waitForSelector('.inspector .part', { timeout: 5_000 })
      const parts = await page.locator('.inspector .part').count()
      const entries = await page.locator('.inspector .morpheme').count()
      if (parts < 2 || parts !== entries) throw new Error(`parts=${parts} entries=${entries}`)
      await page.keyboard.press('Escape')
      ok(`parts: segmented heading with ${parts} parts matching ${entries} entries`)
    } catch (e) {
      fail('parts', String(e))
    }
```

(`.inspector` scoping keeps the always-mounted help-dialog example out of the counts.)

- [ ] **Step 2: Verify against a local preview**

```bash
npm run build -- --base=/ayaki/
npx vite preview --base=/ayaki/ --port 4186 &
node scripts/live-check.mjs http://localhost:4186/ayaki/
kill %1
```

Expected: 12 × `ok`, including `ok parts: …` (the boot/parse counts run against the local build; all must pass).

- [ ] **Step 3: Screenshots**

```bash
npm run shots
git status --short docs/images
```

Expected: all three PNGs modified (`screenshot-tree.png` shows the new segmented inspector; the set is always regenerated together).

- [ ] **Step 4: Commit**

```bash
git add scripts/live-check.mjs docs/images
git commit -m "feat: live-check parts probe and refreshed README screenshots"
```

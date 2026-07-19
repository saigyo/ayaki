# Configurable Confidence Threshold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the uncertainty cutoff (currently hardcoded 0.7) a settings-menu slider bounded to 60–90%.

**Architecture:** New validated `confidenceThreshold` setting → `isUncertain(b, threshold)` → prop threaded from App through SentenceCard/the three views and Inspector → slider row in SettingsMenu. Background doc + README pointer land in the branch-setup commit.

**Tech Stack:** Svelte 5, TypeScript, vitest/jsdom.

**Spec:** `docs/superpowers/specs/2026-07-20-confidence-threshold-design.md`

## Global Constraints

- Threshold bounds are `CONFIDENCE_MIN = 0.6` / `CONFIDENCE_MAX = 0.9`, exported from `src/lib/settings.ts` — the single source of truth for validator AND slider. Default 0.7. Clamp, never snap.
- Catalog values VERBATIM from this plan (watch typographic quotes „“ in de, 〜 in ja, —— in zh); `confidenceThresholdLabel` inserted directly after `confidenceToggle` in each of the four catalogs.
- `HelpDialog.svelte`, `helpexample.ts`, `share.ts`, `confidenceLabel`, live-check/Playwright scripts, screenshots, and CSS are unchanged.
- Conventional Commits; the git hook adds the Co-Authored-By trailer — do not add it manually.
- All commands run from `/Users/markus/IdeaProjects/ayaki`.

## Branch setup (controller, before Task 1)

Branch `feat/confidence-threshold` from main. First commit (docs only, already reviewed by Markus): the spec, this plan, `docs/attachment-confidence.md`, and the README pointer — replace README line

```markdown
*Design documents live in [`docs/superpowers/specs/`](docs/superpowers/specs/).*
```

with

```markdown
*Design documents live in [`docs/superpowers/specs/`](docs/superpowers/specs/).
Background on the confidence display: [`docs/attachment-confidence.md`](docs/attachment-confidence.md).*
```

Commit: `docs: confidence-threshold spec/plan and calibration background`

---

### Task 1: Setting + threshold-aware isUncertain

**Files:**
- Modify: `src/lib/settings.ts`, `src/lib/viewmodel.ts`
- Test: `tests/lib/settings.test.ts`, `tests/lib/viewmodel.test.ts`

**Interfaces:**
- Consumes: existing `Settings`/validator pattern, `LOW_CONFIDENCE`.
- Produces: `Settings.confidenceThreshold: number`, exported `CONFIDENCE_MIN`/`CONFIDENCE_MAX`, and `isUncertain(b: BunsetsuVM, threshold?: number)` (default `LOW_CONFIDENCE`) — Tasks 2–3 rely on these exact names.

- [ ] **Step 1: Failing tests**

In `tests/lib/settings.test.ts`: the round-trip test constructs a full `Settings` object — add the new field:

```ts
    const s = { showFurigana: true, showConfidence: true, view: 'tree' as const, rate: 1.3, voiceURI: 'kyoko', locale: 'de' as const, chainColor: 'violet' as const, confidenceThreshold: 0.85 }
```

After the `rejects non-numeric and non-finite rate values` test, add:

```ts
  it('clamps confidenceThreshold to the slider range', () => {
    localStorage.setItem(KEY, JSON.stringify({ confidenceThreshold: 0.2 }))
    expect(loadSettings().confidenceThreshold).toBe(0.6)
    localStorage.setItem(KEY, JSON.stringify({ confidenceThreshold: 0.99 }))
    expect(loadSettings().confidenceThreshold).toBe(0.9)
  })
  it('rejects non-numeric confidenceThreshold values', () => {
    localStorage.setItem(KEY, JSON.stringify({ confidenceThreshold: '0.8' }))
    expect(loadSettings().confidenceThreshold).toBe(0.7)
    localStorage.setItem(KEY, '{"confidenceThreshold": null}')
    expect(loadSettings().confidenceThreshold).toBe(0.7)
  })
```

In `tests/lib/viewmodel.test.ts`, inside the existing `describe('isUncertain', ...)` after the existing `it` block, add:

```ts
  it('applies an explicit threshold', () => {
    expect(isUncertain({ ...base, probability: 0.75, forced: false }, 0.8)).toBe(true)
    expect(isUncertain({ ...base, probability: 0.75, forced: false }, 0.7)).toBe(false)
    expect(isUncertain({ ...base, probability: null, forced: true }, 0.9)).toBe(true)
    expect(isUncertain({ ...base, probability: null, forced: false }, 0.9)).toBe(false)
  })
```

Run: `npx vitest run tests/lib/settings.test.ts tests/lib/viewmodel.test.ts`
Expected: FAIL (missing field / unchanged default behavior).

- [ ] **Step 2: settings.ts**

Add to the `Settings` interface, directly after `showConfidence: boolean`:

```ts
  confidenceThreshold: number
```

Extend `DEFAULTS` (keep one line):

```ts
export const DEFAULTS: Settings = { showFurigana: false, showConfidence: false, confidenceThreshold: 0.7, view: 'arcs', rate: 1, voiceURI: null, locale: null, chainColor: 'amber' }
```

Below `RATE_MAX`, add (exported — the settings menu's slider uses them too):

```ts
export const CONFIDENCE_MIN = 0.6
export const CONFIDENCE_MAX = 0.9
```

Add to `validators`, directly after the `showConfidence` entry:

```ts
  confidenceThreshold: (v) =>
    typeof v === 'number' && Number.isFinite(v)
      ? Math.min(CONFIDENCE_MAX, Math.max(CONFIDENCE_MIN, v))
      : undefined,
```

- [ ] **Step 3: viewmodel.ts**

Replace `isUncertain`:

```ts
export function isUncertain(b: BunsetsuVM, threshold: number = LOW_CONFIDENCE): boolean {
  return b.probability !== null ? b.probability < threshold : b.forced
}
```

- [ ] **Step 4: Gates**

Run: `npx vitest run tests/lib/settings.test.ts tests/lib/viewmodel.test.ts`, then `npm test && npm run check`
Expected: PASS, 0 errors 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add src/lib/settings.ts src/lib/viewmodel.ts tests/lib/settings.test.ts tests/lib/viewmodel.test.ts
git commit -m "feat: confidenceThreshold setting and threshold-aware isUncertain"
```

---

### Task 2: Thread the threshold through views and inspector

**Files:**
- Modify: `src/components/ArcDiagram.svelte`, `src/components/NodeTree.svelte`, `src/components/StairView.svelte`, `src/components/SentenceCard.svelte`, `src/components/Inspector.svelte`, `src/components/App.svelte`
- Test: `tests/components/StairView.test.ts`, `tests/components/App.test.ts`

**Interfaces:**
- Consumes: `isUncertain(b, threshold)`, `LOW_CONFIDENCE` from `src/lib/viewmodel` (Task 1).
- Produces: optional prop `confidenceThreshold?: number` (default `LOW_CONFIDENCE`) on all five components; App state `confidenceThreshold` initialized from settings and saved in the settings effect. Task 3 binds the same App state into SettingsMenu.

- [ ] **Step 1: Failing test**

In `tests/components/StairView.test.ts`, after the `renders a confidently-forced attachment solid...` test, add:

```ts
  it('dashes connectors by the configurable threshold', () => {
    const s = sentenceFixture()
    s.bunsetsu[0].probability = 0.75
    const at7 = render(StairView, { props: { bunsetsu: s.bunsetsu, showConfidence: true, confidenceThreshold: 0.7, onselect: () => {} } })
    expect(at7.container.querySelectorAll('path.arc.low')).toHaveLength(1)
    const at8 = render(StairView, { props: { bunsetsu: s.bunsetsu, showConfidence: true, confidenceThreshold: 0.8, onselect: () => {} } })
    expect(at8.container.querySelectorAll('path.arc.low')).toHaveLength(2)
  })
```

(Fixture arcs: 猫が P=0.75 after the mutation, 魚を P=0.55 — one dash at threshold 0.7, two at 0.8.)

In `tests/components/App.test.ts`, the test `restores settings from localStorage and persists changes` asserts the exact persisted object — add the new field to the expected literal, after `showConfidence: false,`:

```ts
      confidenceThreshold: 0.7,
```

Run: `npx vitest run tests/components/StairView.test.ts tests/components/App.test.ts`
Expected: StairView FAIL (unknown prop is ignored; both renders show 1); the App persistence test FAILS until Step 5 adds the field to the save effect.

- [ ] **Step 2: The three views**

Identical edit in `ArcDiagram.svelte`, `NodeTree.svelte`, `StairView.svelte`. Extend the viewmodel import:

```ts
  import { confidenceLabel, isUncertain, LOW_CONFIDENCE } from '../lib/viewmodel'
```

Add to the props destructuring, after `showConfidence = false,`:

```ts
    confidenceThreshold = LOW_CONFIDENCE,
```

and to its type block, after `showConfidence?: boolean`:

```ts
    confidenceThreshold?: number
```

Call sites:
- `StairView.svelte` (in `classesFor`): `if (showConfidence && isUncertain(b, confidenceThreshold)) cls.push(b.forced ? 'forced' : 'low')`
- `ArcDiagram.svelte` (same pattern): `if (showConfidence && isUncertain(b, confidenceThreshold)) cls.push(b.forced ? 'forced' : 'low')`
- `NodeTree.svelte` (two class directives):

```svelte
          class:low={showConfidence && isUncertain(bunsetsu[e.to], confidenceThreshold) && !bunsetsu[e.to].forced}
          class:forced={showConfidence && isUncertain(bunsetsu[e.to], confidenceThreshold) && bunsetsu[e.to].forced}
```

- [ ] **Step 3: SentenceCard pass-through**

In `SentenceCard.svelte`: add `confidenceThreshold = LOW_CONFIDENCE,` after `showConfidence = false,` in the destructuring, `confidenceThreshold?: number` after `showConfidence?: boolean` in the type, and this import line after the settings import:

```ts
  import { LOW_CONFIDENCE } from '../lib/viewmodel'
```

Add `{confidenceThreshold}` to all three view instantiations:

```svelte
    <ArcDiagram bunsetsu={sentence.bunsetsu} {showFurigana} {selected} {onselect} {showConfidence} {confidenceThreshold} {chainColor} />
```

(same for `NodeTree` and `StairView`).

- [ ] **Step 4: Inspector**

In `Inspector.svelte`: extend the viewmodel import to include `LOW_CONFIDENCE`; add prop `confidenceThreshold = LOW_CONFIDENCE,` after `showConfidence = false,` and `confidenceThreshold?: number` after `showConfidence?: boolean`. Update both call sites:

```ts
  const uncertainCount = $derived(sentence ? sentence.bunsetsu.filter((b) => isUncertain(b, confidenceThreshold)).length : 0)
```

```svelte
      <p class="confidence" class:uncertain={isUncertain(selected, confidenceThreshold)}>
```

- [ ] **Step 5: App**

In `App.svelte`, after `let showConfidence = $state(initialSettings.showConfidence)`:

```ts
  let confidenceThreshold = $state(initialSettings.confidenceThreshold)
```

Save effect gains the field:

```ts
    saveSettings({ showFurigana, showConfidence, confidenceThreshold, view: viewFromLink ? storedView : view, rate, voiceURI, locale, chainColor })
```

Add `{confidenceThreshold}` to the `<SentenceCard ...>` props and to the `<Inspector ...>` line. (The `SettingsMenu` binding is Task 3.)

- [ ] **Step 6: Gates**

Run: `npx vitest run tests/components/StairView.test.ts tests/components/App.test.ts`, then `npm test && npm run check`
Expected: PASS, 0 errors 0 warnings.

- [ ] **Step 7: Commit**

```bash
git add src/components tests/components/StairView.test.ts tests/components/App.test.ts
git commit -m "feat: thread confidenceThreshold through views and inspector"
```

---

### Task 3: Settings-menu slider + locale copy

**Files:**
- Modify: `src/components/SettingsMenu.svelte`, `src/components/App.svelte`, `src/lib/locales/{en,de,ja,zh}.ts`
- Test: `tests/components/SettingsMenu.test.ts`

**Interfaces:**
- Consumes: `CONFIDENCE_MIN`/`CONFIDENCE_MAX` from `src/lib/settings` (Task 1); App's `confidenceThreshold` state (Task 2).
- Produces: bindable `confidenceThreshold` prop on SettingsMenu; catalog keys `confidenceThresholdLabel` (×4) and extended `helpConfidenceBody` (×4).

- [ ] **Step 1: Failing tests**

In `tests/components/SettingsMenu.test.ts`, after the `disables both controls...` test, add:

```ts
  it('renders the threshold slider bounded 60-90% and updates the readout', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([kyoko]))
    const user = userEvent.setup()
    render(SettingsMenu, { props: { ...base, showConfidence: true, confidenceThreshold: 0.7 } })
    await user.click(screen.getByRole('button', { name: 'settings' }))
    const slider = screen.getByRole('slider', { name: 'uncertainty cutoff' }) as HTMLInputElement
    expect(slider.min).toBe('0.6')
    expect(slider.max).toBe('0.9')
    expect(slider.step).toBe('0.05')
    expect(slider.disabled).toBe(false)
    expect(screen.getByText('70%')).toBeInTheDocument()
    await fireEvent.input(slider, { target: { value: '0.85' } })
    expect(screen.getByText('85%')).toBeInTheDocument()
  })
  it('disables the threshold slider while confidence display is off', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([kyoko]))
    const user = userEvent.setup()
    render(SettingsMenu, { props: { ...base, showConfidence: false } })
    await user.click(screen.getByRole('button', { name: 'settings' }))
    const slider = screen.getByRole('slider', { name: 'uncertainty cutoff' }) as HTMLInputElement
    expect(slider.disabled).toBe(true)
    expect(slider).toHaveAttribute('title', 'show attachment confidence')
  })
```

Run: `npx vitest run tests/components/SettingsMenu.test.ts`
Expected: FAIL (no such slider).

- [ ] **Step 2: Locale catalogs**

Insert directly after the `confidenceToggle` line in each catalog:

`src/lib/locales/en.ts`:
```ts
  confidenceThresholdLabel: 'uncertainty cutoff',
```
`src/lib/locales/de.ts`:
```ts
  confidenceThresholdLabel: 'Unsicherheitsschwelle',
```
`src/lib/locales/ja.ts`:
```ts
  confidenceThresholdLabel: '不確実とみなすしきい値',
```
`src/lib/locales/zh.ts`:
```ts
  confidenceThresholdLabel: '不确定阈值',
```

Replace each `helpConfidenceBody` value with (full strings, verbatim — only the final sentence is new):

`en.ts`:
```ts
  helpConfidenceBody:
    'The parse comes from a statistical model — it can be wrong. With "show attachment confidence" enabled, uncertain attachments are drawn dotted, and hovering a connector shows the model\'s probability, helping you stay critical of the analysis. The probability below which an attachment counts as uncertain can be adjusted in the settings (60–90%).',
```
`de.ts`:
```ts
  helpConfidenceBody:
    'Die Analyse stammt von einem statistischen Modell — sie kann falsch sein. Mit aktivierter Option „Zeige Anbindungskonfidenz“ werden unsichere Anbindungen gepunktet dargestellt, und beim Überfahren einer Verbindungslinie erscheint die Wahrscheinlichkeit des Modells — so bleiben Sie den Ergebnissen gegenüber kritisch. Die Wahrscheinlichkeitsschwelle, unterhalb derer eine Anbindung als unsicher gilt, lässt sich in den Einstellungen anpassen (60–90 %).',
```
`ja.ts`:
```ts
  helpConfidenceBody:
    '解析は統計モデルによるもので、誤ることがあります。「係り受けの信頼度を表示」を有効にすると、不確かな係り受けが点線で描かれ、線にカーソルを合わせるとモデルの確率が表示されます。結果を鵜呑みにしないための手がかりです。不確実とみなす確率のしきい値は設定で調整できます(60〜90%)。',
```
`zh.ts`:
```ts
  helpConfidenceBody:
    '句法分析来自统计模型,可能出错。启用「显示依存置信度」后,不确定的依存关系以虚线绘制,将鼠标悬停在连线上可查看模型给出的概率,帮助你对分析结果保持审慎。判定为不确定的概率阈值可在设置中调整(60–90%)。',
```

- [ ] **Step 3: SettingsMenu**

Extend the imports:

```ts
  import { CONFIDENCE_MAX, CONFIDENCE_MIN } from '../lib/settings'
```

Add to props: `confidenceThreshold = $bindable(0.7),` after `showConfidence = $bindable(false),`, and `confidenceThreshold?: number` after `showConfidence?: boolean` in the type block.

Insert directly after the `check-row` div (the confidence checkbox) and before the chain fieldset:

```svelte
      <div class="row">
        <label class="row-label" for="threshold-{uid}">{t('confidenceThresholdLabel')}</label>
        <span class="rate-row">
          <input
            id="threshold-{uid}"
            type="range"
            min={CONFIDENCE_MIN}
            max={CONFIDENCE_MAX}
            step="0.05"
            bind:value={confidenceThreshold}
            disabled={!showConfidence}
            title={!showConfidence ? t('confidenceToggle') : undefined}
          />
          <span>{Math.round(confidenceThreshold * 100)}%</span>
        </span>
      </div>
```

- [ ] **Step 4: App binding**

In `App.svelte`:

```svelte
    <SettingsMenu bind:rate bind:voiceURI bind:showConfidence bind:confidenceThreshold bind:chainColor />
```

- [ ] **Step 5: Gates**

Run: `npx vitest run tests/components/SettingsMenu.test.ts`, then `npm test && npm run check`
Expected: PASS, 0 errors 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add src/components/SettingsMenu.svelte src/components/App.svelte src/lib/locales tests/components/SettingsMenu.test.ts
git commit -m "feat: uncertainty-cutoff slider in the settings menu"
```

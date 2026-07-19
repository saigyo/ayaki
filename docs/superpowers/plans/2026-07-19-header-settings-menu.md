# Header Settings Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the rate slider and voice selector into a gear-button settings popup at the rightmost header position, swap the furigana checkbox to the right of the view buttons, and replace 🔊 with 🗣️.

**Architecture:** New self-contained `SettingsMenu.svelte` (gear button + dismissable popup card owning the voice/rate controls and the no-voice disabled state); `Toolbar.svelte` shrinks to views + furigana; `App.svelte` header becomes brand | toolbar | settings-menu (gear pushed right via `margin-left: auto`). Persistence unchanged.

**Tech Stack:** Svelte 5 (runes), TypeScript, vitest + @testing-library/svelte (jsdom).

**Spec:** `docs/superpowers/specs/2026-07-19-header-settings-menu-design.md`

## Global Constraints

- Accessible names unchanged: voice select `t('voiceLabel')` (en `voice`), rate slider `t('rateLabel')` (en `speech rate`) — now provided by visible `<label for>` elements, NOT aria-label. The readout `{rate.toFixed(1)}×` must NOT be part of the slider's label (it would make the accessible name unstable).
- Voice select semantics moved intact: auto option first, per-option `selected` attributes (never `bind:value`), stored-but-absent voice displays as auto without clearing the stored value, `''` → `null` on change.
- No-voice state: both controls ALWAYS rendered; `disabled` + `title={t('noVoice')}` + visible note `t('noVoice')` beneath when `voices.length === 0`; enable live on `voiceschanged`. The stored `voiceURI` is never cleared by this state.
- Popup dismissal: outside click closes; Escape closes, calls `stopPropagation()` (App's window-level Escape must NOT also fire), and refocuses the gear. Both document-level listeners exist only while open.
- One new catalog key `settingsLabel` in all four locales: en `settings`, de `Einstellungen`, ja `設定`, zh `设置`. No other catalog changes.
- `src/lib/settings.ts`, `src/lib/speech.ts`, `src/lib/i18n.svelte.ts` are NOT modified.
- Gear icon: the exact SVG from the reference (`fill="none" stroke="currentColor"`, gear path + `circle cx=12 cy=12 r=3`), 16×16, `aria-hidden="true"`.
- Conventional Commits; the local git hook adds the Co-Authored-By trailer — never add trailers manually.
- All commands run from the repo root `/Users/markus/IdeaProjects/ayaki`.

---

### Task 1: SettingsMenu component + catalogs

**Files:**
- Create: `src/components/SettingsMenu.svelte`
- Modify: `src/lib/locales/en.ts`, `de.ts`, `ja.ts`, `zh.ts` (one key each)
- Modify: `src/app.css` (append rules; touch nothing existing)
- Test: `tests/components/SettingsMenu.test.ts`

**Interfaces:**
- Consumes: `listJaVoices` from `src/lib/speech.ts`, `t` from `src/lib/i18n.svelte.ts` (existing).
- Produces: `SettingsMenu` with props `{ rate = $bindable(), voiceURI = $bindable(null) }: { rate: number; voiceURI?: string | null }`; root element `div.settings-menu`. Task 2 mounts it as `<SettingsMenu bind:rate bind:voiceURI />`.

- [ ] **Step 1: Add the catalog key**

In each of the four catalogs, directly after the `localeAuto` line, add:

- `src/lib/locales/en.ts`: `settingsLabel: 'settings',`
- `src/lib/locales/de.ts`: `settingsLabel: 'Einstellungen',`
- `src/lib/locales/ja.ts`: `settingsLabel: '設定',`
- `src/lib/locales/zh.ts`: `settingsLabel: '设置',`

(The `Record<keyof typeof en, string>` typing of de/ja/zh makes a missed file a compile error; the runtime parity test also covers it.)

- [ ] **Step 2: Write the failing tests**

Create `tests/components/SettingsMenu.test.ts`:

```ts
// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { tick } from 'svelte'
import SettingsMenu from '../../src/components/SettingsMenu.svelte'

const base = { rate: 1, voiceURI: null }
const kyoko = { lang: 'ja-JP', localService: true, name: 'Kyoko', voiceURI: 'kyoko' }

function fakeSynth(voices: Array<Partial<SpeechSynthesisVoice>>) {
  return {
    getVoices: () => voices as SpeechSynthesisVoice[],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('SettingsMenu', () => {
  it('renders a closed gear and opens the labeled popup on click', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([kyoko]))
    const user = userEvent.setup()
    render(SettingsMenu, { props: { ...base } })
    const gear = screen.getByRole('button', { name: 'settings' })
    expect(gear).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('combobox', { name: 'voice' })).toBeNull()
    await user.click(gear)
    expect(gear).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('combobox', { name: 'voice' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'speech rate' })).toBeInTheDocument()
    expect(screen.getByText('1.0×')).toBeInTheDocument()
  })

  it('keeps the voice select semantics: auto first, stored-absent displays auto', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([kyoko]))
    const user = userEvent.setup()
    render(SettingsMenu, { props: { ...base, voiceURI: 'gone-machine-uri' } })
    await user.click(screen.getByRole('button', { name: 'settings' }))
    const select = screen.getByRole('combobox', { name: 'voice' }) as HTMLSelectElement
    expect([...select.options].map((o) => o.textContent)).toEqual(['auto', 'Kyoko'])
    expect(select.value).toBe('')
  })

  it('disables both controls and shows the note when no Japanese voices exist', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([{ lang: 'en-US', localService: true, name: 'Samantha', voiceURI: 'sam' }]))
    const user = userEvent.setup()
    render(SettingsMenu, { props: { ...base } })
    await user.click(screen.getByRole('button', { name: 'settings' }))
    const select = screen.getByRole('combobox', { name: 'voice' })
    const slider = screen.getByRole('slider', { name: 'speech rate' })
    expect(select).toBeDisabled()
    expect(slider).toBeDisabled()
    expect(select).toHaveAttribute('title', expect.stringMatching(/no japanese voice/i))
    expect(slider).toHaveAttribute('title', expect.stringMatching(/no japanese voice/i))
    expect(screen.getByText(/no japanese voice/i)).toBeInTheDocument()
  })

  it('enables the controls live when voiceschanged delivers voices', async () => {
    let voices: Array<Partial<SpeechSynthesisVoice>> = []
    const synth = fakeSynth([])
    synth.getVoices = () => voices as SpeechSynthesisVoice[]
    vi.stubGlobal('speechSynthesis', synth)
    const user = userEvent.setup()
    render(SettingsMenu, { props: { ...base } })
    await user.click(screen.getByRole('button', { name: 'settings' }))
    expect(screen.getByRole('combobox', { name: 'voice' })).toBeDisabled()
    voices = [kyoko]
    const listener = synth.addEventListener.mock.calls.find((c) => c[0] === 'voiceschanged')?.[1] as () => void
    listener()
    await tick()
    expect(screen.getByRole('combobox', { name: 'voice' })).toBeEnabled()
    expect(screen.queryByText(/no japanese voice/i)).toBeNull()
  })

  it('updates the readout when the slider moves', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([kyoko]))
    const user = userEvent.setup()
    render(SettingsMenu, { props: { ...base } })
    await user.click(screen.getByRole('button', { name: 'settings' }))
    await fireEvent.input(screen.getByRole('slider', { name: 'speech rate' }), { target: { value: '1.3' } })
    expect(screen.getByText('1.3×')).toBeInTheDocument()
  })

  it('closes on outside click, toggles closed on gear click', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([kyoko]))
    const user = userEvent.setup()
    render(SettingsMenu, { props: { ...base } })
    const gear = screen.getByRole('button', { name: 'settings' })
    await user.click(gear)
    expect(gear).toHaveAttribute('aria-expanded', 'true')
    await user.click(document.body)
    expect(gear).toHaveAttribute('aria-expanded', 'false')
    await user.click(gear)
    await user.click(gear)
    expect(gear).toHaveAttribute('aria-expanded', 'false')
  })

  it('Escape closes the popup, stops propagation, and refocuses the gear', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([kyoko]))
    const user = userEvent.setup()
    const windowSpy = vi.fn()
    window.addEventListener('keydown', windowSpy)
    try {
      render(SettingsMenu, { props: { ...base } })
      const gear = screen.getByRole('button', { name: 'settings' })
      await user.click(gear)
      const select = screen.getByRole('combobox', { name: 'voice' })
      select.focus()
      await user.keyboard('{Escape}')
      expect(gear).toHaveAttribute('aria-expanded', 'false')
      expect(gear).toHaveFocus()
      expect(windowSpy).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', windowSpy)
    }
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/components/SettingsMenu.test.ts`
Expected: FAIL — cannot resolve `../../src/components/SettingsMenu.svelte`.

- [ ] **Step 4: Write the component**

Create `src/components/SettingsMenu.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  import { listJaVoices } from '../lib/speech'
  import { t } from '../lib/i18n.svelte'

  let {
    rate = $bindable(),
    voiceURI = $bindable(null),
  }: {
    rate: number
    voiceURI?: string | null
  } = $props()

  const uid = $props.id()
  let open = $state(false)
  let root: HTMLElement
  let gear: HTMLButtonElement

  let voices = $state<SpeechSynthesisVoice[]>([])
  onMount(() => {
    const update = () => (voices = listJaVoices())
    update()
    globalThis.speechSynthesis?.addEventListener('voiceschanged', update)
    return () => globalThis.speechSynthesis?.removeEventListener('voiceschanged', update)
  })

  const storedVoicePresent = $derived(voices.some((v) => v.voiceURI === voiceURI))
  const noVoices = $derived(voices.length === 0)

  // document-level listeners exist only while the popup is open
  $effect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!root.contains(e.target as Node)) open = false
    }
    const onDocKeydown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // the popup swallows Escape: App's window-level handler (clear the
      // bunsetsu selection) must not also fire
      e.stopPropagation()
      open = false
      gear.focus()
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onDocKeydown)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onDocKeydown)
    }
  })
</script>

<div class="settings-menu" bind:this={root}>
  <button
    class="icon-button"
    bind:this={gear}
    aria-expanded={open}
    aria-label={t('settingsLabel')}
    onclick={() => (open = !open)}
  >
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  </button>
  {#if open}
    <div class="settings-popup">
      <div class="row">
        <label class="row-label" for="voice-{uid}">{t('voiceLabel')}</label>
        <select
          id="voice-{uid}"
          disabled={noVoices}
          title={noVoices ? t('noVoice') : undefined}
          onchange={(e) => (voiceURI = e.currentTarget.value || null)}
        >
          <!-- per-option selected attributes (not bind:value): a stored-but-absent voice
               must DISPLAY as auto without overwriting the stored value -->
          <option value="" selected={voiceURI === null || !storedVoicePresent}>{t('voiceAuto')}</option>
          {#each voices as v}
            <option value={v.voiceURI} selected={v.voiceURI === voiceURI}>{v.name}</option>
          {/each}
        </select>
      </div>
      <div class="row">
        <label class="row-label" for="rate-{uid}">{t('rateLabel')}</label>
        <span class="rate-row">
          <input
            id="rate-{uid}"
            type="range"
            min="0.5"
            max="1.5"
            step="0.1"
            bind:value={rate}
            disabled={noVoices}
            title={noVoices ? t('noVoice') : undefined}
          />
          <span>{rate.toFixed(1)}×</span>
        </span>
      </div>
      {#if noVoices}
        <p class="no-voice-note">{t('noVoice')}</p>
      {/if}
    </div>
  {/if}
</div>
```

- [ ] **Step 5: Append the CSS**

Append to `src/app.css`, after the `.locale-switcher` rules:

```css
.settings-menu { position: relative; margin-left: auto; }
.icon-button { border: none; background: none; cursor: pointer; padding: 0.35rem; border-radius: 6px; color: #57606a; display: inline-flex; }
.icon-button:hover { background: var(--accent-soft); }
.icon-button[aria-expanded="true"] { background: var(--accent-soft); color: var(--accent); }
.settings-popup { position: absolute; right: 0; top: calc(100% + 6px); z-index: 20; background: #fff; border: 1px solid var(--box-stroke); border-radius: 10px; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12); padding: 0.75rem 1rem; min-width: 15rem; display: flex; flex-direction: column; gap: 0.6rem; }
.settings-popup .row { display: flex; flex-direction: column; gap: 0.25rem; }
.settings-popup .row-label { text-transform: uppercase; font-size: 0.68rem; letter-spacing: 0.04em; color: #57606a; }
.settings-popup select { border: 1px solid var(--box-stroke); background: #fff; padding: 0.25rem; border-radius: 6px; }
.settings-popup .rate-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; }
.settings-popup .no-voice-note { margin: 0; color: #57606a; font-size: 0.8rem; font-style: italic; max-width: 15rem; }
.settings-popup :disabled { opacity: 0.5; cursor: default; }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/components/SettingsMenu.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 7: Full check**

Run: `npm test && npm run check`
Expected: all suites PASS, svelte-check 0 errors 0 warnings.

- [ ] **Step 8: Commit**

```bash
git add src/components/SettingsMenu.svelte src/lib/locales tests/components/SettingsMenu.test.ts src/app.css
git commit -m "feat: add SettingsMenu gear popup with voice and rate controls"
```

---

### Task 2: Header wiring, Toolbar swap/strip, 🗣️

**Files:**
- Modify: `src/components/App.svelte` (header + import)
- Modify: `src/components/Toolbar.svelte` (swap order, drop rate/voice)
- Modify: `src/components/Inspector.svelte:42,56,76` (🔊 → 🗣️)
- Modify: `src/app.css:21` (remove the `.toolbar select.voice` rule line)
- Test: `tests/components/App.test.ts`, `tests/components/Toolbar.test.ts`, `tests/components/Inspector.test.ts`

**Interfaces:**
- Consumes: `SettingsMenu` from Task 1.
- Produces: header DOM order `div.brand`, `div.toolbar`, `div.settings-menu`; Toolbar props exactly `{ showFurigana, view }`.

- [ ] **Step 1: Write the failing tests**

In `tests/components/App.test.ts`, add after the `'places the locale switcher in the header brand, not the toolbar'` test:

```ts
it('orders the header: brand, toolbar, settings gear last', () => {
  render(App)
  const children = [...document.querySelector('header')!.children]
  expect(children.map((c) => c.className.split(' ')[0])).toEqual(['brand', 'toolbar', 'settings-menu'])
})
```

In `tests/components/Toolbar.test.ts`, add (inside the view-buttons describe):

```ts
it('renders the view buttons before the furigana checkbox', () => {
  render(Toolbar, { props: { ...base } })
  const toolbar = document.querySelector('.toolbar')!
  expect(toolbar.children[0].classList.contains('views')).toBe(true)
  expect(toolbar.children[1].querySelector('input[type="checkbox"]')).not.toBeNull()
})
```

In `tests/components/Inspector.test.ts`, add at the end of the bunsetsu-mode describe:

```ts
it('uses the speaking-head glyph on speak buttons', () => {
  render(Inspector, { props: { sentence, index: 0, total: 1, selected: sentence.bunsetsu[2], rate: 1, voiceURI: null } })
  expect(screen.getByRole('button', { name: 'speak bunsetsu' }).textContent).toContain('🗣️')
})
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run tests/components/App.test.ts tests/components/Toolbar.test.ts tests/components/Inspector.test.ts -t 'orders the header|before the furigana|speaking-head'`
Expected: all three FAIL (no settings-menu in header; checkbox first; 🔊 glyph).

- [ ] **Step 3: Rewrite Toolbar.svelte**

Replace the whole file with:

```svelte
<script lang="ts">
  import { t } from '../lib/i18n.svelte'
  import type { ViewKind } from '../lib/settings'

  let {
    showFurigana = $bindable(),
    view = $bindable(),
  }: {
    showFurigana: boolean
    view: ViewKind
  } = $props()
</script>

<div class="toolbar">
  <div class="views" role="group" aria-label={t('viewGroupLabel')}>
    <button class:active={view === 'arcs'} aria-pressed={view === 'arcs'} onclick={() => (view = 'arcs')}>⌒ {t('viewArcs')}</button>
    <button class:active={view === 'tree'} aria-pressed={view === 'tree'} onclick={() => (view = 'tree')}>🌳 {t('viewTree')}</button>
    <button class:active={view === 'cabocha'} aria-pressed={view === 'cabocha'} onclick={() => (view = 'cabocha')}>🎃 {t('viewCabocha')}</button>
  </div>
  <label class="toggle"><input type="checkbox" bind:checked={showFurigana} /> {t('furiganaToggle')}</label>
</div>
```

- [ ] **Step 4: Update App.svelte**

Add the import after the LocaleSwitcher import:

```ts
import SettingsMenu from './SettingsMenu.svelte'
```

Replace the header block with:

```svelte
<header>
  <div class="brand">
    <h1><span lang="ja">文木</span> Ayaki</h1>
    <LocaleSwitcher bind:locale />
  </div>
  <Toolbar bind:showFurigana bind:view />
  <SettingsMenu bind:rate bind:voiceURI />
</header>
```

- [ ] **Step 5: 🗣️ in Inspector.svelte**

Replace the glyph in the three speak buttons (lines 42, 56, 76): `>🔊</button>` → `>🗣️</button>` (twice) and `🔊 {t('speakButton')}` → `🗣️ {t('speakButton')}`. Nothing else changes.

- [ ] **Step 6: CSS removal**

Delete line `src/app.css:21`:

```css
.toolbar select.voice { border: 1px solid var(--box-stroke); background: #fff; padding: 0.25rem; border-radius: 6px; max-width: 11rem; }
```

- [ ] **Step 7: Update the moved/changed tests**

In `tests/components/Toolbar.test.ts`:
- Change `base` to `const base = { showFurigana: false, view: 'arcs' as const }`.
- Delete the entire `describe('Toolbar voice selector', …)` block and the `fakeSynth` helper and the now-unused `tick`/`userEvent` imports if nothing else uses them (the view-buttons describe still uses `userEvent`; keep what is used).
- In `describe('Toolbar localization', …)`, the `'localizes the toolbar chrome'` test: remove the `Sprechtempo` slider assertion line (the slider moved to SettingsMenu); keep the Furigana and Baum assertions.

In `tests/components/App.test.ts`:
- `'restores settings from localStorage and persists changes'`: the rate-slider assertion must open the popup first. Replace

```ts
expect((screen.getByRole('slider', { name: /speech rate/i }) as HTMLInputElement).value).toBe('1.2')
```

with

```ts
await user.click(screen.getByRole('button', { name: 'settings' }))
expect((screen.getByRole('slider', { name: /speech rate/i }) as HTMLInputElement).value).toBe('1.2')
```

- `'binds the voice selector to the persisted setting'`: after `render(App)`, open the popup before querying the combobox:

```ts
await user.click(screen.getByRole('button', { name: 'settings' }))
```

(The rest of the test is unchanged — the select keeps its accessible name `voice`.)

- [ ] **Step 8: Run the affected suites**

Run: `npx vitest run tests/components/App.test.ts tests/components/Toolbar.test.ts tests/components/Inspector.test.ts tests/components/SettingsMenu.test.ts`
Expected: PASS. The pre-existing locale/furigana/view App tests must pass UNCHANGED (do not edit them).

- [ ] **Step 9: Full check**

Run: `npm test && npm run check`
Expected: all suites PASS, svelte-check 0 errors 0 warnings.

- [ ] **Step 10: Commit**

```bash
git add src/components/App.svelte src/components/Toolbar.svelte src/components/Inspector.svelte src/app.css tests/components/App.test.ts tests/components/Toolbar.test.ts tests/components/Inspector.test.ts
git commit -m "feat: move voice and rate into header settings popup, swap furigana right of views, speak glyph 🗣️"
```

---

### Task 3: Screenshot refresh (controller-run, not a subagent task)

The chrome changed → all three README screenshots are invalid (this is exactly what `npm run shots` is for).

- [ ] **Step 1:** Run `npm run shots`; visually verify all three scenes show the new header (views before furigana, gear at far right, no rate/voice in the toolbar).
- [ ] **Step 2:** Update `README.md` alt texts: the arcs screenshot's "…the voice selector in the toolbar and the language globe in the header" becomes "…the language globe and settings gear in the header".
- [ ] **Step 3:** Commit: `git add docs/images README.md && git commit -m "docs: refresh screenshots for header settings menu"`.

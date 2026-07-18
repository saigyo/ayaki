# Voice Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The user picks a Japanese speech voice in the toolbar; the choice persists like the other settings and falls back to the existing auto heuristic.

**Architecture:** `speech.ts` gains `listJaVoices()` and a `preferredURI` parameter on `pickVoice`/`speak`. `settings.ts` gains a `voiceURI: string | null` field (null = auto) through its table-shaped validators. The Toolbar renders a voice `<select>` (hidden when no Japanese voices) with per-option `selected` attributes so a stored-but-absent voice displays as auto without clobbering the stored value. App binds and persists; Inspector threads `voiceURI` into all three speak calls.

**Tech Stack:** Svelte 5 runes, TypeScript strict, vitest (+ jsdom, `vi.stubGlobal` speech fakes), @testing-library/svelte.

**Spec:** `docs/superpowers/specs/2026-07-18-voice-selection-design.md`

## Global Constraints

- `voiceURI` semantics: `null` = auto (existing heuristic). A stored URI absent on this machine is KEPT in storage; the selector shows auto and `pickVoice` falls back.
- Voice list = voices whose `lang` starts with `ja` (case-insensitive), ordered `localService` first, then alphabetically by `name`.
- The selector is hidden entirely (not rendered) while the Japanese voice list is empty; it appears when `voiceschanged` delivers voices.
- Select options: first 自動 auto with value `''` (maps to `null`), then one option per voice (value = `voiceURI`, label = `name`). `aria-label="voice"`.
- Use an UNKEYED `{#each}` for the options (content-derived keys risk `each_key_duplicate` crashes — repo lesson).
- Svelte 5 runes only; TypeScript strict; commits get the Co-Authored-By trailer via the repo's prepare-commit-msg hook (do not bypass).
- Every task ends green: `npm test -- --run` and `npm run check` before each commit.

---

### Task 1: speech.ts voice preference

**Files:**
- Modify: `src/lib/speech.ts`
- Test: `tests/lib/speech.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces (later tasks rely on these exact signatures):
  - `listJaVoices(): SpeechSynthesisVoice[]`
  - `pickVoice(preferredURI?: string | null): SpeechSynthesisVoice | null`
  - `speak(text: string, rate?: number, voiceURI?: string | null): void`
  - `speechAvailable(): boolean` (unchanged)

- [ ] **Step 1: Write the failing tests**

In `tests/lib/speech.test.ts`, add `listJaVoices` to the import from `'../../src/lib/speech'`, then append inside `describe('speech', …)` (the file already defines `fakeSynth` and `FakeUtterance`):

```ts
  it('lists Japanese voices localService-first then alphabetical', () => {
    vi.stubGlobal(
      'speechSynthesis',
      fakeSynth([
        { lang: 'ja-JP', localService: false, name: 'Zulu', voiceURI: 'zulu' },
        { lang: 'en-US', localService: true, name: 'Samantha', voiceURI: 'sam' },
        { lang: 'ja-JP', localService: true, name: 'Otoya', voiceURI: 'otoya' },
        { lang: 'ja-JP', localService: false, name: 'Cloud', voiceURI: 'cloud' },
        { lang: 'ja-JP', localService: true, name: 'Kyoko', voiceURI: 'kyoko' },
      ]),
    )
    expect(listJaVoices().map((v) => v.name)).toEqual(['Kyoko', 'Otoya', 'Cloud', 'Zulu'])
  })
  it('pickVoice honors a preferred voiceURI and falls back when missing', () => {
    vi.stubGlobal(
      'speechSynthesis',
      fakeSynth([
        { lang: 'ja-JP', localService: true, name: 'Kyoko', voiceURI: 'kyoko' },
        { lang: 'ja-JP', localService: false, name: 'Cloud', voiceURI: 'cloud' },
      ]),
    )
    expect(pickVoice('cloud')?.name).toBe('Cloud')
    expect(pickVoice('gone')?.name).toBe('Kyoko')
    expect(pickVoice(null)?.name).toBe('Kyoko')
  })
  it('pickVoice ignores a preferred URI belonging to a non-Japanese voice', () => {
    vi.stubGlobal(
      'speechSynthesis',
      fakeSynth([
        { lang: 'en-US', localService: true, name: 'Samantha', voiceURI: 'sam' },
        { lang: 'ja-JP', localService: true, name: 'Kyoko', voiceURI: 'kyoko' },
      ]),
    )
    expect(pickVoice('sam')?.name).toBe('Kyoko')
  })
  it('speak applies the preferred voice to the utterance', () => {
    const synth = fakeSynth([
      { lang: 'ja-JP', localService: true, name: 'Kyoko', voiceURI: 'kyoko' },
      { lang: 'ja-JP', localService: false, name: 'Cloud', voiceURI: 'cloud' },
    ])
    vi.stubGlobal('speechSynthesis', synth)
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
    speak('こんにちは', 1, 'cloud')
    const u = synth.speak.mock.calls[0][0] as FakeUtterance
    expect((u.voice as SpeechSynthesisVoice).name).toBe('Cloud')
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --run tests/lib/speech.test.ts`
Expected: FAIL — `listJaVoices` is not exported; `pickVoice('cloud')` (argument) has no effect yet.

- [ ] **Step 3: Implement**

Replace the full contents of `src/lib/speech.ts` with:

```ts
function synth(): SpeechSynthesis | undefined {
  return (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis
}

/** Japanese voices, localService first, then alphabetical by name (stable dropdown order). */
export function listJaVoices(): SpeechSynthesisVoice[] {
  const voices = synth()?.getVoices() ?? []
  return voices
    .filter((v) => v.lang.toLowerCase().startsWith('ja'))
    .sort((a, b) =>
      a.localService === b.localService ? a.name.localeCompare(b.name) : a.localService ? -1 : 1,
    )
}

/** Preferred voice by exact voiceURI when available, else the auto heuristic
 *  (first local-service Japanese voice, else first Japanese voice). */
export function pickVoice(preferredURI: string | null = null): SpeechSynthesisVoice | null {
  const ja = listJaVoices()
  if (preferredURI) {
    const preferred = ja.find((v) => v.voiceURI === preferredURI)
    if (preferred) return preferred
  }
  return ja.find((v) => v.localService) ?? ja[0] ?? null
}

export function speechAvailable(): boolean {
  return synth() !== undefined && pickVoice() !== null
}

/** Speak Japanese text, cancelling any utterance already in progress. */
export function speak(text: string, rate = 1, voiceURI: string | null = null): void {
  const s = synth()
  if (!s) return
  s.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  const voice = pickVoice(voiceURI)
  if (voice) utterance.voice = voice
  utterance.lang = 'ja-JP'
  utterance.rate = rate
  s.speak(utterance)
}

export function stopSpeech(): void {
  synth()?.cancel()
}
```

(Note: `pickVoice`'s fallback behavior is unchanged for callers without a preference — `ja.find((v) => v.localService) ?? ja[0]` — the list is merely deterministic-ordered now.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --run tests/lib/speech.test.ts`
Expected: PASS (9 tests: 5 existing + 4 new).

- [ ] **Step 5: Full suite, check, commit**

Run: `npm test -- --run && npm run check` — all green. Then:

```bash
git add src/lib/speech.ts tests/lib/speech.test.ts
git commit -m "feat: voice preference in speech module with deterministic ja voice list"
```

---

### Task 2: voiceURI setting + App persistence

**Files:**
- Modify: `src/lib/settings.ts`
- Modify: `src/components/App.svelte` (settings block only)
- Test: `tests/lib/settings.test.ts`, `tests/components/App.test.ts`

**Interfaces:**
- Consumes: the settings module's validator table (existing).
- Produces: `Settings.voiceURI: string | null` (default `null`); App holds `voiceURI` state (initialized/persisted) that Tasks 3–4 bind and consume.

- [ ] **Step 1: Write the failing tests**

In `tests/lib/settings.test.ts`, update the round-trip test to include the new field:

```ts
  it('round-trips saved settings', () => {
    const s = { showFurigana: true, view: 'tree' as const, rate: 1.3, voiceURI: 'kyoko' }
    saveSettings(s)
    expect(loadSettings()).toEqual(s)
  })
```

and append inside `describe('loadSettings', …)`:

```ts
  it('accepts a string or null voiceURI and rejects other types', () => {
    localStorage.setItem(KEY, JSON.stringify({ voiceURI: 'kyoko' }))
    expect(loadSettings().voiceURI).toBe('kyoko')
    localStorage.setItem(KEY, JSON.stringify({ voiceURI: null }))
    expect(loadSettings().voiceURI).toBeNull()
    localStorage.setItem(KEY, JSON.stringify({ voiceURI: 7 }))
    expect(loadSettings().voiceURI).toBeNull()
  })
  it('defaults voiceURI to null for payloads from before the field existed', () => {
    localStorage.setItem(KEY, JSON.stringify({ view: 'tree' }))
    expect(loadSettings()).toEqual({ ...DEFAULTS, view: 'tree' })
  })
```

In `tests/components/App.test.ts`, update the persisted-object assertion in the test `'restores settings from localStorage and persists changes'` to expect the new field:

```ts
    expect(JSON.parse(localStorage.getItem('ayaki-settings')!)).toEqual({
      showFurigana: false,
      view: 'tree',
      rate: 1.2,
      voiceURI: null,
    })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --run tests/lib/settings.test.ts tests/components/App.test.ts`
Expected: FAIL — `voiceURI` unknown to `Settings`, not persisted by App.

- [ ] **Step 3: Implement**

In `src/lib/settings.ts` add one line each:

```ts
export interface Settings {
  showFurigana: boolean
  view: 'arcs' | 'tree'
  rate: number
  voiceURI: string | null
}

export const DEFAULTS: Settings = { showFurigana: false, view: 'arcs', rate: 1, voiceURI: null }
```

and in the validator table:

```ts
  voiceURI: (v) => (v === null || typeof v === 'string' ? v : undefined),
```

In `src/components/App.svelte`, extend the settings block:

```ts
  const initialSettings = loadSettings()
  let showFurigana = $state(initialSettings.showFurigana)
  let view = $state<'arcs' | 'tree'>(initialSettings.view)
  let rate = $state(initialSettings.rate)
  let voiceURI = $state(initialSettings.voiceURI)

  $effect(() => {
    saveSettings({ showFurigana, view, rate, voiceURI })
  })
```

- [ ] **Step 4: Run the full suite and check**

Run: `npm test -- --run && npm run check`
Expected: all PASS, 0 check errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/settings.ts src/components/App.svelte tests/lib/settings.test.ts tests/components/App.test.ts
git commit -m "feat: persist selected voice URI in settings"
```

---

### Task 3: Toolbar voice selector

**Files:**
- Modify: `src/components/Toolbar.svelte`
- Modify: `src/app.css` (one rule after the `.toolbar .views button.active` rule at line 20)
- Test: create `tests/components/Toolbar.test.ts`

**Interfaces:**
- Consumes (Task 1): `listJaVoices(): SpeechSynthesisVoice[]` from `src/lib/speech.ts`.
- Produces: Toolbar prop `voiceURI?: string | null` (bindable, default `null`) — Task 4 binds it from App.

- [ ] **Step 1: Write the failing tests**

Create `tests/components/Toolbar.test.ts`:

```ts
// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { tick } from 'svelte'
import Toolbar from '../../src/components/Toolbar.svelte'

const base = { showFurigana: false, view: 'arcs' as const, rate: 1 }

function fakeSynth(voices: Array<Partial<SpeechSynthesisVoice>>) {
  return {
    getVoices: () => voices as SpeechSynthesisVoice[],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('Toolbar voice selector', () => {
  it('renders auto plus the Japanese voices in order', () => {
    vi.stubGlobal(
      'speechSynthesis',
      fakeSynth([
        { lang: 'ja-JP', localService: false, name: 'Cloud', voiceURI: 'cloud' },
        { lang: 'ja-JP', localService: true, name: 'Kyoko', voiceURI: 'kyoko' },
        { lang: 'en-US', localService: true, name: 'Samantha', voiceURI: 'sam' },
      ]),
    )
    render(Toolbar, { props: { ...base, voiceURI: null } })
    const select = screen.getByRole('combobox', { name: 'voice' }) as HTMLSelectElement
    const labels = [...select.options].map((o) => o.textContent)
    expect(labels).toEqual(['自動 auto', 'Kyoko', 'Cloud'])
    expect(select.value).toBe('')
  })
  it('is hidden when there are no Japanese voices', () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([{ lang: 'en-US', localService: true, name: 'Samantha', voiceURI: 'sam' }]))
    render(Toolbar, { props: { ...base, voiceURI: null } })
    expect(screen.queryByRole('combobox', { name: 'voice' })).toBeNull()
  })
  it('shows the stored voice when present, auto when absent — without clearing it', () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([{ lang: 'ja-JP', localService: true, name: 'Kyoko', voiceURI: 'kyoko' }]))
    const present = render(Toolbar, { props: { ...base, voiceURI: 'kyoko' } })
    expect((present.getByRole('combobox', { name: 'voice' }) as HTMLSelectElement).value).toBe('kyoko')
    const absent = render(Toolbar, { props: { ...base, voiceURI: 'gone-machine-uri' } })
    expect((absent.getByRole('combobox', { name: 'voice' }) as HTMLSelectElement).value).toBe('')
  })
  it('appears when voiceschanged later delivers Japanese voices', async () => {
    let voices: Array<Partial<SpeechSynthesisVoice>> = []
    const synth = fakeSynth([])
    synth.getVoices = () => voices as SpeechSynthesisVoice[]
    vi.stubGlobal('speechSynthesis', synth)
    render(Toolbar, { props: { ...base, voiceURI: null } })
    expect(screen.queryByRole('combobox', { name: 'voice' })).toBeNull()
    voices = [{ lang: 'ja-JP', localService: true, name: 'Kyoko', voiceURI: 'kyoko' }]
    const listener = synth.addEventListener.mock.calls.find((c) => c[0] === 'voiceschanged')?.[1] as () => void
    listener()
    await tick()
    expect(screen.getByRole('combobox', { name: 'voice' })).toBeInTheDocument()
  })
  it('maps the auto option to null on change', async () => {
    vi.stubGlobal('speechSynthesis', fakeSynth([{ lang: 'ja-JP', localService: true, name: 'Kyoko', voiceURI: 'kyoko' }]))
    const user = userEvent.setup()
    render(Toolbar, { props: { ...base, voiceURI: 'kyoko' } })
    const select = screen.getByRole('combobox', { name: 'voice' }) as HTMLSelectElement
    await user.selectOptions(select, '')
    expect(select.value).toBe('')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --run tests/components/Toolbar.test.ts`
Expected: FAIL — no combobox rendered (prop and markup don't exist yet).

- [ ] **Step 3: Implement**

Replace the full contents of `src/components/Toolbar.svelte` with:

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  import { listJaVoices } from '../lib/speech'

  let {
    showFurigana = $bindable(),
    view = $bindable(),
    rate = $bindable(),
    voiceURI = $bindable(null),
  }: {
    showFurigana: boolean
    view: 'arcs' | 'tree'
    rate: number
    voiceURI?: string | null
  } = $props()

  let voices = $state<SpeechSynthesisVoice[]>([])
  onMount(() => {
    const update = () => (voices = listJaVoices())
    update()
    globalThis.speechSynthesis?.addEventListener('voiceschanged', update)
    return () => globalThis.speechSynthesis?.removeEventListener('voiceschanged', update)
  })

  const storedVoicePresent = $derived(voices.some((v) => v.voiceURI === voiceURI))
</script>

<div class="toolbar">
  <label class="toggle"><input type="checkbox" bind:checked={showFurigana} /> ルビ furigana</label>
  <div class="views" role="group" aria-label="tree view style">
    <button class:active={view === 'arcs'} aria-pressed={view === 'arcs'} onclick={() => (view = 'arcs')}>⌒ arcs</button>
    <button class:active={view === 'tree'} aria-pressed={view === 'tree'} onclick={() => (view = 'tree')}>🌳 tree</button>
  </div>
  <label class="rate">
    🔊 {rate.toFixed(1)}×
    <input type="range" min="0.5" max="1.5" step="0.1" bind:value={rate} aria-label="speech rate" />
  </label>
  {#if voices.length > 0}
    <select class="voice" aria-label="voice" onchange={(e) => (voiceURI = e.currentTarget.value || null)}>
      <!-- per-option selected attributes (not bind:value): a stored-but-absent voice
           must DISPLAY as auto without overwriting the stored value -->
      <option value="" selected={voiceURI === null || !storedVoicePresent}>自動 auto</option>
      {#each voices as v}
        <option value={v.voiceURI} selected={v.voiceURI === voiceURI}>{v.name}</option>
      {/each}
    </select>
  {/if}
</div>
```

In `src/app.css`, after the `.toolbar .views button.active` rule (line 20), add:

```css
.toolbar select.voice { border: 1px solid var(--box-stroke); background: #fff; padding: 0.25rem; border-radius: 6px; max-width: 11rem; }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --run tests/components/Toolbar.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Full suite, check, commit**

Run: `npm test -- --run && npm run check` — all green. Then:

```bash
git add src/components/Toolbar.svelte src/app.css tests/components/Toolbar.test.ts
git commit -m "feat: voice selector in toolbar, hidden without Japanese voices"
```

---

### Task 4: App binding and Inspector pass-through

**Files:**
- Modify: `src/components/App.svelte:72` (Toolbar usage) and `:105` (Inspector usage)
- Modify: `src/components/Inspector.svelte` (props + the three `speak(...)` calls at lines 38, 51, 70)
- Test: `tests/components/App.test.ts`, create `tests/components/InspectorSpeak.test.ts`

**Interfaces:**
- Consumes: Toolbar `voiceURI` bindable (Task 3); App `voiceURI` state (Task 2); `speak(text, rate, voiceURI)` (Task 1).
- Produces: Inspector prop `voiceURI: string | null`.

- [ ] **Step 1: Write the failing tests**

Create `tests/components/InspectorSpeak.test.ts` (a separate file because it mocks the speech module, while the existing Inspector tests rely on the real disabled-in-jsdom behavior):

```ts
// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Inspector from '../../src/components/Inspector.svelte'
import { sentenceFixture } from '../fixtures'

vi.mock('../../src/lib/speech', () => ({
  speak: vi.fn(),
  stopSpeech: vi.fn(),
  speechAvailable: () => true,
}))
import { speak } from '../../src/lib/speech'

const sentence = sentenceFixture()

describe('Inspector speak pass-through', () => {
  it('passes the selected voice when speaking the sentence', async () => {
    const user = userEvent.setup()
    render(Inspector, { props: { sentence, index: 0, total: 1, selected: null, rate: 0.9, voiceURI: 'kyoko' } })
    await user.click(screen.getByRole('button', { name: /speak/i }))
    expect(speak).toHaveBeenCalledWith(sentence.text, 0.9, 'kyoko')
  })
  it('passes the selected voice for bunsetsu and morpheme buttons', async () => {
    const user = userEvent.setup()
    render(Inspector, { props: { sentence, index: 0, total: 1, selected: sentence.bunsetsu[2], rate: 1, voiceURI: 'cloud' } })
    await user.click(screen.getByRole('button', { name: 'speak bunsetsu' }))
    expect(speak).toHaveBeenCalledWith('食べた。', 1, 'cloud')
    await user.click(screen.getByRole('button', { name: 'speak 食べ' }))
    expect(speak).toHaveBeenCalledWith('食べ', 1, 'cloud')
  })
})
```

In `tests/components/App.test.ts`, add `afterEach` to the vitest import, add after the existing `beforeEach`:

```ts
afterEach(() => vi.unstubAllGlobals())
```

and append inside `describe('App', …)`:

```ts
  it('binds the voice selector to the persisted setting', async () => {
    vi.stubGlobal('speechSynthesis', {
      getVoices: () => [
        { lang: 'ja-JP', localService: true, name: 'Kyoko', voiceURI: 'kyoko' },
        { lang: 'ja-JP', localService: false, name: 'Cloud', voiceURI: 'cloud' },
      ] as SpeechSynthesisVoice[],
      cancel: vi.fn(),
      speak: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    localStorage.setItem('ayaki-settings', JSON.stringify({ voiceURI: 'cloud' }))
    const user = userEvent.setup()
    render(App)
    const select = screen.getByRole('combobox', { name: 'voice' }) as HTMLSelectElement
    expect(select.value).toBe('cloud')
    await user.selectOptions(select, 'kyoko')
    await tick()
    expect(JSON.parse(localStorage.getItem('ayaki-settings')!).voiceURI).toBe('kyoko')
  })
```

(`tick` is already imported in this file from the persist-settings work.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --run tests/components/App.test.ts tests/components/InspectorSpeak.test.ts`
Expected: FAIL — App renders no combobox (binding missing); Inspector calls `speak` with two arguments.

- [ ] **Step 3: Implement**

In `src/components/App.svelte` line 72, change

```svelte
    <Toolbar bind:showFurigana bind:view bind:rate />
```

to

```svelte
    <Toolbar bind:showFurigana bind:view bind:rate bind:voiceURI />
```

and line 105, change

```svelte
    <Inspector sentence={activeVM} index={activeSentence} total={sentences.length} selected={selectedBunsetsu} {rate} />
```

to

```svelte
    <Inspector sentence={activeVM} index={activeSentence} total={sentences.length} selected={selectedBunsetsu} {rate} {voiceURI} />
```

In `src/components/Inspector.svelte`, add to the `$props()` destructuring and type:

```ts
  let {
    sentence,
    index,
    total,
    selected,
    rate,
    voiceURI,
  }: {
    sentence: ParsedSentence | null
    index: number
    total: number
    selected: BunsetsuVM | null
    rate: number
    voiceURI: string | null
  } = $props()
```

and update the three speak calls:

- line 38: `onclick={() => speak(selected.surface, rate, voiceURI)}`
- line 51: `onclick={() => speak(m.surface, rate, voiceURI)}`
- line 70: `onclick={() => speak(sentence.text, rate, voiceURI)}`

- [ ] **Step 4: Run the full suite and check**

Run: `npm test -- --run && npm run check`
Expected: all PASS (including all pre-existing Inspector/App tests), 0 check errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/App.svelte src/components/Inspector.svelte tests/components/App.test.ts tests/components/InspectorSpeak.test.ts
git commit -m "feat: wire selected voice through app and inspector speech"
```

# Persist Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toolbar settings (furigana toggle, view style, speech rate) survive browser reloads via localStorage.

**Architecture:** A new `src/lib/settings.ts` module owns the storage key, serialization, per-field validation, and defaults for one `Settings` object. `App.svelte` initializes its existing `$state` from `loadSettings()` and writes back through a single `$effect`. No UI changes.

**Tech Stack:** Svelte 5 runes, TypeScript strict, vitest (+ jsdom for localStorage), @testing-library/svelte.

**Spec:** `docs/superpowers/specs/2026-07-18-persist-settings-design.md`

## Global Constraints

- Storage key exactly `ayaki-settings`; payload is a JSON object.
- Field validation: `showFurigana` boolean; `view` exactly `'arcs'` or `'tree'`; `rate` a finite number clamped to **0.5–1.5** (the Toolbar slider's `min`/`max`).
- Field-wise fallback: an invalid/missing field gets its own default while valid fields are kept; unknown keys ignored; whole-payload failures (missing key, malformed JSON, non-object, storage throwing) → all defaults. `saveSettings` never throws.
- Validation is table-shaped (one validator per field) so future `voiceURI`/`locale` fields are one-line additions.
- Defaults are the current hardcoded values: `{ showFurigana: false, view: 'arcs', rate: 1 }`.
- Svelte 5 runes only; TypeScript strict; every commit gets the Co-Authored-By trailer via the repo's prepare-commit-msg hook (do not bypass it).
- All existing tests stay green: `npm test -- --run` and `npm run check` must pass before each commit.

---

### Task 1: The settings module

**Files:**
- Create: `src/lib/settings.ts`
- Test: create `tests/lib/settings.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (browser `localStorage` only).
- Produces (Task 2 relies on these exact signatures):
  - `interface Settings { showFurigana: boolean; view: 'arcs' | 'tree'; rate: number }`
  - `const DEFAULTS: Settings`
  - `function loadSettings(): Settings`
  - `function saveSettings(s: Settings): void`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/settings.test.ts` (note the jsdom pragma — the default test environment is node, which has no `localStorage`):

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULTS, loadSettings, saveSettings } from '../../src/lib/settings'

const KEY = 'ayaki-settings'

beforeEach(() => localStorage.clear())

describe('loadSettings', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual(DEFAULTS)
  })
  it('round-trips saved settings', () => {
    const s = { showFurigana: true, view: 'tree' as const, rate: 1.3 }
    saveSettings(s)
    expect(loadSettings()).toEqual(s)
  })
  it.each(['not json{', '42', 'null', '[]', '"tree"'])(
    'falls back to all defaults for non-object payload %s',
    (raw) => {
      localStorage.setItem(KEY, raw)
      expect(loadSettings()).toEqual(DEFAULTS)
    },
  )
  it('keeps valid fields when others are invalid', () => {
    localStorage.setItem(KEY, JSON.stringify({ showFurigana: 'yes', view: 'tree', rate: 'fast' }))
    expect(loadSettings()).toEqual({ ...DEFAULTS, view: 'tree' })
  })
  it('clamps rate to the slider range', () => {
    localStorage.setItem(KEY, JSON.stringify({ rate: 0.1 }))
    expect(loadSettings().rate).toBe(0.5)
    localStorage.setItem(KEY, JSON.stringify({ rate: 99 }))
    expect(loadSettings().rate).toBe(1.5)
  })
  it('rejects non-numeric and non-finite rate values', () => {
    localStorage.setItem(KEY, JSON.stringify({ rate: '1' }))
    expect(loadSettings().rate).toBe(DEFAULTS.rate)
    // JSON.stringify turns NaN/Infinity into null — cover a literal null too
    localStorage.setItem(KEY, '{"rate": null}')
    expect(loadSettings().rate).toBe(DEFAULTS.rate)
  })
  it('ignores unknown keys', () => {
    localStorage.setItem(KEY, JSON.stringify({ view: 'tree', theme: 'dark' }))
    expect(loadSettings()).toEqual({ ...DEFAULTS, view: 'tree' })
  })
  it('returns defaults when storage access throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(loadSettings()).toEqual(DEFAULTS)
    spy.mockRestore()
  })
})

describe('saveSettings', () => {
  it('silently ignores write failures', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    expect(() => saveSettings(DEFAULTS)).not.toThrow()
    spy.mockRestore()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --run tests/lib/settings.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/settings`.

- [ ] **Step 3: Implement the module**

Create `src/lib/settings.ts`:

```ts
export interface Settings {
  showFurigana: boolean
  view: 'arcs' | 'tree'
  rate: number
}

export const DEFAULTS: Settings = { showFurigana: false, view: 'arcs', rate: 1 }

const KEY = 'ayaki-settings'
const RATE_MIN = 0.5
const RATE_MAX = 1.5

/** One validator per field: returns the (normalized) value, or undefined to fall
 *  back to that field's default. Future fields (voiceURI, locale) are added here. */
const validators: { [K in keyof Settings]: (v: unknown) => Settings[K] | undefined } = {
  showFurigana: (v) => (typeof v === 'boolean' ? v : undefined),
  view: (v) => (v === 'arcs' || v === 'tree' ? v : undefined),
  rate: (v) =>
    typeof v === 'number' && Number.isFinite(v)
      ? Math.min(RATE_MAX, Math.max(RATE_MIN, v))
      : undefined,
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ...DEFAULTS }
    }
    const obj = parsed as Record<string, unknown>
    return {
      showFurigana: validators.showFurigana(obj.showFurigana) ?? DEFAULTS.showFurigana,
      view: validators.view(obj.view) ?? DEFAULTS.view,
      rate: validators.rate(obj.rate) ?? DEFAULTS.rate,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // best-effort: private mode, quota, or disabled storage — never break the app
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --run tests/lib/settings.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/settings.ts tests/lib/settings.test.ts
git commit -m "feat: settings module with validated localStorage persistence"
```

---

### Task 2: App wiring

**Files:**
- Modify: `src/components/App.svelte` (state declarations, lines 11–18)
- Test: `tests/components/App.test.ts`

**Interfaces:**
- Consumes (from Task 1): `loadSettings(): Settings`, `saveSettings(s: Settings): void` from `src/lib/settings.ts`.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

In `tests/components/App.test.ts`, extend the existing `beforeEach` from

```ts
beforeEach(() => vi.mocked(parseText).mockReset())
```

to

```ts
beforeEach(() => {
  vi.mocked(parseText).mockReset()
  localStorage.clear()
})
```

then append inside `describe('App', …)`:

```ts
  it('restores settings from localStorage and persists changes', async () => {
    localStorage.setItem('ayaki-settings', JSON.stringify({ showFurigana: true, view: 'tree', rate: 1.2 }))
    const user = userEvent.setup()
    render(App)
    const furigana = screen.getByRole('checkbox', { name: /furigana/i })
    expect(furigana).toBeChecked()
    expect(screen.getByRole('button', { name: /tree/ })).toHaveAttribute('aria-pressed', 'true')
    expect((screen.getByRole('slider', { name: /speech rate/i }) as HTMLInputElement).value).toBe('1.2')
    await user.click(furigana)
    await tick()
    expect(JSON.parse(localStorage.getItem('ayaki-settings')!)).toEqual({
      showFurigana: false,
      view: 'tree',
      rate: 1.2,
    })
  })
```

and add `tick` to the svelte import at the top of the file — there is no svelte import yet, so add:

```ts
import { tick } from 'svelte'
```

(`tick()` flushes pending `$effect`s so the localStorage write is observable.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run tests/components/App.test.ts`
Expected: the new test FAILS on `expect(furigana).toBeChecked()` (settings not restored); the existing tests still pass.

- [ ] **Step 3: Wire App.svelte**

In `src/components/App.svelte`, add to the imports:

```ts
  import { loadSettings, saveSettings } from '../lib/settings'
```

Replace the three settings state declarations

```ts
  let showFurigana = $state(false)
  let view = $state<'arcs' | 'tree'>('arcs')
  let rate = $state(1)
```

with

```ts
  const initialSettings = loadSettings()
  let showFurigana = $state(initialSettings.showFurigana)
  let view = $state<'arcs' | 'tree'>(initialSettings.view)
  let rate = $state(initialSettings.rate)

  $effect(() => {
    saveSettings({ showFurigana, view, rate })
  })
```

(The `$effect` tracks all three and also runs once on mount, harmlessly writing the just-loaded values back. The other state declarations — `inputText`, `sentences`, `status`, `errorMsg`, `selection`, `activeSentence` — stay untouched.)

- [ ] **Step 4: Run the full suite and type check**

Run: `npm test -- --run && npm run check`
Expected: all tests PASS (the new one included), svelte-check 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/App.svelte tests/components/App.test.ts
git commit -m "feat: persist toolbar settings across reloads"
```

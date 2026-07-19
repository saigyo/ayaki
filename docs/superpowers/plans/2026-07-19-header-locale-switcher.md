# Header Locale Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the locale selector from the toolbar to a bare globe icon in the app header next to the app name; clicking the globe opens the native language dropdown (no caret).

**Architecture:** A new `LocaleSwitcher.svelte` renders a visible 🌐 glyph with an invisible native `<select>` stretched over it, so a click on the globe opens the platform picker. `App.svelte` mounts it in a new header `.brand` group beside the `h1`; `Toolbar.svelte` loses its locale block. No settings/i18n logic changes.

**Tech Stack:** Svelte 5 (runes), TypeScript, vitest + @testing-library/svelte (jsdom).

**Spec:** `docs/superpowers/specs/2026-07-19-header-locale-switcher-design.md`

## Global Constraints

- The resting control shows ONLY the globe glyph `🌐` — no caret, no border, no box (spec: "no caret symbol").
- The `<select>` must stay in focus order and hit-testing: hide it with `opacity: 0; position: absolute; inset: 0; width: 100%; height: 100%; cursor: pointer` — NEVER `display: none` or `visibility: hidden`.
- Option list order and labels exactly: `Auto (browser)` equivalent via `t('localeAuto')`, then endonyms `English`, `Deutsch`, `日本語`, `中文`.
- The select's accessible name is `t('localeLabel')` (en: `language`) — unchanged from the toolbar version, so existing App-level tests keep finding it by that name.
- Per-option `selected` attributes, NOT `bind:value` (existing pattern).
- `onchange` validates with `SUPPORTED_LOCALES.includes(...)`; empty/unknown value → `null`.
- `src/lib/settings.ts`, `src/lib/i18n.svelte.ts`, and all locale catalogs are NOT modified.
- Focus ring renders on the wrapper via `.locale-switcher:has(select:focus-visible)` (the select itself is invisible).
- Conventional Commit messages; commit after each green test cycle.
- All commands run from the repo root `/Users/markus/IdeaProjects/ayaki`.

---

### Task 1: LocaleSwitcher component

**Files:**
- Create: `src/components/LocaleSwitcher.svelte`
- Modify: `src/app.css` (append two rule groups; do NOT touch existing rules in this task)
- Test: `tests/components/LocaleSwitcher.test.ts`

**Interfaces:**
- Consumes: `t`, `type Locale`, `SUPPORTED_LOCALES` from `src/lib/i18n.svelte.ts` (existing).
- Produces: `LocaleSwitcher` component with props `{ locale = $bindable(null) }: { locale?: Locale | null }` — Task 2 mounts it in `App.svelte` as `<LocaleSwitcher bind:locale />`.

- [ ] **Step 1: Write the failing tests**

Create `tests/components/LocaleSwitcher.test.ts`:

```ts
// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import LocaleSwitcher from '../../src/components/LocaleSwitcher.svelte'
import { setStoredLocale } from '../../src/lib/i18n.svelte'

describe('LocaleSwitcher', () => {
  afterEach(() => setStoredLocale('en'))

  it('renders a decorative globe and an accessibly named select', () => {
    setStoredLocale('en')
    const { container } = render(LocaleSwitcher, { props: { locale: null } })
    const globe = container.querySelector('.locale-switcher [aria-hidden="true"]')
    expect(globe?.textContent).toBe('🌐')
    expect(screen.getByRole('combobox', { name: 'language' })).toBeInTheDocument()
  })

  it('lists auto plus the four languages named in themselves', () => {
    setStoredLocale('en')
    render(LocaleSwitcher, { props: { locale: null } })
    const select = screen.getByRole('combobox', { name: 'language' }) as HTMLSelectElement
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Auto (browser)', 'English', 'Deutsch', '日本語', '中文',
    ])
    expect(select.value).toBe('')
  })

  it('shows the stored locale selected', () => {
    setStoredLocale('en')
    render(LocaleSwitcher, { props: { locale: 'ja' } })
    expect((screen.getByRole('combobox', { name: 'language' }) as HTMLSelectElement).value).toBe('ja')
  })

  it('maps codes to codes and auto to null on change', async () => {
    setStoredLocale('en')
    const user = userEvent.setup()
    render(LocaleSwitcher, { props: { locale: 'de' } })
    const select = screen.getByRole('combobox', { name: 'language' }) as HTMLSelectElement
    expect(select.value).toBe('de')
    await user.selectOptions(select, '')
    expect(select.value).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/LocaleSwitcher.test.ts`
Expected: FAIL — cannot resolve `../../src/components/LocaleSwitcher.svelte`.

- [ ] **Step 3: Write the component and CSS**

Create `src/components/LocaleSwitcher.svelte`:

```svelte
<script lang="ts">
  import { t, type Locale, SUPPORTED_LOCALES } from '../lib/i18n.svelte'

  let { locale = $bindable(null) }: { locale?: Locale | null } = $props()

  const LOCALE_NAMES: Record<Locale, string> = { en: 'English', de: 'Deutsch', ja: '日本語', zh: '中文' }
</script>

<span class="locale-switcher">
  <span aria-hidden="true">🌐</span>
  <select
    aria-label={t('localeLabel')}
    onchange={(e) => {
      const v = e.currentTarget.value
      locale = SUPPORTED_LOCALES.includes(v as Locale) ? (v as Locale) : null
    }}
  >
    <option value="" selected={locale === null}>{t('localeAuto')}</option>
    {#each SUPPORTED_LOCALES as l}
      <option value={l} selected={l === locale}>{LOCALE_NAMES[l]}</option>
    {/each}
  </select>
</span>
```

Append to `src/app.css` (after the `.toolbar` rules, before `main`):

```css
.brand { display: flex; align-items: center; gap: 0.5rem; }
.locale-switcher { position: relative; display: inline-flex; align-items: center; justify-content: center; font-size: 1.1rem; padding: 0.15rem 0.3rem; border-radius: 6px; }
.locale-switcher:hover { background: var(--accent-soft); }
.locale-switcher:has(select:focus-visible) { outline: 2px solid var(--accent); outline-offset: 1px; }
.locale-switcher select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; border: none; }
```

(The `.brand` rule is used by Task 2's header markup; adding it here keeps all new CSS in one commit and is inert until then.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/LocaleSwitcher.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full check**

Run: `npm test && npm run check`
Expected: all suites PASS, svelte-check 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/LocaleSwitcher.svelte src/app.css tests/components/LocaleSwitcher.test.ts
git commit -m "feat: add LocaleSwitcher globe component"
```

---

### Task 2: Mount in header, strip Toolbar

**Files:**
- Modify: `src/components/App.svelte:79-83` (header block; also add the import)
- Modify: `src/components/Toolbar.svelte` (remove locale prop + block)
- Modify: `src/app.css:21` (drop `select.locale` from the selector list)
- Test: `tests/components/App.test.ts`, `tests/components/Toolbar.test.ts`

**Interfaces:**
- Consumes: `LocaleSwitcher` from Task 1 (`{ locale = $bindable(null) }`).
- Produces: final header structure `header > .brand > (h1, LocaleSwitcher)` + `header > Toolbar`. Toolbar props shrink to `{ showFurigana, view, rate, voiceURI }`.

- [ ] **Step 1: Write the failing test**

In `tests/components/App.test.ts`, add inside the main `describe` (after the test `'switches chrome and glosses when the locale changes, without re-parsing'`):

```ts
it('places the locale switcher in the header brand, not the toolbar', () => {
  render(App)
  const select = screen.getByRole('combobox', { name: 'language' })
  expect(select.closest('.brand')).not.toBeNull()
  expect(select.closest('.toolbar')).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/App.test.ts -t 'places the locale switcher'`
Expected: FAIL — `select.closest('.brand')` is null (selector still lives in the toolbar).

- [ ] **Step 3: Update App.svelte**

In `src/components/App.svelte`, add the import after the Toolbar import:

```ts
import LocaleSwitcher from './LocaleSwitcher.svelte'
```

Replace the header block

```svelte
<header>
  <h1><span lang="ja">文木</span> Ayaki</h1>
  <Toolbar bind:showFurigana bind:view bind:rate bind:voiceURI bind:locale />
</header>
```

with

```svelte
<header>
  <div class="brand">
    <h1><span lang="ja">文木</span> Ayaki</h1>
    <LocaleSwitcher bind:locale />
  </div>
  <Toolbar bind:showFurigana bind:view bind:rate bind:voiceURI />
</header>
```

- [ ] **Step 4: Strip Toolbar.svelte**

In `src/components/Toolbar.svelte`:

- Change the i18n import to `import { t } from '../lib/i18n.svelte'` (drop `Locale`, `SUPPORTED_LOCALES`).
- Remove `locale = $bindable(null),` from the destructuring and `locale?: Locale | null` from the props type.
- Delete the `LOCALE_NAMES` constant.
- Delete the entire `<label class="locale-wrap">…</label>` block (the last element in `.toolbar`).

In `src/app.css` line 21, change

```css
.toolbar select.voice, .toolbar select.locale { border: 1px solid var(--box-stroke); background: #fff; padding: 0.25rem; border-radius: 6px; max-width: 11rem; }
```

to

```css
.toolbar select.voice { border: 1px solid var(--box-stroke); background: #fff; padding: 0.25rem; border-radius: 6px; max-width: 11rem; }
```

- [ ] **Step 5: Update Toolbar tests**

In `tests/components/Toolbar.test.ts`, the `describe('Toolbar locale selector', …)` block (lines 73–101):

- Delete the tests `'lists auto plus the four languages named in themselves'` and `'maps auto to null and codes to codes on change'` (both moved to `LocaleSwitcher.test.ts` in Task 1).
- Keep `'localizes the toolbar chrome'` (it tests the toolbar's own chrome, not the selector) and rename the describe to `describe('Toolbar localization', …)`. Keep its `afterEach(() => setStoredLocale('en'))`.

The resulting block:

```ts
describe('Toolbar localization', () => {
  afterEach(() => setStoredLocale('en'))

  it('localizes the toolbar chrome', () => {
    setStoredLocale('de')
    render(Toolbar, { props: { ...base } })
    expect(screen.getByText(/Furigana/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Baum$/ })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Sprechtempo' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run the affected suites**

Run: `npx vitest run tests/components/App.test.ts tests/components/Toolbar.test.ts tests/components/LocaleSwitcher.test.ts`
Expected: PASS. Note: the existing App tests `'switches chrome and glosses…'` and `'renders a stored locale on first paint…'` must pass UNCHANGED — the select keeps its accessible name; if they fail, the component broke a contract, do not edit those tests to make them pass.

- [ ] **Step 7: Run the full check**

Run: `npm test && npm run check`
Expected: all suites PASS, svelte-check 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/App.svelte src/components/Toolbar.svelte src/app.css tests/components/App.test.ts tests/components/Toolbar.test.ts
git commit -m "feat: move locale switcher to header globe, strip toolbar select"
```

---

### Task 3: README screenshot refresh (controller-run, not a subagent task)

The first README screenshot (`docs/images/screenshot.png`) shows the old toolbar with the locale select. After Tasks 1–2 are approved:

- [ ] **Step 1:** Build and preview (`npm run build -- --base=/ayaki/`, `npx vite preview --base=/ayaki/`), retake the arcs screenshot with the browser at the same viewport as before (1200×800), parsing the two-sentence example used previously. Verify the globe is visible next to "文木 Ayaki" and the toolbar has no locale select.
- [ ] **Step 2:** Update the alt text in `README.md:19` to mention the header globe language switcher instead of implying the selector is in the toolbar (the current alt text mentions only the voice selector — adjust the trailing phrase to "…the voice selector in the toolbar and the language globe in the header").
- [ ] **Step 3:** Commit: `git add docs/images/screenshot.png README.md && git commit -m "docs: refresh screenshot for header locale switcher"`.

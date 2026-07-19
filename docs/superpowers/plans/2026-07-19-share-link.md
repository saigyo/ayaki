# Share Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "share link" button that encodes text + view + sentence/bunsetsu selection in a URL; opening the link auto-parses, applies the view display-only, and jumps to the shared selection — without touching stored settings.

**Architecture:** New pure module `src/lib/share.ts` (build/parse, table-validated); App boot reads `location.search`, auto-parses, applies a one-shot pending jump, and suppresses view persistence until the first deliberate view click (new `onviewclick` Toolbar callback); Inspector gets a `shareUrl` prop and a clipboard-copy button in both cards.

**Tech Stack:** Svelte 5 (runes), TypeScript, vitest + @testing-library/svelte (jsdom), Playwright scripts.

**Spec:** `docs/superpowers/specs/2026-07-19-share-link-design.md`

## Global Constraints

- URL params: `text` (required), `view` (always), `s` (only when a bunsetsu is selected, or active sentence > 0), `b` (only with a selection; parse-side, `b` without `s` defaults the sentence to 0). Validation forgiving: bad `view` → null (stored view used, NO suppression); malformed indices → null; missing/blank `text` → whole result null (normal app start).
- Opening a link never writes the link's view to localStorage: the save effect writes `storedView` (the boot-time stored value) while `viewFromLink` is true; ANY view-button click (even re-selecting the shared view) re-arms via `onviewclick`.
- Out-of-range `s`/`b` against the actual parse are dropped silently; the address bar is never rewritten.
- The share URL encodes the last **parsed** text (`parsedText`, recorded in `handleParse`), never the live textarea draft.
- Clipboard: `navigator.clipboard.writeText`; unavailable/rejected → `window.prompt(t('shareButton'), shareUrl)`. Copied-state reverts after 2 s.
- Exactly 2 new catalog keys ×4: `shareButton` (en `share link`, de `Link teilen`, ja `リンクを共有`, zh `分享链接`), `shareCopied` (en `copied!`, de `kopiert!`, ja `コピーしました`, zh `已复制`).
- `settings.ts`, `SentenceCard.svelte`, views, parser, HelpDialog are NOT modified.
- All three README screenshots regenerate via `npm run shots` (sentence card gains a button).
- Existing tests untouched except where a step below explicitly says otherwise. Assertions never weakened.
- Conventional Commits; the local git hook adds the Co-Authored-By trailer — do not add trailers manually.
- All commands run from the repo root `/Users/markus/IdeaProjects/ayaki`.

---

### Task 1: Share module + catalog keys

**Files:**
- Create: `src/lib/share.ts`
- Modify: `src/lib/locales/{en,de,ja,zh}.ts` (2 keys each, appended at the end of the object)
- Test: Create `tests/lib/share.test.ts`

**Interfaces:**
- Consumes: `type ViewKind` from `src/lib/settings.ts`.
- Produces: `buildShareUrl(base: string, text: string, view: ViewKind, sentence: number | null, bunsetsu: number | null): string` and `parseShareParams(search: string): ShareParams | null` with `interface ShareParams { text: string; view: ViewKind | null; sentence: number | null; bunsetsu: number | null }` — Tasks 2 and 3 import these; `t('shareButton')`/`t('shareCopied')` for Task 3.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/share.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildShareUrl, parseShareParams } from '../../src/lib/share'

const BASE = 'https://example.test/ayaki/'

describe('buildShareUrl', () => {
  it('always carries text and view, nothing else by default', () => {
    const u = new URL(buildShareUrl(BASE, '猫が魚を食べた。', 'arcs', null, null))
    expect(u.origin + u.pathname).toBe(BASE)
    expect(u.searchParams.get('text')).toBe('猫が魚を食べた。')
    expect(u.searchParams.get('view')).toBe('arcs')
    expect(u.searchParams.get('s')).toBeNull()
    expect(u.searchParams.get('b')).toBeNull()
  })
  it('round-trips text containing separators and newlines', () => {
    const text = 'a&b=c+d?e\n二文目。'
    const parsed = parseShareParams(new URL(buildShareUrl(BASE, text, 'tree', null, null)).search)
    expect(parsed?.text).toBe(text)
    expect(parsed?.view).toBe('tree')
  })
  it('encodes a selection in sentence 0 as s=0&b=n', () => {
    const u = new URL(buildShareUrl(BASE, 'x', 'cabocha', 0, 4))
    expect(u.searchParams.get('s')).toBe('0')
    expect(u.searchParams.get('b')).toBe('4')
  })
  it('encodes an active later sentence without selection as s only', () => {
    const u = new URL(buildShareUrl(BASE, 'x', 'arcs', 2, null))
    expect(u.searchParams.get('s')).toBe('2')
    expect(u.searchParams.get('b')).toBeNull()
  })
})

describe('parseShareParams', () => {
  it('returns null without a text param or with blank text', () => {
    expect(parseShareParams('')).toBeNull()
    expect(parseShareParams('?view=tree')).toBeNull()
    expect(parseShareParams('?text=%20%20')).toBeNull()
  })
  it('nulls an unknown view and keeps the text', () => {
    const p = parseShareParams('?text=x&view=sideways')
    expect(p?.text).toBe('x')
    expect(p?.view).toBeNull()
  })
  it('rejects malformed indices', () => {
    expect(parseShareParams('?text=x&s=-1')?.sentence).toBeNull()
    expect(parseShareParams('?text=x&s=1.5')?.sentence).toBeNull()
    expect(parseShareParams('?text=x&b=x')?.bunsetsu).toBeNull()
  })
  it('defaults the sentence to 0 when only b is present', () => {
    const p = parseShareParams('?text=x&b=3')
    expect(p?.sentence).toBe(0)
    expect(p?.bunsetsu).toBe(3)
  })
})
```

Run: `npx vitest run tests/lib/share.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 2: Create `src/lib/share.ts`**

```ts
import type { ViewKind } from './settings'

export interface ShareParams {
  text: string
  view: ViewKind | null
  sentence: number | null
  bunsetsu: number | null
}

/** base is location.origin + location.pathname (keeps /ayaki/ and preview ports) */
export function buildShareUrl(
  base: string,
  text: string,
  view: ViewKind,
  sentence: number | null,
  bunsetsu: number | null,
): string {
  const p = new URLSearchParams()
  p.set('text', text)
  p.set('view', view)
  if (bunsetsu !== null) {
    p.set('s', String(sentence ?? 0))
    p.set('b', String(bunsetsu))
  } else if (sentence !== null && sentence > 0) {
    p.set('s', String(sentence))
  }
  return `${base}?${p.toString()}`
}

export function parseShareParams(search: string): ShareParams | null {
  const p = new URLSearchParams(search)
  const text = p.get('text')
  if (!text || !text.trim()) return null
  const rawView = p.get('view')
  const view = rawView === 'arcs' || rawView === 'tree' || rawView === 'cabocha' ? rawView : null
  const idx = (raw: string | null) => (raw !== null && /^\d+$/.test(raw) ? Number(raw) : null)
  const bunsetsu = idx(p.get('b'))
  // b defaults its sentence to 0 when s is absent
  const sentence = idx(p.get('s')) ?? (bunsetsu !== null ? 0 : null)
  return { text, view, sentence, bunsetsu }
}
```

- [ ] **Step 3: Catalog keys**

Append at the end of each catalog object (after the `helpTipSpeak` line):

`src/lib/locales/en.ts`:
```ts
  // share
  shareButton: 'share link',
  shareCopied: 'copied!',
```
`src/lib/locales/de.ts`:
```ts
  // share
  shareButton: 'Link teilen',
  shareCopied: 'kopiert!',
```
`src/lib/locales/ja.ts`:
```ts
  // share
  shareButton: 'リンクを共有',
  shareCopied: 'コピーしました',
```
`src/lib/locales/zh.ts`:
```ts
  // share
  shareButton: '分享链接',
  shareCopied: '已复制',
```

- [ ] **Step 4: Verify**

Run: `npx vitest run tests/lib/share.test.ts tests/lib/i18n.test.ts`, then `npm test && npm run check`
Expected: PASS, 0 errors 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add src/lib/share.ts src/lib/locales tests/lib/share.test.ts
git commit -m "feat: share url build/parse module and catalog keys"
```

---

### Task 2: Open flow — App boot, pending jump, persistence suppression

**Files:**
- Modify: `src/components/App.svelte`, `src/components/Toolbar.svelte`
- Test: `tests/components/App.test.ts` (new describe block), `tests/components/Toolbar.test.ts` (one added test; read both first)

**Interfaces:**
- Consumes: `parseShareParams` from Task 1.
- Produces: App boots from a share URL; `Toolbar` gains optional prop `onviewclick?: () => void` (invoked on every view-button click). Task 3 relies on `handleParse`'s success path staying the single parse pipeline.

- [ ] **Step 1: Write the failing tests**

In `tests/components/App.test.ts` add a new describe block (reuse the file's existing mocks/fixtures; `sentenceFixture` has 3 bunsetsu 猫が/魚を/食べた。, `chainSentenceFixture` has 4):

```ts
describe('App — share links', () => {
  afterEach(() => history.replaceState(null, '', location.pathname))

  it('boots from a share link: auto-parses, applies the view display-only, selects the bunsetsu', async () => {
    history.replaceState(null, '', `?text=${encodeURIComponent('猫が魚を食べた。')}&view=cabocha&s=0&b=1`)
    vi.mocked(parseText).mockResolvedValue([sentenceFixture()])
    render(App)
    await screen.findByText('食べた。')
    expect(vi.mocked(parseText)).toHaveBeenCalledWith('猫が魚を食べた。')
    expect(document.querySelector('main svg.stairview')).not.toBeNull()
    expect(document.querySelector('main g.bunsetsu.selected')?.getAttribute('aria-label')).toBe('魚を')
    await tick()
    expect(JSON.parse(localStorage.getItem('ayaki-settings')!).view).toBe('arcs')
  })

  it('re-arms view persistence on the first deliberate view click, even re-selecting the shared view', async () => {
    history.replaceState(null, '', `?text=${encodeURIComponent('猫が魚を食べた。')}&view=cabocha`)
    vi.mocked(parseText).mockResolvedValue([sentenceFixture()])
    const user = userEvent.setup()
    render(App)
    await screen.findByText('食べた。')
    await tick()
    expect(JSON.parse(localStorage.getItem('ayaki-settings')!).view).toBe('arcs')
    await user.click(screen.getByRole('button', { name: /CaboCha/ }))
    await tick()
    expect(JSON.parse(localStorage.getItem('ayaki-settings')!).view).toBe('cabocha')
  })

  it('drops an out-of-range bunsetsu index but still parses and shows the text', async () => {
    history.replaceState(null, '', `?text=${encodeURIComponent('猫が魚を食べた。')}&view=tree&s=0&b=9`)
    vi.mocked(parseText).mockResolvedValue([sentenceFixture()])
    render(App)
    await screen.findByText('食べた。')
    expect(document.querySelector('main svg line.edge')).not.toBeNull()
    expect(document.querySelector('main g.bunsetsu.selected')).toBeNull()
  })

  it('activates a later sentence from s in a multi-sentence link', async () => {
    history.replaceState(null, '', `?text=${encodeURIComponent('猫が魚を食べた。新しい映画を見に行きました。')}&view=arcs&s=1&b=1`)
    vi.mocked(parseText).mockResolvedValue([sentenceFixture(), chainSentenceFixture()])
    render(App)
    await screen.findByText('行きました。')
    expect(screen.getByRole('heading', { name: 'Sentence 2 / 2' })).toBeInTheDocument()
    expect(document.querySelector('main g.bunsetsu.selected')?.getAttribute('aria-label')).toBe('映画を')
  })
})
```

In `tests/components/Toolbar.test.ts` add (following the file's existing render style):

```ts
  it('reports every deliberate view click via onviewclick, including the current view', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(Toolbar, { props: { showFurigana: false, view: 'arcs', onviewclick: spy } })
    await user.click(screen.getByRole('button', { name: /arcs/ }))
    expect(spy).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: /tree/ }))
    expect(spy).toHaveBeenCalledTimes(2)
  })
```

Run: `npx vitest run tests/components/App.test.ts tests/components/Toolbar.test.ts`
Expected: the five new tests FAIL; everything else passes.

- [ ] **Step 2: Toolbar callback**

In `src/components/Toolbar.svelte`, extend the props:

```ts
  let {
    showFurigana = $bindable(),
    view = $bindable(),
    onviewclick = () => {},
  }: {
    showFurigana: boolean
    view: ViewKind
    onviewclick?: () => void
  } = $props()
```

and change the three view buttons' handlers to also invoke it:

```svelte
    <button class:active={view === 'arcs'} aria-pressed={view === 'arcs'} onclick={() => { view = 'arcs'; onviewclick() }}>⌒ {t('viewArcs')}</button>
    <button class:active={view === 'tree'} aria-pressed={view === 'tree'} onclick={() => { view = 'tree'; onviewclick() }}>🌳 {t('viewTree')}</button>
    <button class:active={view === 'cabocha'} aria-pressed={view === 'cabocha'} onclick={() => { view = 'cabocha'; onviewclick() }}>🎃 {t('viewCabocha')}</button>
```

- [ ] **Step 3: App boot + jump + suppression**

In `src/components/App.svelte`:

a) Import: add `import { parseShareParams } from '../lib/share'` next to the other lib imports.

b) After the `let chainColor = …` line, insert:

```ts
  const shareParams = parseShareParams(location.search)
  const storedView = initialSettings.view
  let viewFromLink = $state(Boolean(shareParams?.view))
  let pendingJump: { sentence: number | null; bunsetsu: number | null } | null = shareParams
    ? { sentence: shareParams.sentence, bunsetsu: shareParams.bunsetsu }
    : null
  let cardEls: HTMLElement[] = []

  if (shareParams) {
    inputText = shareParams.text
    if (shareParams.view) view = shareParams.view
    void handleParse()
  }
```

(`handleParse` is a hoisted function declaration — calling it here is fine.)

c) The save effect writes the stored view while suppressed — replace its body:

```ts
  $effect(() => {
    saveSettings({ showFurigana, showConfidence, view: viewFromLink ? storedView : view, rate, voiceURI, locale, chainColor })
  })
```

d) In `handleParse`, after `status = 'ready'`, add `applyPendingJump()`, and add the function:

```ts
  /** one-shot: applies the share link's target after the first successful parse */
  function applyPendingJump() {
    if (!pendingJump) return
    const { sentence: s, bunsetsu: b } = pendingJump
    pendingJump = null
    if (s === null || s >= sentences.length) return
    activeSentence = s
    if (b !== null && b < sentences[s].bunsetsu.length) selection = { sentence: s, bunsetsu: b }
    // jsdom has no scrollIntoView — optional call
    if (s > 0) cardEls[s]?.scrollIntoView?.({ block: 'center' })
  }
```

e) Header: `<Toolbar bind:showFurigana bind:view onviewclick={() => (viewFromLink = false)} />`

f) Wrap each card in a bindable slot (plain block div; layout-neutral in the column flow):

```svelte
        {#each sentences as sentence, i (i)}
          <div class="card-slot" bind:this={cardEls[i]}>
            <SentenceCard
              {sentence}
              {view}
              {showFurigana}
              {showConfidence}
              {chainColor}
              active={sentences.length > 1 && activeSentence === i}
              selected={selection?.sentence === i ? selection.bunsetsu : null}
              onselect={(b) => select(i, b)}
              onactivate={() => activate(i)}
            />
          </div>
        {/each}
```

- [ ] **Step 4: Run the affected suites, then the full check**

Run: `npx vitest run tests/components/App.test.ts tests/components/Toolbar.test.ts`
Expected: PASS. (If an existing App test breaks on the new `.card-slot` wrapper, inspect it — the wrapper must be transparent to `.card`/svg queries; report any needed change instead of silently adapting assertions.)
Then: `npm test && npm run check`
Expected: PASS, 0 errors 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add src/components/App.svelte src/components/Toolbar.svelte tests/components/App.test.ts tests/components/Toolbar.test.ts
git commit -m "feat: open share links — auto-parse, display-only view, pending jump"
```

---

### Task 3: Share button, live-check, screenshots

**Files:**
- Modify: `src/components/App.svelte` (parsedText + shareUrl + prop pass), `src/components/Inspector.svelte` (shareUrl prop + button in both cards), `scripts/live-check.mjs` (tenth check)
- Test: `tests/components/Inspector.test.ts` (new describe block; read first)
- Regenerate: `docs/images/screenshot.png`, `docs/images/screenshot-tree.png`, `docs/images/screenshot-cabocha.png`

**Interfaces:**
- Consumes: `buildShareUrl` from Task 1; `handleParse` success path from Task 2.
- Produces: `Inspector` prop `shareUrl?: string` (default `''`); the copy button with accessible name `share link` (en).

- [ ] **Step 1: Write the failing tests**

In `tests/components/Inspector.test.ts`, add a describe block. Clipboard note: stub via `Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })` and click with `fireEvent` (NOT userEvent — its clipboard interception conflicts); restore by defining `undefined` in `afterEach`. Imports needed: `fireEvent`, `vi`.

```ts
describe('Inspector — share button', () => {
  const setClipboard = (value: unknown) =>
    Object.defineProperty(navigator, 'clipboard', { value, configurable: true })
  afterEach(() => {
    setClipboard(undefined)
    vi.useRealTimers()
  })

  it('copies the share url and flips the label for two seconds', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText })
    render(Inspector, { props: { sentence, index: 0, total: 1, selected: null, rate: 1, voiceURI: null, shareUrl: 'https://x/?text=a' } })
    await fireEvent.click(screen.getByRole('button', { name: 'share link' }))
    expect(writeText).toHaveBeenCalledWith('https://x/?text=a')
    await vi.waitFor(() => expect(screen.getByText('copied!')).toBeInTheDocument())
    await vi.advanceTimersByTimeAsync(2100)
    expect(screen.queryByText('copied!')).toBeNull()
    expect(screen.getByRole('button', { name: 'share link' })).toBeInTheDocument()
  })

  it('falls back to window.prompt without a clipboard', async () => {
    setClipboard(undefined)
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue(null)
    render(Inspector, { props: { sentence, index: 0, total: 1, selected: null, rate: 1, voiceURI: null, shareUrl: 'https://x/?text=a' } })
    await fireEvent.click(screen.getByRole('button', { name: 'share link' }))
    await vi.waitFor(() => expect(prompt).toHaveBeenCalledWith('share link', 'https://x/?text=a'))
    prompt.mockRestore()
  })

  it('offers the share button on the bunsetsu card too', () => {
    render(Inspector, { props: { sentence, index: 0, total: 1, selected: sentence.bunsetsu[1], rate: 1, voiceURI: null, shareUrl: 'https://x/?text=a&b=1' } })
    expect(screen.getByRole('button', { name: 'share link' })).toBeInTheDocument()
  })
})
```

Run: `npx vitest run tests/components/Inspector.test.ts`
Expected: the three new tests FAIL (no share button yet).

- [ ] **Step 2: Inspector — prop, snippet, both cards**

In `src/components/Inspector.svelte`:

a) Add `shareUrl = ''` to the destructured props and `shareUrl?: string` to the type.

b) In the script, add:

```ts
  let copied = $state(false)
  let copyTimer: ReturnType<typeof setTimeout> | undefined

  async function copyShare() {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(shareUrl)
      copied = true
      clearTimeout(copyTimer)
      copyTimer = setTimeout(() => (copied = false), 2000)
    } catch {
      window.prompt(t('shareButton'), shareUrl)
    }
  }
```

c) Define one snippet (top of the markup, before `<aside>`), used by both cards:

```svelte
{#snippet shareButton()}
  <button aria-live="polite" onclick={copyShare}>
    {#if copied}{t('shareCopied')}
    {:else}<span class="emoji" aria-hidden="true">🔗</span> {t('shareButton')}{/if}
  </button>
{/snippet}
```

d) Sentence card: render it inside the existing `.actions` div, after the Google Translate link: `{@render shareButton()}`.

e) Bunsetsu card: after the `{#each selected.morphemes …}{/each}` block, add:

```svelte
    <div class="actions">
      {@render shareButton()}
    </div>
```

- [ ] **Step 3: App — parsedText, shareUrl, prop pass**

In `src/components/App.svelte`:

a) Import `buildShareUrl` (extend the Task 2 import line).

b) Add `let parsedText = $state('')` next to the other state; in `handleParse`, directly after `sentences = await parseText(inputText)`, add `parsedText = inputText`.

c) Add the derived:

```ts
  const shareUrl = $derived(
    buildShareUrl(
      location.origin + location.pathname,
      parsedText,
      view,
      selection ? selection.sentence : activeSentence > 0 ? activeSentence : null,
      selection ? selection.bunsetsu : null,
    ),
  )
```

d) Pass it: `<Inspector sentence={activeVM} … {showConfidence} {shareUrl} />`

- [ ] **Step 4: Tenth live-check**

In `scripts/live-check.mjs`, inside `if (booted)`, directly after the help try/catch, add:

The earlier `views` check deliberately clicked the CaboCha button, so the
page's stored view is legitimately `cabocha` at this point — the share link
therefore uses a DIFFERENT view (`tree`) and asserts the stored value is
unchanged by the navigation:

```js
    try {
      // the views check above stored 'cabocha' via real clicks — capture it,
      // open a *tree* share link, and assert the store is untouched
      const viewBefore = await page.evaluate(
        () => JSON.parse(localStorage.getItem('ayaki-settings') ?? '{}').view ?? null,
      )
      const share = new URL(target)
      share.searchParams.set('text', '猫が魚を食べた。')
      share.searchParams.set('view', 'tree')
      share.searchParams.set('s', '0')
      share.searchParams.set('b', '1')
      await page.goto(share.toString(), { waitUntil: 'networkidle' })
      await page.waitForSelector('main g.bunsetsu', { timeout: 60_000 })
      const state = await page.evaluate(() => ({
        tree: !!document.querySelector('main svg line.edge'),
        selected: document.querySelector('main g.bunsetsu.selected')?.getAttribute('aria-label') ?? null,
        storedView: JSON.parse(localStorage.getItem('ayaki-settings') ?? '{}').view ?? null,
      }))
      if (!state.tree || state.selected !== '魚を' || state.storedView !== viewBefore)
        throw new Error(`before=${viewBefore} after=${JSON.stringify(state)}`)
      ok('share: link opens tree with 魚を selected, stored view untouched')
    } catch (e) {
      fail('share', String(e))
    }
```

- [ ] **Step 5: Run suites, full gates, live-check against a preview**

Run: `npx vitest run tests/components/Inspector.test.ts tests/components/App.test.ts`, then `npm test && npm run check`
Expected: PASS, 0 errors 0 warnings.
Then verify the live-check locally:

```bash
npm run build -- --base=/ayaki/
npx vite preview --base=/ayaki/ --port 4183 &
npm run live-check -- http://localhost:4183/ayaki/
kill %1
```

Expected: 10 ok lines including `ok share: …`, `live-check passed`.

- [ ] **Step 6: Regenerate ALL three README screenshots**

Run: `npm run shots`
Verify via `git status` all three changed; open one PNG and confirm the sentence card shows the share button next to Google Translate.

- [ ] **Step 7: Commit**

```bash
git add src/components/App.svelte src/components/Inspector.svelte scripts/live-check.mjs tests/components/Inspector.test.ts docs/images
git commit -m "feat: share link button with clipboard copy, share live-check, screenshots"
```

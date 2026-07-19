# Robustness Round Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six deferred minors from the PR #20/#21 final reviews: speech-toggle generation counter, Stop-stays-clickable, scoped `.emoji`, copied-reset on card switch, pendingJump consumed on failed boot parse, and a standing live-browser guard for the share scroll path.

**Architecture:** Point fixes in `Inspector.svelte`, `App.svelte`, `app.css`, `live-check.mjs`. No new modules, keys, or settings.

**Tech Stack:** Svelte 5 (runes), TypeScript, vitest + @testing-library/svelte (jsdom), Playwright scripts.

**Spec:** `docs/superpowers/specs/2026-07-19-robustness-round-design.md`

## Global Constraints

- `speech.ts`, `share.ts`, `settings.ts`, catalogs, views, `HelpDialog`, `Toolbar` are NOT modified. No screenshot regeneration (idle chrome unchanged).
- The generation counter lives in `Inspector.svelte`: EVERY toggle transition bumps it; a completion callback applies only when its generation is current.
- Toggle disabled condition becomes exactly `!canSpeak && !speaking`.
- `.emoji { line-height: 1; }` becomes `.inspector .emoji { line-height: 1; }` — nothing else in that rule.
- The copied-reset effect reads `selected` (only) and clears both the flag and the timer.
- `App.svelte`'s `handleParse` catch adds `pendingJump = null` — nothing else in the error path changes.
- The eleventh live-check opens a NEW 900×300 page (two cards cannot fit), asserts 公園で selected + second card active + second `.card-slot` box within the 300px viewport + `scrollY > 0`, and closes the page in a `finally`.
- Existing tests untouched except: the `InspectorSpeak` speech mock's `speechAvailable` becomes settable via `vi.hoisted` state (same default `true` — no existing assertion changes).
- Conventional Commits; the local git hook adds the Co-Authored-By trailer — do not add trailers manually.
- All commands run from the repo root `/Users/markus/IdeaProjects/ayaki`.

---

### Task 1: Inspector robustness (items 1–4)

**Files:**
- Modify: `src/components/Inspector.svelte`, `src/app.css` (one selector)
- Test: `tests/components/InspectorSpeak.test.ts` (mock rework + 2 new tests), `tests/components/Inspector.test.ts` (1 new test in the share describe; read both first)

**Interfaces:**
- Consumes: existing `speak(text, rate, voiceURI, onDone?)` contract.
- Produces: no interface changes — behavior fixes only.

- [ ] **Step 1: Rework the speech mock to be settable**

In `tests/components/InspectorSpeak.test.ts`, replace the mock block

```ts
vi.mock('../../src/lib/speech', () => ({
  speak: vi.fn(),
  stopSpeech: vi.fn(),
  speechAvailable: () => true,
}))
```

with

```ts
const speechState = vi.hoisted(() => ({ available: true }))
vi.mock('../../src/lib/speech', () => ({
  speak: vi.fn(),
  stopSpeech: vi.fn(),
  speechAvailable: () => speechState.available,
}))
```

and extend the reset hooks (add `afterEach` to the vitest import):

```ts
beforeEach(() => {
  vi.clearAllMocks()
  speechState.available = true
})
afterEach(() => vi.unstubAllGlobals())
```

(This replaces the existing `beforeEach(vi.clearAllMocks)` line.)

- [ ] **Step 2: Write the two failing speech tests**

Append to the `Inspector speak pass-through` describe:

```ts
  it('ignores a stale onDone from a superseded utterance', async () => {
    const user = userEvent.setup()
    render(Inspector, { props: { sentence, index: 0, total: 1, selected: null, rate: 1, voiceURI: null } })
    const btn = screen.getByRole('button', { name: /speak/i })
    await user.click(btn) // speak A
    const onDoneA = vi.mocked(speak).mock.calls.at(-1)![3] as () => void
    await user.click(btn) // stop
    await user.click(btn) // speak B
    expect(btn.textContent).toContain('Stop')
    onDoneA() // A's end event arrives late (fired by the cancel)
    await tick()
    expect(btn.textContent).toContain('Stop') // B is still playing
    const onDoneB = vi.mocked(speak).mock.calls.at(-1)![3] as () => void
    onDoneB()
    await tick()
    expect(btn.textContent).toContain('Speak')
  })

  it('keeps Stop clickable when voices vanish mid-utterance', async () => {
    const listeners: Array<() => void> = []
    vi.stubGlobal('speechSynthesis', {
      addEventListener: (_t: string, f: () => void) => listeners.push(f),
      removeEventListener: vi.fn(),
    })
    const user = userEvent.setup()
    render(Inspector, { props: { sentence, index: 0, total: 1, selected: null, rate: 1, voiceURI: null } })
    const btn = screen.getByRole('button', { name: /speak/i })
    await user.click(btn)
    speechState.available = false
    listeners.forEach((f) => f())
    await tick()
    expect(btn.textContent).toContain('Stop')
    expect(btn).toBeEnabled()
    const onDone = vi.mocked(speak).mock.calls.at(-1)![3] as () => void
    onDone()
    await tick()
    expect(btn).toBeDisabled()
  })
```

- [ ] **Step 3: Write the failing copied-reset test**

In `tests/components/Inspector.test.ts`, append to the `Inspector — share button` describe:

```ts
  it('resets the copied label when the card switches', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText })
    const { rerender } = render(Inspector, { props: { sentence, index: 0, total: 1, selected: null, rate: 1, voiceURI: null, shareUrl: 'https://x/?text=a' } })
    await fireEvent.click(screen.getByRole('button', { name: 'share link' }))
    await vi.waitFor(() => expect(screen.getByText('copied!')).toBeInTheDocument())
    await rerender({ sentence, index: 0, total: 1, selected: sentence.bunsetsu[1], rate: 1, voiceURI: null, shareUrl: 'https://x/?text=a&b=1' })
    expect(screen.queryByText('copied!')).toBeNull()
    expect(screen.getByRole('button', { name: 'share link' })).toBeInTheDocument()
  })
```

Run: `npx vitest run tests/components/InspectorSpeak.test.ts tests/components/Inspector.test.ts`
Expected: the three new tests FAIL (stale onDone flips the toggle; disabled while speaking; copied survives the card switch); everything else passes.

- [ ] **Step 4: Implement in `Inspector.svelte`**

a) Replace the toggle block

```ts
  let speaking = $state(false)

  function toggleSpeech() {
    if (!sentence) return
    if (speaking) {
      stopSpeech()
      speaking = false
    } else {
      speak(sentence.text, rate, voiceURI, () => (speaking = false))
      speaking = true
    }
  }
```

with

```ts
  let speaking = $state(false)
  // bumped on every toggle transition: a completion callback from a superseded
  // utterance (its end fires asynchronously after cancel) must not flip the state
  let speakGen = 0

  function toggleSpeech() {
    if (!sentence) return
    if (speaking) {
      speakGen++
      stopSpeech()
      speaking = false
    } else {
      const gen = ++speakGen
      speak(sentence.text, rate, voiceURI, () => {
        if (gen === speakGen) speaking = false
      })
      speaking = true
    }
  }
```

b) The sentence-card toggle button's disabled attribute: `disabled={!canSpeak && !speaking}` (title stays `speakTitle`).

c) After the `copyTimer` declaration, add:

```ts
  // switching between the sentence and bunsetsu cards must not carry a stale
  // "copied!" onto a button that copied nothing
  $effect(() => {
    void selected
    clearTimeout(copyTimer)
    copied = false
  })
```

- [ ] **Step 5: Scope the emoji rule**

In `src/app.css`, change `.emoji { line-height: 1; }` to `.inspector .emoji { line-height: 1; }`.

- [ ] **Step 6: Run the affected suites, then the full check**

Run: `npx vitest run tests/components/InspectorSpeak.test.ts tests/components/Inspector.test.ts`, then `npm test && npm run check`
Expected: PASS, 0 errors 0 warnings.

- [ ] **Step 7: Commit**

```bash
git add src/components/Inspector.svelte src/app.css tests/components/InspectorSpeak.test.ts tests/components/Inspector.test.ts
git commit -m "fix: speech-toggle generation guard, live Stop without voices, copied reset on card switch"
```

---

### Task 2: pendingJump on failed parse + share-jump live-check

**Files:**
- Modify: `src/components/App.svelte` (one line), `scripts/live-check.mjs` (eleventh check)
- Test: `tests/components/App.test.ts` (1 new test in the share describe; read first)

**Interfaces:**
- Consumes: the existing `pendingJump` one-shot mechanics from the share feature.
- Produces: no interface changes.

- [ ] **Step 1: Write the failing test**

In `tests/components/App.test.ts`, append to the `App — share links` describe:

```ts
  it('discards the pending jump when the boot parse fails', async () => {
    history.replaceState(null, '', `?text=${encodeURIComponent('猫が魚を食べた。')}&view=arcs&s=0&b=1`)
    vi.mocked(parseText).mockRejectedValueOnce(new Error('dict failed'))
    const user = userEvent.setup()
    render(App)
    await screen.findByText(/dict failed/)
    vi.mocked(parseText).mockResolvedValue([chainSentenceFixture()])
    const box = screen.getByRole('textbox')
    await user.clear(box)
    await user.type(box, '新しい映画を見に行きました。')
    await user.click(screen.getByRole('button', { name: /parse/i }))
    await screen.findByText('行きました。')
    expect(document.querySelector('main g.bunsetsu.selected')).toBeNull()
  })
```

Run: `npx vitest run tests/components/App.test.ts -t 'discards the pending jump'`
Expected: FAIL — the stale jump currently applies a selection to the unrelated parse.

- [ ] **Step 2: Consume the jump in the error path**

In `src/components/App.svelte`'s `handleParse` catch block, add one line:

```ts
    } catch (e) {
      // the jump is one-shot per boot: a failed share-link parse must not
      // apply a stale selection to whatever the user parses next
      pendingJump = null
      errorMsg = e instanceof Error ? e.message : String(e)
      status = 'error'
    }
```

- [ ] **Step 3: Eleventh live-check**

In `scripts/live-check.mjs`, directly after the `share` try/catch (still inside `if (booted)`), add:

```js
    try {
      const jump = new URL(target)
      jump.searchParams.set('text', '猫が魚を食べた。犬は公園で遊んだ。')
      jump.searchParams.set('view', 'arcs')
      jump.searchParams.set('s', '1')
      jump.searchParams.set('b', '1')
      // a viewport too small for two cards — the scroll must actually happen
      const small = await browser.newPage({ viewport: { width: 900, height: 300 }, locale: 'en-US' })
      try {
        await small.goto(jump.toString(), { waitUntil: 'networkidle' })
        await small.waitForFunction(() => document.querySelectorAll('.card-slot').length === 2, null, { timeout: 60_000 })
        await small.waitForTimeout(400)
        const state = await small.evaluate(() => {
          const card = document.querySelectorAll('.card-slot')[1].getBoundingClientRect()
          return {
            selected: document.querySelector('main g.bunsetsu.selected')?.getAttribute('aria-label') ?? null,
            active: document.querySelectorAll('.card')[1]?.classList.contains('active') ?? false,
            top: Math.round(card.top),
            bottom: Math.round(card.bottom),
            scrollY: Math.round(window.scrollY),
          }
        })
        if (state.selected !== '公園で' || !state.active || state.top < 0 || state.bottom > 300 || state.scrollY <= 0)
          throw new Error(JSON.stringify(state))
        ok('share jump: s=1 card scrolled into a 300px viewport')
      } finally {
        await small.close()
      }
    } catch (e) {
      fail('share jump', String(e))
    }
```

- [ ] **Step 4: Run suites, full gates, live-check against a preview**

Run: `npx vitest run tests/components/App.test.ts`, then `npm test && npm run check`
Expected: PASS, 0 errors 0 warnings.
Then:

```bash
npm run build -- --base=/ayaki/
npx vite preview --base=/ayaki/ --port 4189 &
npm run live-check -- http://localhost:4189/ayaki/
kill %1
```

Expected: 11 ok lines including `ok share jump: …`, `live-check passed`.

- [ ] **Step 5: Commit**

```bash
git add src/components/App.svelte scripts/live-check.mjs tests/components/App.test.ts
git commit -m "fix: discard stale share jump on failed parse; guard the scroll path in live-check"
```

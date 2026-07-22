# Three-Band Page Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the app's top-level page into three optically distinct bands — header, text-entry, and results — separated by thin hairline rules, giving the input full width, top-aligning the parse button, and aligning the inspector to the top of the first view box.

**Architecture:** Pull `SentenceInput` and its status messages out of the two-column grid into a full-width `.entry` band directly under a `<main>` landmark. Render the results grid (view cards + inspector) only when `status === 'ready'`. Two `<hr class="rule">` separators mark the band boundaries. Pure markup + CSS; no component logic, settings, or copy changes.

**Tech Stack:** Svelte 5, Vite, TypeScript, Vitest + @testing-library/svelte (jsdom), Playwright (live-check / smoke / readme-shots).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-22-ui-three-band-layout-design.md`.
- The results grid must stay wrapped in `<main>`; the help demo stays in `<header>`. All `main`-scoped DOM queries in tests and Playwright scripts must keep passing unchanged.
- Hairline rules are `1px solid var(--box-stroke)` (#b9c4d8), full content width, matching the footer's existing top border.
- Grid stays `grid-template-columns: 1fr 320px`, collapsing to one column at `max-width: 800px`.
- No new settings, no share-link changes, no new user-facing strings — status copy is unchanged, it only moves position.
- Every commit ends with the trailers:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01Voux9xAA4KsJZ2oNHHVjGh`

---

### Task 1: Three-band restructure (markup + CSS + component tests)

**Files:**
- Modify: `src/components/App.svelte:135-194` (the `<div class="app">` template block)
- Modify: `src/app.css:36-42` (the `main` grid and `.sentence-input` rules) and add a `.rule` rule near line 15
- Test: `tests/components/App.test.ts` (add four structural tests)

**Interfaces:**
- Consumes: existing `status` states `'idle' | 'loading' | 'ready' | 'error'`; existing components `SentenceInput`, `SentenceCard`, `Inspector`; existing classes `.sentence-input`, `.card`, `.card-slot`, `.inspector`, `.hint`, `.loading`, `.error-banner`.
- Produces: new DOM contract — `.entry` band (contains `.sentence-input` + status messages), `.results` grid (contains `.cards` + `.inspector`) rendered only when `status === 'ready'`, and `hr.rule` separators (one when idle/loading/error, two when ready). `<main>` wraps `.entry` and (when present) `.results`.

- [ ] **Step 1: Write the failing structural tests**

Add these four tests inside the `describe('App', …)` block in `tests/components/App.test.ts` (after the existing `it('shows the attribution footer', …)` test):

```ts
  it('shows the entry band but no results grid before the first parse', () => {
    render(App)
    expect(document.querySelector('.entry .sentence-input')).not.toBeNull()
    expect(document.querySelector('.results')).toBeNull()
    // only the header↔entry rule exists before results
    expect(document.querySelectorAll('hr.rule')).toHaveLength(1)
  })
  it('lays out three bands after a parse: entry outside a results grid, two rules', async () => {
    vi.mocked(parseText).mockResolvedValue([sentenceFixture()])
    const user = userEvent.setup()
    const { container } = render(App)
    await user.type(screen.getByRole('textbox'), '猫が魚を食べた。')
    await user.click(screen.getByRole('button', { name: /parse/i }))
    await screen.findByText('食べた。')
    const results = container.querySelector('.results')!
    expect(results).not.toBeNull()
    // the results grid holds the cards and the inspector...
    expect(results.querySelector('.cards')).not.toBeNull()
    expect(results.querySelector('.inspector')).not.toBeNull()
    // ...but NOT the input — that lives in the full-width entry band above
    expect(results.querySelector('.sentence-input')).toBeNull()
    const entry = container.querySelector('.entry')!
    expect(entry.querySelector('.sentence-input')).not.toBeNull()
    // entry precedes results in document order
    expect(entry.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // header↔entry and entry↔results rules
    expect(container.querySelectorAll('hr.rule')).toHaveLength(2)
  })
  it('shows no results grid while loading', async () => {
    let resolveParse: (v: ReturnType<typeof sentenceFixture>[]) => void = () => {}
    vi.mocked(parseText).mockImplementation(() => new Promise((r) => { resolveParse = r }))
    const user = userEvent.setup()
    const { container } = render(App)
    await user.type(screen.getByRole('textbox'), '猫。')
    await user.click(screen.getByRole('button', { name: /parse/i }))
    // loading: no results grid yet, still a single rule
    expect(container.querySelector('.results')).toBeNull()
    expect(container.querySelectorAll('hr.rule')).toHaveLength(1)
    resolveParse([sentenceFixture()])
    await screen.findByText('食べた。')
    expect(container.querySelector('.results')).not.toBeNull()
  })
  it('shows the error banner in the entry band with no results grid', async () => {
    vi.mocked(parseText).mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    const { container } = render(App)
    await user.type(screen.getByRole('textbox'), '猫。')
    await user.click(screen.getByRole('button', { name: /parse/i }))
    await screen.findByText(/boom/)
    expect(container.querySelector('.entry .error-banner')).not.toBeNull()
    expect(container.querySelector('.results')).toBeNull()
    expect(container.querySelectorAll('hr.rule')).toHaveLength(1)
  })
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run tests/components/App.test.ts -t "band"`
Expected: FAIL — the current markup has no `.entry`, `.results`, or `hr.rule` elements (queries return null / wrong counts).

- [ ] **Step 3: Restructure the App template**

In `src/components/App.svelte`, replace the entire `<div class="app"> … </div>` block (lines 135-194) with:

```svelte
<div class="app">
  <header>
    <div class="brand">
      <h1><span lang="ja">文木</span> Ayaki</h1>
      <LocaleSwitcher bind:locale />
    </div>
    <Toolbar bind:showFurigana bind:view onviewclick={() => (viewFromLink = false)} />
    <HelpDialog {chainColor} />
    <SettingsMenu bind:rate bind:voiceURI bind:showConfidence bind:confidenceThreshold bind:quietParts bind:relationDisplay bind:arrowDirection bind:chainColor />
  </header>
  <hr class="rule" />
  <main>
    <section class="entry">
      <SentenceInput bind:text={inputText} busy={status === 'loading'} onparse={handleParse} />
      {#if status === 'idle'}
        <p class="hint">
          {t('idleHint')}
          <button class="linklike" data-testid="example-link" onclick={parseExample}>{t('exampleLink')}</button>
        </p>
      {:else if status === 'loading'}
        <p class="loading">
          {parserReady() ? t('loadingParse') : t('loadingDict')}
        </p>
      {:else if status === 'error'}
        <div class="error-banner">
          <p>{t('initError', { message: errorMsg })}</p>
          <button onclick={handleParse}>{t('retry')}</button>
        </div>
      {/if}
    </section>
    {#if status === 'ready'}
      <hr class="rule" />
      <div class="results">
        <section class="cards">
          {#each sentences as sentence, i (i)}
            <div class="card-slot" bind:this={cardEls[i]}>
              <SentenceCard
                {sentence}
                {view}
                {showFurigana}
                {showConfidence}
                {confidenceThreshold}
                {chainColor}
                {relationDisplay}
                {arrowDirection}
                active={sentences.length > 1 && activeSentence === i}
                selected={selection?.sentence === i ? selection.bunsetsu : null}
                onselect={(b) => select(i, b)}
                onactivate={() => activate(i)}
              />
            </div>
          {/each}
        </section>
        <Inspector sentence={activeVM} index={activeSentence} total={sentences.length} selected={selectedBunsetsu} {rate} {voiceURI} {showConfidence} {confidenceThreshold} {quietParts} {showFurigana} {shareUrl} />
      </div>
    {/if}
  </main>
  <footer>
    <p>
      {t('footerParsing')} <a href="https://github.com/iatosh/sasara">sasara</a> (MIT) —
      {t('footerModel')} <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>,
      {t('footerDerived')} <a href="https://github.com/UniversalDependencies/UD_Japanese-GSD">UD Japanese-GSD</a> —
      {t('footerMorphology')} <a href="https://github.com/takuyaa/kuromoji.js">kuromoji.js</a> (Apache-2.0)
      {t('footerDict')}. {t('footerSelf')}
    </p>
  </footer>
</div>
```

The changes from the original: the `<hr class="rule" />` after `</header>`; the old `<section class="content">` becomes a `<main>` containing a full-width `<section class="entry">` (input + status only); the results — a second `<hr class="rule" />` plus a `.results` grid wrapping a new `.cards` section and the `Inspector` — are gated behind `{#if status === 'ready'}`; the `Inspector` moves from a direct child of `<main>` into `.results`.

- [ ] **Step 4: Update the CSS**

In `src/app.css`, replace the two `main` rules (lines 36-37):

```css
main { display: grid; grid-template-columns: 1fr 320px; gap: 1rem; align-items: start; }
@media (max-width: 800px) { main { grid-template-columns: 1fr; } }
```

with:

```css
.results { display: grid; grid-template-columns: 1fr 320px; gap: 1rem; align-items: start; }
@media (max-width: 800px) { .results { grid-template-columns: 1fr; } }
```

Change the `.sentence-input` rule (line 39) from:

```css
.sentence-input { display: flex; gap: 0.5rem; align-items: flex-end; margin-bottom: 1rem; }
```

to (top-align the button; the rules now provide the vertical separation):

```css
.sentence-input { display: flex; gap: 0.5rem; align-items: flex-start; }
```

Add the hairline-rule style immediately after the `.app` rule (after line 15):

```css
.rule { border: 0; border-top: 1px solid var(--box-stroke); margin: 1rem 0; }
```

- [ ] **Step 5: Run the new tests to verify they pass**

Run: `npx vitest run tests/components/App.test.ts -t "band"`
Expected: PASS (all four new tests green).

- [ ] **Step 6: Run the full App suite to confirm no regressions**

Run: `npx vitest run tests/components/App.test.ts`
Expected: PASS — including the existing `main`-scoped tests (confidence styling, cabocha `main svg.stairview`, chain trace, share-link boot) which still resolve because the diagrams remain inside `<main>`.

- [ ] **Step 7: Run the whole unit suite + type check**

Run: `npm test && npm run check`
Expected: PASS — full suite green, `svelte-check` reports 0 errors.

- [ ] **Step 8: Browser smoke gate on the built bundle**

Run: `npm run build -- --base=/ayaki/ && npm run smoke`
Expected: `[smoke]` output ends with success (parse renders ≥5 bunsetsu against the real bundle). This is the standing guard that markup/CSS changes didn't break bundling or first-paint.

- [ ] **Step 9: Commit**

```bash
git add src/components/App.svelte src/app.css tests/components/App.test.ts
git commit -m "$(cat <<'EOF'
feat: three-band page layout — header, entry, results

Pull the input out of the grid into a full-width entry band, top-align the
parse button, and render the results grid (cards + inspector) only once a
parse succeeds. Two hairline rules mark the band boundaries; the inspector
now starts level with the first view box. Results stay inside <main>.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Voux9xAA4KsJZ2oNHHVjGh
EOF
)"
```

---

### Task 2: Browser layout verification + refreshed screenshots

**Files:**
- Modify: `scripts/live-check.mjs` (add an idle-layout check after boot and a ready-layout check after parse)
- Modify: `docs/images/screenshot.png`, `docs/images/screenshot-tree.png`, `docs/images/screenshot-cabocha.png` (regenerated)

**Interfaces:**
- Consumes: the DOM contract from Task 1 — `.entry .sentence-input`, `.results .card`, `.results .inspector`, `.sentence-input textarea`, `.sentence-input button`, `hr.rule`, `.app`.
- Produces: two new named live-check assertions, `layout idle` and `layout`.

- [ ] **Step 1: Add the idle-layout assertion**

In `scripts/live-check.mjs`, immediately after the boot success block (after the closing `}` of the `try { … ok('boot: page loads, example link present') } catch … }` on line 33, i.e. before `if (booted) {`), the page is still idle. Add this block **inside** `if (booted) {`, as its first statement (before the existing `parse` try-block on line 36):

```js
    try {
      const idle = await page.evaluate(() => ({
        results: !!document.querySelector('main .results'),
        entry: !!document.querySelector('main .entry .sentence-input'),
        rules: document.querySelectorAll('hr.rule').length,
      }))
      if (idle.results || !idle.entry || idle.rules !== 1) throw new Error(JSON.stringify(idle))
      ok('layout idle: entry band, one rule, no results grid')
    } catch (e) {
      fail('layout idle', String(e))
    }
```

- [ ] **Step 2: Add the ready-layout assertion**

In `scripts/live-check.mjs`, immediately after the existing `parse` try-block (after its `catch` closes, following `ok(\`parse: example renders …\`)`), add:

```js
    try {
      const geo = await page.evaluate(() => {
        const r = (s) => document.querySelector(s)?.getBoundingClientRect() ?? null
        const card = r('main .results .card')
        const insp = r('main .results .inspector')
        const ta = r('.sentence-input textarea')
        const btn = r('.sentence-input button')
        if (!card || !insp || !ta || !btn) return null
        const contentWidth = insp.right - card.left
        return {
          inspectorNotAboveCard: insp.top >= card.top - 2,
          buttonTopAligned: Math.abs(btn.top - ta.top) <= 4,
          inputSpansWidth: ta.width >= contentWidth * 0.7,
          rules: document.querySelectorAll('hr.rule').length,
        }
      })
      if (!geo || !geo.inspectorNotAboveCard || !geo.buttonTopAligned || !geo.inputSpansWidth || geo.rules !== 2)
        throw new Error(JSON.stringify(geo))
      ok('layout: full-width input, top-aligned button, inspector level with first card, two rules')
    } catch (e) {
      fail('layout', String(e))
    }
```

- [ ] **Step 3: Verify the live-check script parses and runs against a local preview**

Run:
```bash
npm run build -- --base=/ayaki/ && (npx vite preview --base=/ayaki/ --port 5410 &) && sleep 3 && node scripts/live-check.mjs http://localhost:5410/ayaki/ ; kill %1 2>/dev/null
```
Expected: output includes `ok layout idle: …` and `ok layout: …`, and the run ends with `live-check passed`. (If the environment blocks backgrounded `sleep` chains, start the preview with the Bash tool's `run_in_background`, poll the port, then run `node scripts/live-check.mjs http://localhost:5410/ayaki/`.)

- [ ] **Step 4: Regenerate the README screenshots**

The three README screenshots show the full app chrome, so the layout change makes them stale.

Run: `npm run shots`
Expected: `written docs/images/screenshot.png`, `written docs/images/screenshot-tree.png`, `written docs/images/screenshot-cabocha.png`. Confirm all three now differ:

Run: `git status --porcelain docs/images/`
Expected: the three PNGs listed as modified (`M`).

- [ ] **Step 5: Commit**

```bash
git add scripts/live-check.mjs docs/images/screenshot.png docs/images/screenshot-tree.png docs/images/screenshot-cabocha.png
git commit -m "$(cat <<'EOF'
test: live-check layout assertions + refreshed screenshots

Assert the idle state shows the entry band with no results grid, and the
parsed state shows a full-width top-aligned input with the inspector level
with the first view box. Regenerate the README screenshots for the new layout.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Voux9xAA4KsJZ2oNHHVjGh
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- Three bands + hairline rules → Task 1 markup (`hr.rule` ×2) + CSS `.rule`. ✓
- Full-width input → Task 1 (`.entry` outside grid) + live-check `inputSpansWidth`. ✓
- Top-aligned button → Task 1 (`align-items: flex-start`) + live-check `buttonTopAligned`. ✓
- Inspector level with first view box → Task 1 (input leaves the grid) + live-check `inspectorNotAboveCard`. ✓
- Clean first load (results only when `ready`) → Task 1 `{#if status === 'ready'}` + tests (idle/loading/error) + live-check `layout idle`. ✓
- `<main>` wrapping results, help demo in header, `main`-scoped queries intact → Task 1 Step 6 runs the existing `main`-scoped tests. ✓
- No new settings/strings/share-link changes → nothing in either task touches settings, locales, or share. ✓
- Sticky inspector unchanged → `.inspector` rule untouched. ✓
- 800px collapse preserved → moved verbatim to `.results`. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output. ✓

**Type consistency:** No new types or signatures — only markup/CSS and test/JS additions. Class names are consistent across tasks: `.entry`, `.results`, `.cards`, `hr.rule`, `.sentence-input`. ✓

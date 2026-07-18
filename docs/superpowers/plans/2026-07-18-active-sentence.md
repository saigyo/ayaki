# Active Sentence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce an "active sentence" so the inspector's sentence view, Speak, Google Translate, and uncertainty note scope to one sentence, switchable by clicking a parse-tree card.

**Architecture:** `App.svelte` gains an `activeSentence` index alongside the existing `selection` state; `SentenceCard` gets `active`/`onactivate` props and an empty-space click handler; `Inspector` swaps its `fullText`/`sentences` props for the single active `ParsedSentence` (+ index/total). Bunsetsu clicks in the SVG views stop propagation so they never double-fire as card activation.

**Tech Stack:** Svelte 5 runes, TypeScript strict, vitest + @testing-library/svelte (jsdom via `// @vitest-environment jsdom`).

**Spec:** `docs/superpowers/specs/2026-07-18-active-sentence-design.md`

## Global Constraints

- Svelte 5 runes only (`$state`, `$derived`, `$props`); no legacy stores/reactive statements.
- After every parse, sentence 0 is active; selecting a bunsetsu also activates its sentence; card empty-space click activates the card's sentence AND clears the bunsetsu selection (also with a single sentence); Escape only clears the bunsetsu selection.
- The heavier active-card border is suppressed when there is only one sentence.
- Inspector heading is exactly `Sentence {i + 1} / {total}` when `total > 1`, else `Sentence`; uncertainty note is exactly `{n} of {m} attachments uncertain` (no `Sentence N:` prefix).
- The card's click target stays a non-focusable container (documented `svelte-ignore`); keyboard parity = Tab to a bunsetsu → Enter/Space selects (activates its sentence) → Escape deselects.
- Every commit message carries `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` (the repo's prepare-commit-msg hook appends it automatically — do not remove it).
- All existing tests must stay green: run `npm test` (and `npm run check` before finishing a task).

---

### Task 1: Bunsetsu clicks stop propagating

**Files:**
- Modify: `src/components/ArcDiagram.svelte:71` (the `onclick` in the `<g class="bunsetsu">` element)
- Modify: `src/components/NodeTree.svelte:65` (the `onclick` in the `<g class="bunsetsu">` element)
- Test: `tests/components/ArcDiagram.test.ts`, `tests/components/NodeTree.test.ts`

**Interfaces:**
- Consumes: existing `onselect: (index: number) => void` prop of both components.
- Produces: bunsetsu click events no longer bubble past the component root; Task 3's card-level click handler relies on this.

- [ ] **Step 1: Write the failing tests**

Append inside `describe('ArcDiagram', …)` in `tests/components/ArcDiagram.test.ts` (the file already imports `render`, `vi`, and builds `bunsetsu` from `sentenceFixture()`):

```ts
  it('does not let bunsetsu clicks bubble out of the component', () => {
    const onselect = vi.fn()
    const outer = vi.fn()
    const { container, getByText } = render(ArcDiagram, { props: { bunsetsu, onselect } })
    container.addEventListener('click', outer)
    getByText('魚を').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onselect).toHaveBeenCalledWith(1)
    expect(outer).not.toHaveBeenCalled()
  })
```

Append the same test inside `describe('NodeTree', …)` in `tests/components/NodeTree.test.ts`, with `NodeTree` instead of `ArcDiagram` (props are identical).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --run tests/components/ArcDiagram.test.ts tests/components/NodeTree.test.ts`
Expected: the two new tests FAIL on `expect(outer).not.toHaveBeenCalled()`; all others pass.

- [ ] **Step 3: Stop propagation in both components**

In `src/components/ArcDiagram.svelte`, change

```svelte
        onclick={() => onselect(i)}
```

to

```svelte
        onclick={(e) => {
          e.stopPropagation()
          onselect(i)
        }}
```

In `src/components/NodeTree.svelte`, change

```svelte
        onclick={() => onselect(n.index)}
```

to

```svelte
        onclick={(e) => {
          e.stopPropagation()
          onselect(n.index)
        }}
```

Leave the `onkeydown` handlers untouched (keyboard events are not click events and the card has no key handler).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --run tests/components/ArcDiagram.test.ts tests/components/NodeTree.test.ts`
Expected: PASS (all tests in both files).

- [ ] **Step 5: Commit**

```bash
git add src/components/ArcDiagram.svelte src/components/NodeTree.svelte tests/components/ArcDiagram.test.ts tests/components/NodeTree.test.ts
git commit -m "feat: stop bunsetsu click propagation in SVG views"
```

---

### Task 2: SentenceCard activation

**Files:**
- Modify: `src/components/SentenceCard.svelte`
- Modify: `src/app.css:37` (add a rule after the existing `.card` rule)
- Test: create `tests/components/SentenceCard.test.ts`

**Interfaces:**
- Consumes: `ArcDiagram`/`NodeTree` with propagation-stopping bunsetsu clicks (Task 1).
- Produces: `SentenceCard` props `active?: boolean` (default `false`) and `onactivate?: () => void` (default no-op) — Task 3 passes both. The props are optional so the component keeps compiling and rendering before App is wired up.

- [ ] **Step 1: Write the failing tests**

Create `tests/components/SentenceCard.test.ts`:

```ts
// @vitest-environment jsdom
import { render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import SentenceCard from '../../src/components/SentenceCard.svelte'
import { sentenceFixture } from '../fixtures'

const base = {
  sentence: sentenceFixture(),
  view: 'arcs' as const,
  showFurigana: false,
  selected: null,
  onselect: () => {},
}

describe('SentenceCard', () => {
  it('fires onactivate when the empty card space is clicked', () => {
    const onactivate = vi.fn()
    const { container } = render(SentenceCard, { props: { ...base, onactivate } })
    const card = container.querySelector('.card')!
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onactivate).toHaveBeenCalledTimes(1)
  })
  it('does not fire onactivate when a bunsetsu is clicked', () => {
    const onactivate = vi.fn()
    const onselect = vi.fn()
    const { getByText } = render(SentenceCard, { props: { ...base, onselect, onactivate } })
    getByText('魚を').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onselect).toHaveBeenCalledWith(1)
    expect(onactivate).not.toHaveBeenCalled()
  })
  it('applies the active class only when active', () => {
    const active = render(SentenceCard, { props: { ...base, active: true } })
    expect(active.container.querySelector('.card')!.classList.contains('active')).toBe(true)
    const inactive = render(SentenceCard, { props: { ...base } })
    expect(inactive.container.querySelector('.card')!.classList.contains('active')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --run tests/components/SentenceCard.test.ts`
Expected: FAIL — `onactivate` never called (prop does not exist yet), `active` class missing.

- [ ] **Step 3: Implement the props and click handler**

Replace the full contents of `src/components/SentenceCard.svelte` with:

```svelte
<script lang="ts">
  import ArcDiagram from './ArcDiagram.svelte'
  import NodeTree from './NodeTree.svelte'
  import type { ParsedSentence } from '../lib/types'

  let {
    sentence,
    view,
    showFurigana,
    selected,
    onselect,
    active = false,
    onactivate = () => {},
  }: {
    sentence: ParsedSentence
    view: 'arcs' | 'tree'
    showFurigana: boolean
    selected: number | null
    onselect: (index: number) => void
    active?: boolean
    onactivate?: () => void
  } = $props()
</script>

<!-- Pointer-only convenience: keyboard users reach the same states via the bunsetsu
     buttons (Enter/Space selects and activates the sentence) and Escape (deselect).
     Making the card focusable would nest a widget around real buttons, which is
     worse for assistive technology. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="card" class:active onclick={onactivate}>
  {#if sentence.error}
    <p class="sentence-error"><span lang="ja">{sentence.text}</span> — could not parse: {sentence.error}</p>
  {:else if view === 'arcs'}
    <ArcDiagram bunsetsu={sentence.bunsetsu} {showFurigana} {selected} {onselect} />
  {:else}
    <NodeTree bunsetsu={sentence.bunsetsu} {showFurigana} {selected} {onselect} />
  {/if}
</div>
```

In `src/app.css`, directly after the existing `.card` rule (line 37), add:

```css
.card.active { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
```

(The inset shadow thickens the border to a visual 2px without changing layout.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --run tests/components/SentenceCard.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/SentenceCard.svelte src/app.css tests/components/SentenceCard.test.ts
git commit -m "feat: SentenceCard active state and empty-space activation click"
```

---

### Task 3: Active-sentence wiring in App and Inspector

**Files:**
- Modify: `src/components/App.svelte`
- Modify: `src/components/Inspector.svelte`
- Test: `tests/components/App.test.ts`, `tests/components/Inspector.test.ts`

**Interfaces:**
- Consumes: `SentenceCard` props `active` and `onactivate` (Task 2); propagation-stopped bunsetsu clicks (Task 1).
- Produces: `Inspector` props become `{ sentence: ParsedSentence | null, index: number, total: number, selected: BunsetsuVM | null, rate: number }`. `App.svelte` owns `activeSentence: number`.

- [ ] **Step 1: Rewrite the Inspector sentence-mode tests (failing)**

In `tests/components/Inspector.test.ts`, replace the `describe('Inspector — sentence mode', …)` block with:

```ts
describe('Inspector — sentence mode', () => {
  it('shows only the active sentence with speech, Translate and a confidence summary', () => {
    render(Inspector, { props: { sentence, index: 0, total: 1, selected: null, rate: 1 } })
    expect(screen.getByRole('heading', { name: 'Sentence' })).toBeInTheDocument()
    expect(screen.getByText(sentence.text)).toBeInTheDocument()
    const gt = screen.getByRole('link', { name: /google translate/i })
    expect(gt).toHaveAttribute('href', expect.stringContaining('translate.google.com'))
    expect(gt).toHaveAttribute('href', expect.stringContaining(encodeURIComponent(sentence.text)))
    // fixture has 1 uncertain of 2 non-root attachments; no "Sentence N:" prefix
    expect(screen.getByText('1 of 2 attachments uncertain')).toBeInTheDocument()
    // jsdom has no speechSynthesis → speech buttons disabled with explanation
    const speakBtn = screen.getByRole('button', { name: /speak/i })
    expect(speakBtn).toBeDisabled()
    expect(speakBtn).toHaveAttribute('title', expect.stringMatching(/no japanese voice/i))
  })
  it('numbers the heading when there are multiple sentences', () => {
    render(Inspector, { props: { sentence, index: 1, total: 3, selected: null, rate: 1 } })
    expect(screen.getByRole('heading', { name: 'Sentence 2 / 3' })).toBeInTheDocument()
  })
  it('shows a hint before anything was parsed', () => {
    render(Inspector, { props: { sentence: null, index: 0, total: 0, selected: null, rate: 1 } })
    expect(screen.getByText(/click a part/i)).toBeInTheDocument()
  })
})
```

In the `describe('Inspector — bunsetsu mode', …)` block, update every `render` call's props from
`{ fullText: …, sentences: […], selected: X, rate: 1 }` to
`{ sentence, index: 0, total: 1, selected: X, rate: 1 }`
(for the `forcedSentenceFixture()` render use `sentence: forced`; for the duplicate-morpheme render use `sentence: null`). The assertions stay unchanged.

- [ ] **Step 2: Run the Inspector tests to verify they fail**

Run: `npm test -- --run tests/components/Inspector.test.ts`
Expected: FAIL — Inspector still expects `fullText`/`sentences` props.

- [ ] **Step 3: Rewrite Inspector's props and sentence mode**

In `src/components/Inspector.svelte`, replace the `$props()` declaration with:

```ts
  let {
    sentence,
    index,
    total,
    selected,
    rate,
  }: {
    sentence: ParsedSentence | null
    index: number
    total: number
    selected: BunsetsuVM | null
    rate: number
  } = $props()
```

and add below the `speakTitle` derived:

```ts
  const uncertainCount = $derived(sentence ? sentence.bunsetsu.filter(isUncertain).length : 0)
```

Replace the whole `{:else}` (sentence-mode) branch of the template with:

```svelte
  {:else}
    <h2>{total > 1 ? `Sentence ${index + 1} / ${total}` : 'Sentence'}</h2>
    {#if sentence}
      <p class="full-text" lang="ja">{sentence.text}</p>
      <div class="actions">
        <button disabled={!canSpeak} title={speakTitle} onclick={() => speak(sentence.text, rate)}>🔊 Speak</button>
        <button onclick={stopSpeech}>⏹ Stop</button>
        <a href={googleTranslateUrl(sentence.text)} target="_blank" rel="noopener">Google Translate ↗</a>
      </div>
      {#if uncertainCount > 0}
        <p class="confidence-note">{uncertainCount} of {sentence.bunsetsu.length - 1} attachments uncertain</p>
      {/if}
    {:else}
      <p class="hint">Parse a sentence, then click a part of it to inspect readings and parts of speech.</p>
    {/if}
  {/if}
```

If `svelte-check` complains that `sentence` may be null inside the `onclick`/`href` expressions, hoist `{@const text = sentence.text}` right after `{#if sentence}` and use `text` in both places.

- [ ] **Step 4: Run the Inspector tests to verify they pass**

Run: `npm test -- --run tests/components/Inspector.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing App tests**

In `tests/components/App.test.ts`, add `forcedSentenceFixture` to the fixtures import, then append inside `describe('App', …)`:

```ts
  it('scopes the inspector to the active sentence and switches on card click', async () => {
    // two sentences: 猫が魚を食べた。 and これは何。
    vi.mocked(parseText).mockResolvedValue([sentenceFixture(), forcedSentenceFixture()])
    const user = userEvent.setup()
    const { container } = render(App)
    await user.type(screen.getByRole('textbox'), '猫が魚を食べた。これは何。')
    await user.click(screen.getByRole('button', { name: /解析/ }))
    // default: first sentence active, its full text in the inspector
    expect(await screen.findByText('猫が魚を食べた。')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sentence 1 / 2' })).toBeInTheDocument()
    expect(screen.queryByText('これは何。')).not.toBeInTheDocument()
    const cards = container.querySelectorAll('.card')
    expect(cards[0].classList.contains('active')).toBe(true)
    // clicking the second card's empty space switches the active sentence
    cards[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(await screen.findByText('これは何。')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sentence 2 / 2' })).toBeInTheDocument()
    expect(screen.queryByText('猫が魚を食べた。')).not.toBeInTheDocument()
    expect(cards[1].classList.contains('active')).toBe(true)
    expect(cards[0].classList.contains('active')).toBe(false)
  })
  it('activates a sentence when one of its bunsetsu is selected', async () => {
    vi.mocked(parseText).mockResolvedValue([sentenceFixture(), forcedSentenceFixture()])
    const user = userEvent.setup()
    render(App)
    await user.type(screen.getByRole('textbox'), 'x')
    await user.click(screen.getByRole('button', { name: /解析/ }))
    const box = await screen.findByText('これは')
    box.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    // bunsetsu mode for the clicked bunsetsu of sentence 2
    expect(await screen.findByRole('heading', { name: /これは/ })).toBeInTheDocument()
    // Escape returns to the sentence view of the now-active second sentence
    await user.keyboard('{Escape}')
    expect(await screen.findByText('これは何。')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sentence 2 / 2' })).toBeInTheDocument()
  })
  it('deselects the bunsetsu on empty-space click, also with a single sentence', async () => {
    vi.mocked(parseText).mockResolvedValue([sentenceFixture()])
    const user = userEvent.setup()
    const { container } = render(App)
    await user.type(screen.getByRole('textbox'), '猫が魚を食べた。')
    await user.click(screen.getByRole('button', { name: /解析/ }))
    const box = await screen.findByText('魚を')
    box.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(await screen.findByRole('heading', { name: /魚を/ })).toBeInTheDocument()
    const card = container.querySelector('.card')!
    // single sentence → no active border
    expect(card.classList.contains('active')).toBe(false)
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(await screen.findByRole('heading', { name: 'Sentence' })).toBeInTheDocument()
    expect(screen.getByText('猫が魚を食べた。')).toBeInTheDocument()
  })
  it('resets the active sentence on re-parse', async () => {
    vi.mocked(parseText).mockResolvedValue([sentenceFixture(), forcedSentenceFixture()])
    const user = userEvent.setup()
    const { container } = render(App)
    await user.type(screen.getByRole('textbox'), 'x')
    await user.click(screen.getByRole('button', { name: /解析/ }))
    await screen.findByText('これは')
    const cards = container.querySelectorAll('.card')
    cards[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(await screen.findByRole('heading', { name: 'Sentence 2 / 2' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /解析/ }))
    expect(await screen.findByRole('heading', { name: 'Sentence 1 / 2' })).toBeInTheDocument()
  })
```

Note for the implementer: `sentenceFixture().text` is `猫が魚を食べた。` whose full text appears ONLY in the inspector — the SVG renders per-bunsetsu surfaces (`猫が`, `魚を`, `食べた。`), so `queryByText('猫が魚を食べた。')` is a reliable "is this sentence's view shown" probe. `forcedSentenceFixture().text` is `これは何。` with bunsetsu `これは` and `何。`.

- [ ] **Step 6: Run the App tests to verify the new ones fail**

Run: `npm test -- --run tests/components/App.test.ts`
Expected: the 4 new tests FAIL (App still renders concatenated `fullText`, no `active` class, `Sentence 1 / 2` heading missing); the 5 existing tests still pass.

- [ ] **Step 7: Wire App.svelte**

In `src/components/App.svelte` apply these changes:

Add state (after the `selection` declaration):

```ts
  let activeSentence = $state(0)
```

In `handleParse()`, next to `selection = null`, add:

```ts
    activeSentence = 0
```

Replace `select()` and add `activate()`:

```ts
  function select(sentence: number, bunsetsu: number) {
    activeSentence = sentence
    selection =
      selection?.sentence === sentence && selection.bunsetsu === bunsetsu ? null : { sentence, bunsetsu }
  }

  function activate(i: number) {
    activeSentence = i
    selection = null
  }
```

Replace the `fullText` derived with:

```ts
  const activeVM = $derived(sentences[activeSentence] ?? null)
```

Update the `SentenceCard` usage in the `{#each}` block:

```svelte
          <SentenceCard
            {sentence}
            {view}
            {showFurigana}
            active={sentences.length > 1 && activeSentence === i}
            selected={selection?.sentence === i ? selection.bunsetsu : null}
            onselect={(b) => select(i, b)}
            onactivate={() => activate(i)}
          />
```

Update the `Inspector` usage:

```svelte
    <Inspector sentence={activeVM} index={activeSentence} total={sentences.length} selected={selectedBunsetsu} {rate} />
```

- [ ] **Step 8: Run all tests and the type check**

Run: `npm test -- --run && npm run check`
Expected: full suite PASS, svelte-check 0 errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/App.svelte src/components/Inspector.svelte tests/components/App.test.ts tests/components/Inspector.test.ts
git commit -m "feat: active sentence scopes inspector, speak and translate"
```

---

## Deviations

- **Task 1 test technique:** the plan's propagation tests attached the outer listener to the testing-library `container` — the same node Svelte 5 uses as its event-delegation root, where `stopPropagation()` from a delegated handler cannot suppress sibling listeners. The tests listen on `document.body` (one level above the delegation root) instead, with try/finally cleanup. Implementation unchanged.

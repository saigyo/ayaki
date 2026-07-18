# Active Sentence — Design

**Date:** 2026-07-18
**Status:** Approved

## Problem

When the input parses into multiple sentences, the inspector's "Sentence" box shows all
sentences concatenated. Speak, Google Translate, and the uncertainty notes likewise operate
on the whole input. With several parse trees on screen there is no notion of *which*
sentence the sidebar refers to.

## Solution overview

Introduce an **active sentence**. Exactly one parsed sentence is active at any time;
the inspector's sentence view, Speak, Google Translate, and the uncertainty note all
scope to it. The active parse-tree card is marked with a heavier border, matching the
visual language of the active bunsetsu.

## Behavior

- After every parse, sentence 0 is active.
- Clicking the empty space of a parse-tree card makes that sentence active **and**
  deselects any selected bunsetsu. With a bunsetsu selected, clicking the empty space
  of its own card therefore returns the sidebar to the sentence view. This applies
  equally when there is only one sentence.
- Selecting a bunsetsu (click or Enter/Space on the SVG button) also makes its
  sentence active. The inspector never shows a bunsetsu belonging to a non-active
  sentence.
- Escape keeps its existing meaning: deselect the bunsetsu. The active sentence is
  unchanged.
- Bunsetsu clicks inside the SVG stop propagation so they do not double-fire as
  card-activation clicks.

## Visuals

- The active card's border is slightly heavier/stronger than the others (same
  approach as the active-bunsetsu highlight).
- With only **one** sentence the heavier border is suppressed — "active" carries no
  information there — but the empty-space click still deselects the bunsetsu.

## Inspector changes

- Props change from `fullText: string` + `sentences: ParsedSentence[]` to the active
  `ParsedSentence` (plus its index and the total count).
- Sentence view shows only the active sentence's text.
- Speak speaks the active sentence; the Google Translate link carries only the active
  sentence's text.
- With multiple sentences the heading reads `Sentence 2 / 5`; with one sentence it
  stays `Sentence`.
- The uncertainty note shows only the active sentence's numbers, without the
  now-redundant `Sentence N:` prefix: `3 of 8 attachments uncertain`.

## Keyboard & accessibility

Keyboard parity comes from the existing interactive elements: Tab to any bunsetsu of
the target sentence, Enter/Space selects it (activating that sentence), Escape
deselects. The card's empty-space click is a pointer-only convenience on a
non-interactive container element; it gets a documented `svelte-ignore` rather than
being made a focusable widget (a focusable container with nested buttons is worse for
assistive technology).

## Component/state summary

- `App.svelte`: new `activeSentence = $state(0)`; reset to 0 in `handleParse()`;
  `select()` additionally sets `activeSentence`; new `activate(i)` handler that sets
  `activeSentence = i` and clears `selection`. Passes `active` + `onactivate` to each
  `SentenceCard`; passes the active sentence (+ index, count) to `Inspector`.
- `SentenceCard.svelte`: new props `active: boolean`, `onactivate: () => void`;
  root-level click handler; `class:active` styling.
- `ArcDiagram.svelte` / `NodeTree.svelte`: bunsetsu click handlers call
  `stopPropagation()`.
- `Inspector.svelte`: prop and scoping changes as above.

## Testing

Component tests (jsdom):

- Empty-space click on a card activates it and clears the bunsetsu selection.
- Bunsetsu click selects the bunsetsu and does NOT count as a card activation.
- Single-sentence case: empty-space click deselects the bunsetsu; no active border.
- Selecting a bunsetsu in a non-active sentence makes that sentence active.
- Re-parse resets the active sentence to 0.
- Inspector: text, Speak target, Translate URL, and uncertainty note all reflect only
  the active sentence; heading shows `Sentence i / n` for multiple sentences.

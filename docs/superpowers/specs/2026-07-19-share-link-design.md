# Share Link — Design

**Date:** 2026-07-19
**Status:** Approved

## Problem

A parsed sentence — including the chosen view and a selected sentence/bunsetsu
— should be shareable as a URL, in the spirit of the existing Google Translate
link. Opening a share link auto-parses the text, applies the view, and jumps
to the shared sentence/bunsetsu — **without overwriting any stored settings**.
Assumption (Markus): the parsing model is stable and deterministic, so
bunsetsu indices carry over; if that ever breaks, the worst case is a dropped
selection, never an error.

## URL format

Query parameters on the app URL (the Google Translate idiom; GitHub Pages
serves them unchanged):

```
https://saigyo.github.io/ayaki/?text=<urlencoded>&view=cabocha&s=1&b=2
```

| param | meaning | when included |
| --- | --- | --- |
| `text` | the full (multi-sentence) input text | always — required |
| `view` | `arcs` \| `tree` \| `cabocha` | always |
| `s` | sentence index (0-based) | when a bunsetsu is selected, or when the active sentence is > 0 |
| `b` | bunsetsu index (0-based) | only when a bunsetsu is selected |

## New module — `src/lib/share.ts`

Pure, unit-testable, no DOM access:

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

Validation is forgiving: unknown `view` → `null` (stored view used, no
persistence suppression), non-numeric/negative `s`/`b` → `null` (index
validation against the actual parse happens in App). A URL without `text`
is not a share link at all → `null`, normal app start.

## App integration — `src/components/App.svelte`

### Boot

```ts
const shareParams = parseShareParams(location.search)
```

When non-null:
- `inputText = shareParams.text`
- if `shareParams.view` is non-null: `view = shareParams.view` and
  `viewFromLink = true` (persistence suppression, below)
- auto-parse on mount: `void handleParse()` (the existing pipeline — the
  dictionary-loading message and error banner are reused unchanged)
- a one-shot `pendingJump` (the validated `sentence`/`bunsetsu`) is consumed
  at the end of `handleParse`'s success path:
  - clamp-validate: `s` must be `< sentences.length`, `b` must be
    `< sentences[s].bunsetsu.length`; anything out of range drops the
    respective part silently (text still parsed and shown)
  - apply: `activeSentence = s`; `selection = b !== null ? { sentence: s, bunsetsu: b } : null`
  - when `s > 0`, scroll the target card into view
    (`scrollIntoView({ block: 'center' })` on the card's element — App binds
    card wrapper elements in the existing `{#each}`)
- the address bar is left as-is (reloading re-opens the same shared state)

### Parsed text for sharing

`inputText` is live-bound to the textarea; the share URL must encode what was
**parsed**, not a draft edit. `handleParse` records `parsedText = inputText`
on success, and the share URL derives from `parsedText`:

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

passed to `Inspector` as a plain `shareUrl: string` prop (Inspector has no
access to the full input text — per-sentence `ParsedSentence.text` is only a
fragment of multi-sentence input).

### Settings isolation (Markus's decision: user click re-arms)

- `const storedView = initialSettings.view` is remembered at boot.
- While `viewFromLink` is true, the save `$effect` writes
  `view: storedView` instead of the live `view` — merely opening a link
  never touches localStorage.
- `Toolbar` gains an optional callback prop `onviewclick?: () => void`,
  invoked in each view button's click handler. App passes
  `() => (viewFromLink = false)` — the first *deliberate* view click re-arms
  normal persistence, **even when re-selecting the shared view** (a
  reactive-only detection could not distinguish that case).

## Share button — `src/components/Inspector.svelte`

New prop `shareUrl: string`. A share button appears in BOTH cards:
- sentence card: in the existing `.actions` row, after the Google Translate
  link
- bunsetsu card: in a new `.actions` row after the morpheme list (there it
  encodes the current selection via `shareUrl`)

```svelte
<button onclick={copyShare}>
  {#if copied}{t('shareCopied')}
  {:else}<span class="emoji" aria-hidden="true">🔗</span> {t('shareButton')}{/if}
</button>
```

- `copyShare`: `navigator.clipboard.writeText(shareUrl)`; on success set
  `copied = true` for 2 s (timeout, reset on re-click). If the clipboard API
  is unavailable or rejects, fall back to `window.prompt(t('shareButton'),
  shareUrl)` so the URL can be copied manually.
- The flipped label is announced: the button carries `aria-live="polite"`.
- One `copied` state serves both cards (only one is rendered at a time).

## Catalog — 2 new keys ×4

| key | en | de | ja | zh |
| --- | --- | --- | --- | --- |
| `shareButton` | share link | Link teilen | リンクを共有 | 分享链接 |
| `shareCopied` | copied! | kopiert! | コピーしました | 已复制 |

## Ripple effects

- **README screenshots:** scene 1's sentence card gains the share button —
  ALL THREE screenshots regenerate via `npm run shots` (standing rule).
- **`scripts/live-check.mjs`:** a tenth check `share` — navigate to
  `<target>?text=猫が魚を食べた。&view=cabocha&s=0&b=1`, wait for
  `main g.bunsetsu`, assert the stair view is rendered
  (`main svg.stairview`) and bunsetsu 1 carries the `selected` class;
  then assert `localStorage` has NOT stored `cabocha` as the view.

## Not changing

`settings.ts` (no new fields), catalogs beyond the 2 keys, the views,
`SentenceCard` (App binds wrapper elements around it), parser, HelpDialog.
The address bar is not live-updated while browsing (share is built on
demand) — YAGNI.

## Error handling

| Situation | Behavior |
| --- | --- |
| Shared text fails to parse | existing error banner; no selection applied; retry button works |
| `view` param invalid/missing | stored view used; no persistence suppression |
| `s`/`b` out of range for the actual parse | that part silently dropped, text still shown |
| `b` without `s` | `s` defaults to 0 |
| Clipboard API unavailable/rejected | `window.prompt` fallback with the URL |
| Share link opened with existing stored settings | all stored settings honored except the displayed view; nothing written |
| User edits text after parsing, then shares | the URL encodes the last **parsed** text |

## Testing

- `tests/lib/share.test.ts` (new): build/parse round-trips (Japanese text,
  `&`/`=`/`+`/newlines in text); `s`/`b` inclusion rules (selection in
  sentence 0 → `s=0&b=n`; active sentence 2 without selection → `s=2` only;
  single sentence no selection → neither); parse validation (missing/blank
  text → null; bad view → null view; `-1`/`1.5`/`x` indices → null;
  `b` without `s` → sentence 0).
- `tests/components/App.test.ts`: boot from a share URL (set
  `history.replaceState` search before render, `parseText` mocked):
  auto-parse called, view applied, selection + active sentence set after
  parse, localStorage `view` still the stored one after the save effect;
  out-of-range `b` dropped; view-button click re-arms persistence (then
  localStorage reflects the click).
- `tests/components/Inspector.test.ts` / `InspectorSpeak`-style clipboard
  mock: share button copies `shareUrl`, label flips to the localized
  copied-confirmation and reverts (fake timers), prompt fallback when
  clipboard is absent; the bunsetsu card also renders the share button.
- Catalog parity automatic (2 new keys).
- Final review live pass: full production-style round-trip — parse, select
  a bunsetsu, click share, capture the clipboard URL (or read it via a
  stubbed clipboard), open it in a NEW browser context, verify text parsed,
  view applied, bunsetsu selected, and stored settings untouched; plus
  scroll-into-view with a multi-sentence link.

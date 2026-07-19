# UI Quirks Round — Design

**Date:** 2026-07-19
**Status:** Approved

Five small, independent fixes. No new settings, no new catalog keys except
none (existing `speakButton`/`stopButton` are reused).

## 1. Forced attachments with a known probability are not "uncertain"

**Bug:** `isUncertain` (`src/lib/viewmodel.ts:10`) is
`b.forced || (b.probability !== null && b.probability < LOW_CONFIDENCE)` —
the `forced` flag unconditionally wins, so sasara's end-of-sentence fallback
(structurally the *only* possible attachment) renders dotted and counts as
uncertain even at P = 97 %.

**New semantics — probability wins when known:**

```ts
export function isUncertain(b: BunsetsuVM): boolean {
  return b.probability !== null ? b.probability < LOW_CONFIDENCE : b.forced
}
```

`LOW_CONFIDENCE` stays **0.7** (Markus's decision; a configurable threshold
is backlogged).

**Views follow `isUncertain` instead of the raw flag** — dashes appear only
when the attachment is actually uncertain; the `forced` dash pattern is kept
for the forced-and-uncertain case:

- `ArcDiagram.svelte:47-48` and `StairView.svelte:53-55` (inside
  `connectorClass`): replace the `forced`/`low` branch pair with

  ```ts
  if (showConfidence && isUncertain(b)) cls.push(b.forced ? 'forced' : 'low')
  ```

- `NodeTree.svelte:68-69`:

  ```svelte
  class:low={showConfidence && isUncertain(bunsetsu[e.to]) && !bunsetsu[e.to].forced}
  class:forced={showConfidence && isUncertain(bunsetsu[e.to]) && bunsetsu[e.to].forced}
  ```

**Unchanged:** `confidenceLabel` — the hover tooltip and Inspector line still
disclose "P = 97% (forced)"; being forced remains visible information, it
just no longer implies *uncertain*. The Inspector's uncertainty count and
`class:uncertain` use `isUncertain` and are fixed automatically.

**Resulting matrix:**

| probability | forced | dotted? | counts as uncertain? | tooltip |
| --- | --- | --- | --- | --- |
| 0.97 | true | no | no | P = 97% (forced) |
| 0.55 | true | yes (`forced` dash) | yes | P = 55% (forced) |
| 0.55 | false | yes (`low` dash) | yes | P = 55% |
| null | true | yes (`forced` dash) | yes | forced attachment (end-of-sentence fallback) |
| null | false | no | no | — |

## 2. Speak/Stop becomes one toggle button

**`src/lib/speech.ts`** — `speak()` gains an optional completion callback:

```ts
export function speak(text: string, rate = 1, voiceURI: string | null = null, onDone?: () => void): void {
  const s = synth()
  if (!s) return
  s.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  const voice = pickVoice(voiceURI)
  if (voice) utterance.voice = voice
  utterance.lang = 'ja-JP'
  utterance.rate = rate
  if (onDone) {
    utterance.addEventListener('end', onDone)
    utterance.addEventListener('error', onDone)
  }
  s.speak(utterance)
}
```

(`end` also fires when a later `cancel()` interrupts the utterance — e.g.
when a bunsetsu/morpheme 🗣️ icon starts speaking — so the toggle resets
itself in every stop path. `end` and `error` are mutually exclusive per
utterance, so `onDone` fires at most once per event type in practice;
resetting state twice is harmless/idempotent.)

**`Inspector.svelte`** — the sentence card's two buttons become one:

```svelte
let speaking = $state(false)

function toggleSpeech() {
  if (speaking) {
    stopSpeech()
    speaking = false
  } else {
    speak(sentence.text, rate, voiceURI, () => (speaking = false))
    speaking = true
  }
}
```

```svelte
<button disabled={!canSpeak} title={speakTitle} onclick={toggleSpeech}>
  {#if speaking}<span class="emoji" aria-hidden="true">⏹</span> {t('stopButton')}
  {:else}<span class="emoji" aria-hidden="true">🗣️</span> {t('speakButton')}{/if}
</button>
```

The separate Stop button is removed. `stopButton`/`speakButton` catalog keys
stay (now the two faces of the toggle). The small 🗣️ icon buttons
(bunsetsu heading, morpheme rows) stay one-shot as today — starting them
cancels a running sentence utterance, whose `end` event resets the toggle.

`speaking` is not reset when `sentence` changes; if speech continues across
a re-parse the button correctly still offers Stop, and the `end` event
resets it otherwise.

## 3. Speaker emoji alignment

Emoji glyphs ride high against the Latin baseline. Fix via flex centering +
a normalized emoji span (the `span.emoji` wrapper from §2 is also applied to
the icon buttons' glyphs):

- `Inspector.svelte`: wrap every 🗣️ glyph as
  `<span class="emoji" aria-hidden="true">🗣️</span>` (h2 icon, morpheme
  icons, and the toggle above).
- `src/app.css`:

  ```css
  .inspector h2 { display: flex; align-items: center; gap: 0.35rem; }
  .inspector .icon { display: inline-flex; align-items: center; padding: 0; }
  .inspector .m-head { display: flex; align-items: center; gap: 0.25rem; flex-wrap: wrap; }
  .actions button { display: inline-flex; align-items: center; gap: 0.35rem; }
  .emoji { line-height: 1; }
  ```

  (Existing `.m-head` / h2 rules are amended, not duplicated. Exact values
  may be nudged during the final review's visual pass — the mechanism is
  what's specified.)

## 4. No speaker on punctuation morphemes

`toMorpheme` already nulls `jishoUrl` exactly for `pos === '記号'`; the
speak button gets its own semantically-correct gate on the same class of
morphemes — in the Inspector's morpheme row, wrap the 🗣️ button:

```svelte
{#if !m.posJa.startsWith('記号')}
  <button class="icon" ...>…</button>
{/if}
```

(Gate on `posJa`, not `jishoUrl` — "has no dictionary entry" and "is not
speakable" are the same set today but different concepts.)

The bunsetsu-level 🗣️ in the heading stays unconditional.

## 5. Help button joins the gear at the right edge

The mid-header "?" is a layout slip: `.settings-menu { margin-left: auto }`
(`app.css:102`) pushes only the gear right; the help trigger stays
left-packed after the toolbar.

- `HelpDialog.svelte`: trigger button class becomes
  `class="icon-button help-trigger"`.
- `src/app.css`: `.help-trigger { margin-left: auto; }` and **remove**
  `margin-left: auto` from `.settings-menu`.

DOM order is unchanged (help before settings — the header-order test is
unaffected); the ?+gear pair now clusters at the right edge, separated by
the header's existing `gap`.

## Ripple effects

- **README screenshots:** header chrome changes (help button moves right)
  and scene 1's Inspector shows the sentence card buttons — ALL THREE
  screenshots regenerate via `npm run shots` (standing rule).
- No live-check changes (existing 9 checks remain valid: the help check
  clicks by accessible name, not position).

## Not changing

`settings.ts`, catalogs (no new keys), `chainpalette.ts`, parser/shims,
`SettingsMenu`, `Toolbar`, `HelpDialog` content (only the trigger's class),
`speechAvailable`/`pickVoice`/`listJaVoices`.

## Error handling

| Situation | Behavior |
| --- | --- |
| Speech interrupted by an icon button / another utterance | previous utterance's `end` fires → toggle resets |
| `stopSpeech()` clicked | state set false immediately; the utterance's `end` event is a harmless no-op repeat |
| No voices | toggle disabled with the `noVoice` title, exactly like the old Speak button |
| forced with null probability | still dotted (`forced` dash) + forced-only tooltip — unchanged |

## Testing

- `tests/lib/viewmodel.test.ts` (or wherever `isUncertain` is covered):
  the matrix from §1 — forced+0.97 → false; forced+0.55 → true;
  forced+null → true; 0.55 → true; 0.97 → false; root (null, not forced) →
  false.
- View tests (all three): a forced bunsetsu with P = 0.97 renders NO
  `low`/`forced` class with confidence on; a forced bunsetsu with P = null
  still renders `forced`. Existing assertions that encode the old
  semantics are updated to the new matrix (this is a semantics change, not
  an assertion weakening — note it in the PR).
- `Inspector` tests (speech module mocked): toggle shows "Speak" idle;
  click → `speak` called with an `onDone` callback and button shows
  "Stop"; invoking the captured `onDone` flips it back; clicking while
  speaking calls `stopSpeech` and flips back; disabled without voices.
  A punctuation morpheme (posJa `記号読点`) renders no speak button while
  its siblings do; uncertainty note count follows the new `isUncertain`.
- Header: assert the help trigger carries the `help-trigger` class
  (jsdom cannot verify computed `margin-left: auto`; the final review's
  live pass measures the actual geometry: help button's right edge
  adjacent to the gear, both at the header's right edge).
- Final review live pass additionally verifies: toggle round-trip with a
  real utterance (or at least real `speechSynthesis` presence), emoji
  vertical centering (screenshot/boundingBox comparison), and the
  regenerated screenshots.

# Robustness Round — Design

**Date:** 2026-07-19
**Status:** Approved

Six deferred minors from the PR #20 and #21 final reviews, bundled into one
housekeeping iteration. No new features, settings, or catalog keys; no
screenshot changes (nothing about the idle chrome changes).

## 1. Speech toggle: generation counter against the stale-`onDone` race

**Race (PR #20 final review):** Stop→Speak in quick succession — the
cancelled utterance A's `end` event fires *after* utterance B started, and
A's `onDone` flips `speaking` to false while B is audibly playing.

**Fix — Inspector-local, `speech.ts` untouched:** every toggle transition
bumps a generation counter; a completion callback only applies if its
generation is still current:

```ts
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

## 2. Stop stays clickable when voices vanish mid-utterance

The toggle's `disabled={!canSpeak}` becomes `disabled={!canSpeak && !speaking}`
— a `voiceschanged` event that empties the Japanese voice list while speech
is in progress no longer locks the user out of Stop.

## 3. `.emoji` scoped

`src/app.css`: `.emoji { line-height: 1; }` becomes
`.inspector .emoji { line-height: 1; }` — the class is used only inside the
Inspector (verified across `src/`).

## 4. `copied` resets when the Inspector switches cards

**Leak (PR #21 final review):** copy on the sentence card, select a bunsetsu
within 2 s → the bunsetsu card's share button shows "copied!" although
nothing was copied from it.

**Fix:** an effect keyed on the selection resets the transient state:

```ts
$effect(() => {
  void selected
  clearTimeout(copyTimer)
  copied = false
})
```

(Runs on mount too — harmless; `copied` is already false.)

## 5. `pendingJump` consumed on a failed boot parse

**Leak (PR #21 final review):** a share link whose parse fails leaves
`pendingJump` armed; if the visitor then edits the text and parses something
unrelated, the stale jump applies a surprising (clamp-limited) selection.

**Fix:** `App.svelte`'s `handleParse` error path adds `pendingJump = null` —
the jump is one-shot per boot, period. (A deliberate *retry* of the same
text via the error banner loses the jump too; acceptable — the retry case
is a dictionary-load failure, where a re-run usually happens on a reload,
which re-arms from the URL anyway.)

## 6. Standing live-browser guard for the scroll path

`scripts/live-check.mjs` gains an ELEVENTH check `share jump`, right after
the existing `share` check: a NEW page with a deliberately small viewport
(900×300 — two cards cannot fit), opening
`?text=猫が魚を食べた。犬は公園で遊んだ。&view=arcs&s=1&b=1`, asserting:
- both cards render, 公園で is selected, the second card is `.active`;
- the second `.card-slot`'s boundingRect lies within the 300px viewport;
- `window.scrollY > 0` (the scroll actually happened).

The page is closed afterwards; the existing checks are untouched.

## Not changing

`speech.ts`, `share.ts`, `settings.ts`, catalogs, views, HelpDialog,
Toolbar, screenshots, README.

## Error handling

| Situation | Behavior |
| --- | --- |
| Stale `onDone` from a superseded utterance | ignored (generation mismatch) |
| Current utterance's own `end`/`error` | still resets (generation matches) |
| Voices vanish while speaking | Stop remains clickable; after the utterance ends the button disables as before |
| Failed boot parse then unrelated manual parse | no stale selection applied |

## Testing

- `InspectorSpeak`: (a) stale-`onDone` — start speech, stop, start again,
  invoke the FIRST captured callback → button still shows Stop; invoke the
  second → Speak. (b) mid-utterance voice loss — stub a `speechSynthesis`
  global that captures the `voiceschanged` listener; flip the mocked
  `speechAvailable` to false and fire the listener while speaking → the
  toggle stays enabled (Stop clickable); after `onDone` it disables.
- `Inspector` share tests: copy → "copied!" → rerender with a `selected`
  bunsetsu → the bunsetsu card's share button shows "share link", not
  "copied!".
- `App`: share-link boot whose `parseText` REJECTS (error banner shown),
  then a manual parse of different text that resolves → no selection
  applied, no active-sentence jump.
- Live-check verified against a local preview (11 ok lines expected).

# Selectable Speech Voice — Design

**Date:** 2026-07-18
**Status:** Approved

## Problem

Speech playback always uses an auto-picked Japanese voice (local-service preferred,
else the first Japanese voice). Browsers often offer several Japanese voices of very
different quality; the user should be able to choose one, and the choice should
survive reloads like the other settings.

## Solution overview

A voice `<select>` in the toolbar lists the browser's Japanese voices; the selection
is stored in the existing settings object as `voiceURI` (`string | null`, `null` =
auto). `speech.ts` gains a preference parameter and keeps its heuristic as the
fallback. When the browser has no Japanese voices (or no speech support at all), the
selector is hidden entirely — matching how the Speak buttons already disable
themselves.

## Settings extension

Exercises the extension path built in the persist-settings feature — one line each:

- `Settings`: `voiceURI: string | null`
- `DEFAULTS`: `voiceURI: null`
- validator: `null` or any string is valid; anything else falls back to the default.

A stored URI that doesn't exist on the current machine is **kept** (it may belong to
another browser/OS profile of the same synced storage); it simply loses at pick time.

## speech.ts changes

- `listJaVoices(): SpeechSynthesisVoice[]` — voices whose `lang` starts with `ja`
  (case-insensitive), ordered `localService` first, then alphabetically by `name`
  (deterministic dropdown order).
- `pickVoice(preferredURI: string | null = null)` — when `preferredURI` is set and a
  Japanese voice with that exact `voiceURI` exists, return it; otherwise the existing
  heuristic (first local-service Japanese voice, else first Japanese voice, else
  `null`).
- `speak(text: string, rate = 1, voiceURI: string | null = null)` — threads the
  preference to `pickVoice`.
- `speechAvailable()` unchanged.

## Toolbar

- New bindable prop `voiceURI: string | null`.
- A `<select>` with `aria-label="voice"` after the rate slider:
  - first option 自動 auto with value `''` (mapped to `null` on change),
  - one option per `listJaVoices()` entry, value = `voiceURI`, label = `name`.
- Voices load asynchronously: the component holds a local voice list refreshed on
  mount and on `voiceschanged` (same listener pattern as the Inspector's `canSpeak`).
- **Hidden entirely** (not rendered) while the Japanese voice list is empty.
- If the bound `voiceURI` is not among the options, the select shows auto but the
  stored value is not modified.

## App / Inspector wiring

- `App.svelte`: `voiceURI` state initialized from `loadSettings()`; the existing
  settings `$effect` writes it; bound to Toolbar; passed down to Inspector.
- `Inspector.svelte`: new prop `voiceURI: string | null`; all three speak calls
  (sentence, bunsetsu, morpheme) become `speak(text, rate, voiceURI)`.

## Error handling

| Situation | Behavior |
| --- | --- |
| No speech support / no Japanese voices | selector hidden; Speak buttons already disabled |
| Stored `voiceURI` not present on this machine | auto shown in selector, heuristic used, stored value untouched |
| Voices arrive after first render | selector appears when `voiceschanged` delivers Japanese voices |
| Invalid persisted value (non-string, non-null) | falls back to `null` (auto) via the validator |

## Testing

- `speech.ts` (stubbed `speechSynthesis` via `vi.stubGlobal`): `listJaVoices`
  filtering + ordering; `pickVoice` preferred-match, missing-URI fallback, heuristic
  order preserved; `speak` sets the preferred voice on the utterance.
- `settings.ts`: `voiceURI` accepts `null` and strings, rejects numbers/booleans/
  objects; round-trips; absent field defaults to `null` (old payloads).
- `Toolbar` (jsdom, stubbed voices): renders auto + voice options; maps `''` ↔
  `null`; hidden when no Japanese voices; selecting updates the binding.
- `App`: `voiceURI` restored from storage and persisted on change alongside the
  other settings.
- `Inspector`: speak buttons pass the active `voiceURI` through (spy on `speak`).

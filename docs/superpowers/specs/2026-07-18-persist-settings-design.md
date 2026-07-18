# Persist Settings in localStorage — Design

**Date:** 2026-07-18
**Status:** Approved

## Problem

Reloading the app resets all toolbar settings (furigana toggle, view style, speech rate)
to their defaults. Settings should survive reloads.

Scope decision: **settings only** — the input text and parse results intentionally start
fresh on every visit.

Lookahead (not in scope, but shapes the design): upcoming features add a selectable
speech voice and a selectable UI locale, both also persisted. The settings module must
absorb new fields without rework.

## Solution overview

A small `src/lib/settings.ts` module owns serialization, validation, and defaults for a
single user-preferences object. `App.svelte` initializes its existing `$state` from
`loadSettings()` and writes back via one `$effect`. No UI changes; the Toolbar bindings
stay as they are.

Rejected alternatives: a generic "persisted rune" wrapper (machinery three-to-five flat
fields don't justify) and the `svelte-persisted-store` package (new dependency + store
paradigm in a runes-only codebase).

## The settings module

```ts
export interface Settings {
  showFurigana: boolean
  view: 'arcs' | 'tree'
  rate: number
}

export const DEFAULTS: Settings = { showFurigana: false, view: 'arcs', rate: 1 }

export function loadSettings(): Settings
export function saveSettings(s: Settings): void
```

- Storage key: `ayaki-settings`. Payload: JSON object.
- **Load:** wrapped in try/catch (missing key, malformed JSON, storage access throwing
  → `DEFAULTS`). Each field is validated independently by a per-field validator and
  falls back to its own default when missing or invalid — a field-wise merge over
  `DEFAULTS`. Unknown keys in the payload are ignored.
  - `showFurigana`: must be `boolean`.
  - `view`: must be exactly `'arcs'` or `'tree'`.
  - `rate`: must be a finite `number`; clamped to the slider's range **0.5–1.5**.
- **Validation is table-shaped:** one validator per field, so the upcoming `voiceURI`
  and `locale` fields are one-line additions that don't touch the load/save mechanics.
- **Save:** `saveSettings` serializes the full object; `setItem` failures (private
  mode, quota) are caught and ignored. Persistence is best-effort — the app never
  breaks because storage doesn't work.
- No schema versioning: a bad payload degrades to defaults; old payloads lacking new
  fields get those fields' defaults (this IS the migration story).

## App wiring

```ts
const initial = loadSettings()
let showFurigana = $state(initial.showFurigana)
let view = $state<'arcs' | 'tree'>(initial.view)
let rate = $state(initial.rate)

$effect(() => {
  saveSettings({ showFurigana, view, rate })
})
```

The `$effect` tracks all three and writes the whole object on any change. It also runs
once on mount, which harmlessly writes the just-loaded (or default) values back.

## Error handling summary

| Failure | Behavior |
| --- | --- |
| No stored value | `DEFAULTS` |
| Malformed JSON / non-object payload | `DEFAULTS` |
| Individual field missing or wrong type | that field's default, others kept |
| `rate` out of range | clamped to 0.5–1.5 |
| `localStorage` access throws (read or write) | defaults on read, ignored on write |

## Testing

Unit tests for `settings.ts` (jsdom for localStorage):

- Round-trip: `saveSettings` then `loadSettings` returns the same values.
- No stored key → `DEFAULTS`.
- Malformed JSON, non-object payloads (`"[]"`, `"42"`, `"null"`) → `DEFAULTS`.
- Field-wise fallback: valid `view` + wrong-typed `showFurigana` keeps the valid field.
- `rate` clamping (both bounds) and non-finite rejection (`NaN`, `"1"`, `Infinity`).
- Unknown extra keys ignored.
- `getItem`/`setItem` throwing → defaults / no crash.

App-level test: render, change a setting, assert the stored JSON updated; seed
localStorage, render fresh, assert the toolbar reflects the stored settings.

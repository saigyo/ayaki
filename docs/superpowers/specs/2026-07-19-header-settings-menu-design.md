# Header Tidy-Up: Settings Menu, Control Order, 🗣️ — Design

**Date:** 2026-07-19
**Status:** Approved

## Problem

Three header-polishing changes, one iteration:

1. The furigana checkbox currently sits left of the view buttons; it should sit
   to their right.
2. Speech is a minor side-feature, but the rate slider and voice selector are
   among the most prominent toolbar controls. They move into a new settings
   popup behind a "gears" button at the rightmost header position — also the
   future home for further configuration options.
3. The speaker emoji 🔊 is replaced by the speaking-head emoji 🗣️.

Reference for the gear button and popup: `LlmSelector.tsx` in
saigyo/fabulous-writing @ d113fd8 (`GearIcon` SVG + `icon-button` toggle with
`aria-expanded` and outside-click dismissal) and the user's screenshot of that
app's popup (white rounded shadowed card anchored below the button, small gray
uppercase labels above each control).

## Header layout — `src/components/App.svelte`

```svelte
<header>
  <div class="brand"> <h1>…</h1> <LocaleSwitcher bind:locale /> </div>
  <Toolbar bind:showFurigana bind:view />
  <SettingsMenu bind:rate bind:voiceURI />
</header>
```

`SettingsMenu` gets `margin-left: auto` (CSS) so the gear sits rightmost; on
wrapped narrow headers it wraps as the last item. App's settings persistence
(`saveSettings` effect over all five fields) is untouched — `rate`/`voiceURI`
just bind to a different child now.

## Toolbar — `src/components/Toolbar.svelte`

Shrinks to two controls, in this order: the three view buttons, then the
furigana checkbox (order swapped per requirement 1). The `rate`/`voiceURI`
props, the voice-list state, the `voiceschanged` listener, and the
`listJaVoices` import move out. No other behavior changes.

## New component — `src/components/SettingsMenu.svelte`

- Props: `{ rate = $bindable(), voiceURI = $bindable(null) }:
  { rate: number; voiceURI?: string | null }`.
- **Gear button:** `<button class="icon-button" aria-expanded={open}
  aria-label={t('settingsLabel')}>` containing the `GearIcon` SVG from the
  reference (Lucide-style gear path + center circle, `fill="none"
  stroke="currentColor"`, ~16 px, `aria-hidden="true"`). Click toggles the
  popup.
- **Popup** (rendered only while open): absolutely positioned card anchored
  below-right of the button (the component root is `position: relative`;
  the card `position: absolute; right: 0; top: 100%`), white background,
  rounded corners, border + drop shadow, above other content (`z-index`).
  Content, in order:
  1. **Voice row** — small gray uppercase label (existing `voiceLabel` key)
     above the voice `<select>`, moved verbatim from Toolbar: auto option
     first, per-option `selected` attributes, stored-but-absent voice
     displays as auto without overwriting the stored value, `''` → `null`
     on change. The whole row (label + select) is hidden when no Japanese
     voices exist, exactly as the select is today; the popup then shows only
     the rate row.
  2. **Rate row** — same label treatment (existing `rateLabel` key) above the
     existing range input (0.5–1.5, step 0.1) plus a plain numeric readout
     `{rate.toFixed(1)}×` (no speaker emoji).
- **Dismissal:** clicking outside the component closes the popup (document
  listener registered only while open); Escape inside closes it and stops
  propagation (so App's Escape-clears-selection handler doesn't also fire)
  and returns focus to the gear button. The gear button click itself must not
  count as "outside" (toggle, not close-then-reopen).
- **State:** `open` is ephemeral component state — deliberately NOT persisted.
- Labels use the small-caps style from the reference screenshot via CSS
  (`text-transform: uppercase; font-size ~0.7rem; color gray`), applied to
  the existing localized label strings.

## Localization

One new catalog key in all four locales:

| key | en | de | ja | zh |
| --- | --- | --- | --- | --- |
| `settingsLabel` | settings | Einstellungen | 設定 | 设置 |

`voiceLabel`/`rateLabel` are reused as the popup row labels (they remain the
accessible names of the select/slider as today).

## 🗣️ swap — `src/components/Inspector.svelte`

The three speak buttons (selected-bunsetsu icon button, per-morpheme icon
button, sentence "Speak" button) change their glyph 🔊 → 🗣️. Accessible
names, titles, and behavior unchanged. After the toolbar move there is no
other speaker emoji anywhere in the UI.

## CSS — `src/app.css`

- Remove: `.toolbar select.voice` and `.toolbar .rate`-related styling (the
  rate label class disappears with the markup).
- Add: `.settings-menu` (relative anchor, `margin-left: auto`), `.icon-button`
  gear styling (borderless, hover tint, focus-visible ring — consistent with
  `.locale-switcher`'s affordances), `.settings-popup` card (background, border,
  radius, shadow, padding, `right: 0; top: 100%; z-index`), `.settings-popup
  label` small-caps row labels, row spacing.

## Error handling

| Situation | Behavior |
| --- | --- |
| No Japanese voices | voice row hidden; popup shows only the rate row (same information as today's hidden select) |
| Voices arrive later (`voiceschanged`) | listener lives in SettingsMenu now; row appears on next open (or live if open) |
| Stored voice absent on this machine | displays as auto, stored value untouched (unchanged semantics, moved verbatim) |
| Escape with popup open + bunsetsu selected | popup closes, selection stays (stopPropagation) |
| Escape with popup closed | unchanged — App clears the selection |

## Not changing

`src/lib/settings.ts`, `src/lib/speech.ts`, `src/lib/i18n.svelte.ts` (beyond
the four catalog files gaining `settingsLabel`), `LocaleSwitcher`, persistence
shape, browser-smoke/CI.

## Testing

- New `SettingsMenu` component tests: gear renders with localized aria-label
  and `aria-expanded` tracking; popup hidden until click; voice + rate rows
  present with accessible names when voices exist; voice row hidden without
  Japanese voices (rate row still there); stored-absent-voice displays auto;
  change events update both bindables; outside click closes; Escape closes,
  stops propagation, and refocuses the gear; gear click toggles closed.
- Toolbar tests: view buttons before furigana checkbox in DOM order; voice
  and rate cases removed (moved to SettingsMenu tests).
- App tests: header DOM order brand → toolbar → settings gear (gear last);
  rate/voice persistence round-trip now driven through the opened popup; the
  existing furigana/view persistence tests pass unchanged.
- Inspector tests: speak buttons render 🗣️ (existing accessible-name-based
  tests pass unchanged).
- README screenshots: `npm run shots` regenerates all three after the change
  (the chrome changed → whole set invalid); arcs alt text's "voice selector in
  the toolbar" becomes the settings gear.

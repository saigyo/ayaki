# Header Locale Switcher — Design

**Date:** 2026-07-19
**Status:** Approved

## Problem

The locale selector currently sits at the end of the toolbar as a labeled
`<select>` (`🌐` + full dropdown chrome). It is visually intrusive for a control
that is used once and then forgotten. The reference pattern (from another of the
user's projects): a bare globe icon in the app header, right next to the app
name; clicking it opens the language dropdown. Explicit modification to the
reference: **no caret symbol** next to the globe — the dropdown opens by
clicking the globe itself.

## Approach

An invisible native `<select>` stretched over a visible globe glyph. Clicking
the globe is clicking the select, so the platform's native picker opens
(matching the reference screenshots, where the popup with the checkmark is the
OS rendering). The native element keeps keyboard focusability, `aria-label`,
and arrow-key selection for free. A custom button + hand-rolled ARIA listbox
was rejected: it buys styling control we don't need at the cost of owning
outside-click handling, listbox semantics, and keyboard navigation.

## Component — `src/components/LocaleSwitcher.svelte`

- Props: `{ locale = $bindable(null) }: { locale?: Locale | null }` — the same
  bindable contract Toolbar has today.
- Markup: a wrapper `<span class="locale-switcher">` containing
  - the globe glyph `🌐` in an `aria-hidden="true"` span (decorative; the
    select carries the accessible name), and
  - the `<select>` with `aria-label={t('localeLabel')}`, visually hidden via
    `opacity: 0; position: absolute; inset: 0; width: 100%; height: 100%;
    cursor: pointer` (NOT `display:none`/`visibility:hidden`, which would
    remove it from focus order and hit testing).
- Options: `Automatic` (value `""`, selected when `locale === null`) first,
  then the four locales as endonyms — English, Deutsch, 日本語, 中文. The
  `LOCALE_NAMES: Record<Locale, string>` table moves here from Toolbar.
- `onchange` handler identical to Toolbar's today: value validated with
  `SUPPORTED_LOCALES.includes(...)`, empty/unknown → `null`.
- Per-option `selected` attributes (matching the existing pattern), not
  `bind:value`.
- Visuals: `cursor: pointer` on the wrapper, subtle hover background tint,
  and a visible focus ring via `.locale-switcher:has(select:focus-visible)`
  (the select itself is transparent, so the ring must render on the wrapper).
  No caret, no border, no box in the resting state.

## Header — `src/components/App.svelte`

- The header becomes: brand group first, toolbar after.
  The brand group wraps the existing `<h1>` and the switcher so flex-wrap can
  never separate them:

  ```svelte
  <div class="brand">
    <h1><span lang="ja">文木</span> Ayaki</h1>
    <LocaleSwitcher bind:locale />
  </div>
  <Toolbar bind:showFurigana bind:view bind:rate bind:voiceURI />
  ```

- `bind:locale` moves from Toolbar to LocaleSwitcher; everything else about
  App's locale handling (init-time `setStoredLocale`, save `$effect`, mirror
  `$effect`) is untouched.

## Toolbar — `src/components/Toolbar.svelte`

- Remove: the `locale` bindable prop, the `LOCALE_NAMES` table, the
  `Locale`/`SUPPORTED_LOCALES` imports, and the trailing
  `<label class="locale-wrap">…</label>` block.
- Furigana toggle, view buttons, rate slider, and voice select are untouched.

## CSS — `src/app.css`

- `.toolbar select.locale` styling and any `.locale-wrap` rules are removed
  (`select.voice` keeps its current rule).
- New `.brand` rule: flex row, small gap, no wrapping between h1 and globe.
- New `.locale-switcher` rules: relative positioning context, globe font size
  ~1.1rem, hover tint, focus-visible ring as above.

## Not changing

- `src/lib/settings.ts`, `src/lib/i18n.svelte.ts`, catalogs: storage shape,
  validation, and locale resolution are untouched. This is purely a
  relocation + reskin of the selector control.

## Error handling

| Situation | Behavior |
| --- | --- |
| Stored locale invalid / null | unchanged — resolver falls back to browser locale then `'en'`; dropdown shows Automatic selected |
| Select emits unknown value | validated `onchange` maps it to `null` (unchanged logic) |
| `:has()` unsupported (pre-2023 browsers) | focus ring absent, control still fully operable — acceptable degradation |

## Testing

- New `LocaleSwitcher` component tests: globe glyph rendered and
  `aria-hidden`; select reachable by accessible name (`localeLabel` text);
  option list = Automatic + 4 endonyms; Automatic selected when
  `locale === null`; stored locale's option selected otherwise; change event
  updates the bindable (concrete locale and back to `null`); unknown value →
  `null`.
- Toolbar tests: locale-related cases removed; remaining controls' tests
  unchanged and green.
- App test: the switcher's select (by accessible name) renders inside
  `header`, and Toolbar no longer contains it.

## README

The first screenshot shows the old toolbar including the locale select.
After the change, retake it (globe next to the app name, shorter toolbar) and
update alt text accordingly.

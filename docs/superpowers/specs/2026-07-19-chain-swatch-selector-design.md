# Chain Swatch Selector + "Predicate" Rename — Design

**Date:** 2026-07-19
**Status:** Approved

## Problem

1. The chain-color dropdown feels wrong for a small fixed palette — replace it
   with a radio group of color swatches plus a "none" tile (companion variant
   **B**: tiles styled like the actual chain boxes — soft tint fill with the
   line-color border — so the swatch previews exactly what the diagram will
   do).
2. "Main verb" is linguistically misleading: the sentence head can be an
   adjective or copula predicate. UI terminology becomes **"predicate"**
   (述語); the linguistic term "head" (主辞) is reserved for the upcoming
   help popup.

## Rename — catalogs only

`chainLabel` changes in all four locales (keys and the four option strings
`chainAmber`…`chainNone` stay, now serving as the radios' accessible names
and tooltips):

| key | en | de | ja | zh |
| --- | --- | --- | --- | --- |
| `chainLabel` | chain to predicate | Kette zum Prädikat | 述語への連鎖 | 谓语依存链 |

## Swatch radio group — `SettingsMenu.svelte`

The chain `.row` becomes a `<fieldset class="row chain-row">` with a
`<legend class="row-label">{t('chainLabel')}</legend>` (fieldset/legend give
the group its accessible name natively; CSS resets fieldset chrome).

For each of `CHAIN_COLORS` (order amber, green, violet, none), an
**input-then-label sibling pair** — chosen over `label:has(input:checked)` so
the checked ring works in every browser that runs the app:

```svelte
<input
  class="swatch-input"
  type="radio"
  id="chain-{c}-{uid}"
  name="chain-{uid}"
  value={c}
  bind:group={chainColor}
  aria-label={t(chainOptionKey(c))}
/>
<label
  class="swatch"
  class:swatch-none={c === 'none'}
  for="chain-{c}-{uid}"
  title={t(chainOptionKey(c))}
  style={c !== 'none' ? `--sw: ${CHAIN_PALETTE[c].line}; --sw-soft: ${CHAIN_PALETTE[c].soft}` : undefined}
></label>
```

(`chainOptionKey` is a tiny local map `c → 'chainAmber' | … | 'chainNone'`.)

- Radios share one `name` per component instance; `bind:group={chainColor}`
  replaces the old `bind:value` select binding. Keyboard arrows/space work
  natively; each radio's accessible name is the localized color name; the
  group's name is the localized label.
- The old `<select>` and its markup are removed entirely.

## Swatch styling — `src/app.css`

- Fieldset reset: `.settings-popup .chain-row { border: none; margin: 0; padding: 0; }`
  and `legend.row-label` participating in the existing label styling.
- `.swatches` container: horizontal flex, ~10px gap.
- `.swatch`: 28×28px, `border-radius: 6px`, `background: var(--sw-soft)`,
  `border: 2px solid var(--sw)`, `cursor: pointer`.
- `.swatch-none`: white background, `1px solid var(--box-stroke)` border, and
  a diagonal slash (CSS `linear-gradient` stripe or rotated pseudo-element)
  in `var(--danger)`.
- `.swatch-input`: visually hidden but focusable (standard SR-only recipe —
  absolute position, 1px clip; NOT `display:none`).
- Selection ring: `.swatch-input:checked + .swatch { outline: 2px solid var(--accent); outline-offset: 2px; }`
- Focus ring: `.swatch-input:focus-visible + .swatch { outline: 2px solid var(--accent); outline-offset: 2px; }`
  (same ring — checked and focused states coincide visually, which is fine
  for a radio group where the checked item is the focused one under arrow
  navigation).

## Not changing

`chainpalette.ts`, `settings.ts` (values/validation identical — this is pure
presentation), views, App/SentenceCard plumbing, Inspector, screenshots (the
popup is closed in all three scenes — no regeneration needed).

## Error handling

| Situation | Behavior |
| --- | --- |
| Stored `chainColor` | unchanged semantics; the matching radio renders checked via `bind:group` |
| Browser without `:has()` | irrelevant — sibling selectors used throughout |
| No voices | swatch row unaffected (like the confidence row) |

## Testing

- `SettingsMenu`: the chain row exposes a radio group named
  `chain to predicate` with four radios named amber/green/violet/none;
  the stored color's radio is checked; clicking another updates the bindable
  (bind:group); the row stays enabled without voices. The old
  combobox-based chain test is replaced accordingly.
- `App`: the existing chain round-trip test switches from `selectOptions` on
  the combobox to clicking the `none` radio (assertions — chain cleared,
  persisted, no re-parse — unchanged).
- Catalog parity: compile-time `Record` typing + existing runtime parity test
  cover the changed values automatically.

## Help-popup note (for the next iteration's content)

The UI says "predicate" (述語); the help popup should mention "head" (主辞)
as the linguistic synonym — recorded in project memory.

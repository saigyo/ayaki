# UI Localization — Design

**Date:** 2026-07-18
**Status:** Approved

## Problem

The UI is a fixed Japanese/English hybrid. It should be fully localized in **EN, DE,
JA and ZH**, with the language selectable, remembered like the other settings, and
defaulting to the browser locale (falling back to EN).

## Solution overview

A small in-repo i18n module (`src/lib/i18n.svelte.ts`) holds the resolved locale as a
module-level rune and exposes `t(key)`; one typed catalog per locale lives in
`src/lib/locales/`. The POS/conjugation gloss tables gain DE and ZH columns and are
resolved at **render time** instead of parse time, so a locale switch retranslates
already-parsed sentences. A 🌐 selector joins the toolbar; the choice persists as
`Settings.locale` (`null` = follow the browser).

Rejected alternatives: an i18n library (svelte-i18n/Paraglide — plural rules, ICU and
async loading are all unneeded for four static catalogs) and prop-drilling the locale
through the component tree (module-level runes give the same reactivity without the
plumbing).

## Locale model

- Type: `Locale = 'en' | 'de' | 'ja' | 'zh'`; setting `locale: Locale | null`,
  default `null`.
- `null` = auto: resolve `navigator.languages` in order; the first entry whose
  lowercase form starts with a supported prefix (`en`, `de`, `ja`, `zh`) wins;
  no match → `en`. (`zh-TW`, `de-AT` etc. match their base prefix.)
- Picking a language stores it concretely; the selector's auto option returns to
  `null`. The resolved locale drives all rendering; the stored value only records
  the choice.
- Settings validator (table-shaped, one line): `null` or one of the four codes;
  anything else → default.

## The i18n module — `src/lib/i18n.svelte.ts`

```ts
export type Locale = 'en' | 'de' | 'ja' | 'zh'
export function resolveLocale(stored: Locale | null, languages?: readonly string[]): Locale
export function setStoredLocale(stored: Locale | null): void   // updates the module rune
export function currentLocale(): Locale                        // reactive resolved locale
export function t(key: MessageKey): string                     // reactive lookup
```

- Catalogs: `src/lib/locales/en.ts` is the reference — its key set defines
  `MessageKey` (`export type MessageKey = keyof typeof en`). `de.ts`, `ja.ts`,
  `zh.ts` are typed `Record<MessageKey, string>`, so a missing or extra key in any
  catalog is a **compile error**. No runtime fallback chains.
- The module reactively sets `document.documentElement.lang` to the resolved locale
  (guarded for non-browser environments). Inline `lang="ja"` attributes on Japanese
  sentence content remain unchanged.
- App calls `setStoredLocale` from its settings state; components import `t` /
  `currentLocale` directly — no prop drilling.

## Glosses: render-time resolution

Today `MorphemeVM.posEn` / `conjugationEn` are baked in at parse time by
`posLabel()` / `conjugationLabel()`. That becomes wrong under localization (a locale
switch must retranslate parsed sentences), so:

- `MorphemeVM` drops `posEn` and `conjugationEn`; it keeps `posJa` / `conjugationJa`.
- `pos.ts` gloss tables gain DE and ZH columns:
  `Record<string /* ja term */, { en: string; de: string; zh: string }>` for both POS
  and conjugation forms; new `posGloss(posJa, locale)` / `conjugationGloss(conjugationJa, locale)`
  return the gloss, or `null` for unknown terms **and for `locale === 'ja'`** — in the
  JA locale the Japanese term stands alone and no gloss is rendered.
- The Inspector resolves glosses reactively at render time.

## String inventory (UI chrome)

All user-visible chrome moves into the catalogs, replacing today's bilingual hybrids:

- Toolbar: furigana toggle label, arcs/tree button labels + group aria-label,
  speech-rate aria-label, voice aria-label, 自動 auto option, locale-selector
  aria-label.
- Input: placeholder, textarea aria-label, parse button, idle hint + example link
  text, loading messages (dictionary download / parsing), error banner text + retry
  button, per-sentence parse-error text.
- Inspector: `Sentence` / `Sentence i / n` heading (localized template), sentence
  hint, Speak/Stop labels, Google Translate link text, uncertainty note template,
  `attachment:` label + forced-attachment wording, base-form label, speak-button
  titles and aria-labels (incl. "no Japanese voice" tooltip), Jisho link label.
- Footer: connective text localized; project names and license names stay as-is.
- The app title 文木 Ayaki is NOT localized.
- Messages with values (sentence numbers, uncertainty counts) use simple
  `{placeholder}` substitution in the catalog strings — no plural machinery; counts
  render numerically in all four languages.

## Google Translate target

The link's `tl` parameter follows the resolved locale (`en`, `de`, `zh`); for the JA
locale it stays `en` (ja→ja is useless). `googleTranslateUrl(text, locale)` gains the
parameter.

## Toolbar selector

A 🌐 `<select>` (localized aria-label), options in this order: auto (localized
label), English, Deutsch, 日本語, 中文 — each language named in itself, so the list is
readable whatever the current locale. Selecting auto stores `null`; the selector
always renders (unlike the voice selector there is no environment where it's
useless).

## Error handling

| Situation | Behavior |
| --- | --- |
| Stored locale invalid/unknown code | validator → `null` (auto) |
| `navigator.languages` empty/undefined | `en` |
| Unknown POS/conjugation term at render | no gloss shown (matches today) |
| Locale switched after parsing | all glosses and chrome retranslate reactively |

## Testing

- `i18n` unit tests: resolution matrix (`stored` beats browser; `de-AT` → `de`,
  `zh-TW` → `zh`; unsupported-only lists → `en`; empty/undefined → `en`), reactive
  `t` switching, `document.documentElement.lang` updates.
- Catalog parity is enforced by the type system (compile error), plus one runtime
  test asserting identical key sets across the four catalogs (guards against `as`
  casts).
- Gloss tables: every key present in the POS/conjugation maps has non-empty `en`,
  `de`, `zh`; `posGloss` returns `null` for JA locale and unknown terms.
- Settings: `locale` validator accepts the four codes + `null`, rejects others.
- Components: sample-per-locale render tests (e.g. DE toolbar labels, ZH inspector
  headings); a locale-switch-after-parse test asserting a rendered gloss changes
  from EN to DE without re-parsing.
- App: persistence round-trip of `locale` alongside the other settings.

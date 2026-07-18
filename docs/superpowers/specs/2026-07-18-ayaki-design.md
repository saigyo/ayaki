# Ayaki (文木) — Design

*2026-07-18 — validated in brainstorming session*

## Purpose

A single-page browser app for Japanese learners: paste a Japanese sentence (or paragraph), see its bunsetsu-level dependency structure rendered as an interactive tree, inspect part of speech and reading of every morpheme (Japanese terms with English translations), hear parts or whole sentences spoken, and jump off to Jisho.org (per word) or Google Translate (per sentence).

Everything runs client-side; there is no backend.

## Foundation: sasara

Parsing is built on [sasara](https://github.com/iatosh/sasara) v0.2.0, installed from the npm registry (`npm install sasara` — GitHub installs don't work because releases ship no `dist/`). Facts the design depends on:

- CaboCha-style **bunsetsu dependency parser** on top of kuromojin/IPAdic. Output is a flat array: `Bunsetsu { index, tokens: KuromojiToken[], surface, head: number | null }`. Heads point rightward, non-crossing, sentence-final bunsetsu is root. No dependency labels.
- **Single-sentence input**; sentence splitting is the caller's job.
- Browser usage requires two static assets: the perceptron model (`model.json`, ~550 KB) and the kuromoji IPAdic dictionary (12 `.dat.gz` files, ~4 MB), loaded via `loadParser({ model, dicPath })`. Always use one cached `Parser` instance (the `parse(text, dicPath)` convenience reloads the model per call).
- `confidence: true` adds per-edge `{ score, probability, forced }`. Parser accuracy is ~83% UAS — uncertainty is real and worth surfacing.
- Licensing: sasara code MIT; **model.json is CC BY-SA 4.0** (derivative of UD Japanese-GSD) and requires attribution; kuromoji's dictionary carries the IPAdic license. The app ships an attribution footer.

## Decisions made

| Topic | Decision |
|---|---|
| Stack | Svelte 5 + Vite + TypeScript, pure static build |
| Main view | Arc diagram (displaCy style), toggle to root-on-top node tree |
| Inspector | Persistent side panel (right; below trees on narrow screens). Full-width concordance table noted as possible later addition |
| Dictionary links | Jisho.org, linking the token's base form |
| Multi-sentence input | Split on 。！？ and newlines; one tree per sentence, stacked |
| Furigana | Toggleable readings above bunsetsu, off by default |
| Confidence | Arcs with P < 0.7 dashed/lighter; `forced` edges dotted; exact P on hover |
| Parsing location | Main thread behind an async `ParserService`; worker-swappable later |
| Init timing | Lazy — dictionary/model load on first parse, with visible loading state |
| Deployment | Static hosting (GitHub Pages), base-path aware |

## Architecture

```
src/
  lib/                     # plain TS, no Svelte imports — unit-testable
    parser.ts              # ParserService: lazy init, sentence splitting, parse
    pos.ts                 # IPAdic POS tag → English mapping (incl. sub-categories)
    speech.ts              # Web Speech wrapper: ja-JP voice pick, speak/cancel, rate
    links.ts               # URL builders: Jisho (base form), Google Translate
    types.ts               # app-level view models (ParsedSentence etc.)
  components/
    App.svelte             # layout shell, owns app state (selection, view toggles)
    SentenceInput.svelte   # textarea + parse button
    Toolbar.svelte         # furigana toggle, view toggle, speech rate slider
    SentenceCard.svelte    # one parsed sentence: view + per-sentence actions
    ArcDiagram.svelte      # default SVG view
    NodeTree.svelte        # toggleable root-on-top SVG view (own tidy-tree layout, no D3)
    Inspector.svelte       # side panel: morpheme details, speech, links
public/                    # populated by sync-assets script, not committed
  dict/                    # kuromoji IPAdic .dat.gz (12 files, ~4 MB)
  model.json               # sasara model (~550 KB, CC BY-SA 4.0)
```

### Data flow (one direction)

1. Submit text → `parser.ts` splits into sentences (on 。！？ and newlines, delimiter kept with its sentence).
2. First parse runs one-time init: `fetch(BASE_URL + 'model.json')` + `loadParser({ model, dicPath: BASE_URL + 'dict/' })`; UI shows "loading dictionary…". The `Parser` is cached for the session. Failed init is not cached (retry re-attempts).
3. Each sentence → `parser.parse(text, /* confidence */ true)` → `Bunsetsu[]` → wrapped into a `ParsedSentence` view model adding derived per-token fields: English POS, hiragana reading (katakana→hiragana), Jisho URL, plus per-edge confidence.
4. Components render from the view model. Selection/hover state lives in `App.svelte`, flows down via props/context; interactions flow up as events. No global store.

## UI

**Layout:** header (文木 Ayaki + toolbar) → input area → stacked `SentenceCard`s → persistent Inspector right panel (~320 px; docks below content under ~800 px via CSS grid reflow).

**Arc diagram:** bunsetsu as rounded boxes on a baseline in sentence order (root box accented); arcs above from dependent to head, height proportional to span so arcs nest without collision, arrowhead at head end. Hovering a bunsetsu highlights box + outgoing arc + head; clicking selects it (Esc or re-click deselects). Furigana, when toggled on, renders per-bunsetsu hiragana above the boxes (kana-only tokens excluded). Wide sentences scroll horizontally inside their card.

**Node tree:** root on top, dependents branch downward, siblings keep sentence order; simple own tidy-tree layout (~100 lines). Identical hover/click/confidence semantics.

**Inspector:**
- *Sentence mode* (nothing selected): sentence text, 🔊 speak / ⏹ stop, Google Translate link (`translate.google.com/?sl=ja&tl=en&text=…`), confidence summary ("2 of 6 attachments uncertain").
- *Bunsetsu mode:* bunsetsu surface + 🔊, then one card per morpheme: surface, reading (hiragana), POS as Japanese + English pair including sub-category (e.g. 助詞・格助詞 case particle), base form when different, conjugation form for inflected words, 📖 Jisho link on the base form. No dictionary link for punctuation tokens.

**Speech:** best-available `ja-JP` voice (prefer `localService`); speaking cancels any prior utterance; rate slider 0.5×–1.5× in the toolbar. No Japanese voice → buttons disabled with explanatory tooltip.

**States:** initial (hint + clickable example sentence), loading dictionary, parsed, error. Footer carries attributions (sasara MIT; model CC BY-SA 4.0 / UD Japanese-GSD; IPAdic license).

## Error handling

- Asset load failure → error banner with cause + Retry (fresh init attempt).
- One sentence failing to parse shows an inline error in its card; other sentences render normally.
- Empty input disables the parse button; non-Japanese input is tolerated (kuromoji unknown-word tokens rendered as-is).

## Testing

- **vitest unit tests** for all of `lib/`: sentence splitting edge cases, POS mapping (all IPAdic top-level tags and sub-categories; unknown tags fall back to raw Japanese), link building/URL encoding, kana conversion, speech wrapper against a mocked `speechSynthesis`.
- **Node integration test** running the real kuromojin+sasara pipeline (Node uses the bundled dictionary, no HTTP): parse a fixture sentence, assert segmentation and heads — catches breaking sasara upgrades.
- **Component tests** (@testing-library/svelte): Inspector rendering from a fixture, selection flow. Arc-height layout is a pure function with its own test; visual rendering is checked by eye/Playwright, not asserted in unit tests.

## Build & deploy

- `sync-assets` script (wired as `predev`/`prebuild`) copies `node_modules/kuromoji/dict/*.dat.gz` and `node_modules/sasara/model/model.json` into `public/`; assets are gitignored.
- All asset URLs use `import.meta.env.BASE_URL`; GitHub Pages build uses `vite build --base=/ayaki/`.
- GitHub Actions: install → test → build → deploy to Pages. GitHub Pages serves `.dat.gz` without `Content-Encoding: gzip`, which matches kuromoji's loader (it inflates itself).

## Out of scope (for now)

- Web Worker parsing (API is already async; drop-in later if init jank bothers).
- Concordance table below the tree (inspector option C).
- Configurable dictionary targets, UniDic, dependency labels, parse editing/correction, saving/sharing parses.

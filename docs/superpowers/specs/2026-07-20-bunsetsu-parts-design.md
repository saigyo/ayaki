# Bunsetsu Parts Visualization — Design

**Date:** 2026-07-20
**Status:** Approved

## Problem

The bunsetsu card lists morpheme entries below the plain surface heading; a
learner must mentally re-assemble which slice of e.g. 行きましょうね。 each
entry describes (行き｜ましょ｜う｜ね｜。). Decided direction (Markus,
2026-07-20, via visual companion): make the segmentation visible and
interactive now (increment a), structured so a later increment can add
role *labels* (aim b).

## Decisions (from brainstorming)

- **Style:** tinted pills (option B) as default; a **quiet** style
  (option C — neutral pills, color only on hover) switchable in settings.
  No "off" state.
- **Colors mean structural roles** (option A): 5 colors — head (content
  word), auxiliary 助動詞, particle 助詞, affix 接頭詞/接尾, punctuation
  記号. Same role = same color in every sentence. 接頭詞 like お and
  suffix-type morphemes (POS detail 接尾) are affix, NOT head.
- **Interaction:** bidirectional hover highlight between segments and
  entries; hovering a segment scrolls its entry into view when needed. No
  layout shifts, no accordion.
- **Deferred:** ruby readings on segments (own increment); role labels
  (increment b).

## Change

### Role mapping (`src/lib/partroles.ts`, new)

```ts
export type PartRole = 'head' | 'aux' | 'particle' | 'affix' | 'symbol'

export const PART_PALETTE: Record<PartRole, string> = {
  head: '#3b82f6', aux: '#d97706', particle: '#059669',
  affix: '#8b5cf6', symbol: '#64748b',
}

export function morphemeRole(posJa: string): PartRole
```

Mapping on the combined `posJa` (`pos・detail1`): starts with 助動詞→aux,
助詞→particle, 記号→symbol, 接頭詞→affix, contains 接尾→affix (名詞・接尾
etc.), else→head. Pure function; the same keys later carry localized role
labels for increment (b).

### Segmented surface (`src/components/SegmentedSurface.svelte`, new)

Presentational component: takes `morphemes: MorphemeVM[]`, `quiet:
boolean`, `active: number | null`, `onhover: (i: number | null) => void`
(both optional, for the non-interactive help usage). Renders one
`<span class="part" data-role={role}>` per morpheme with
`style="--part: {PART_PALETTE[role]}"`, `title={t(roleKey)}` (the role's
legend label doubles as tooltip), `class:quiet`, `class:active`, and
mouseenter/mouseleave reporting the index. Pills: tinted background
(`color-mix` on `--part`), rounded, small gap; quiet: neutral background,
color only while `active`.

### Inspector (`src/components/Inspector.svelte`)

- The bunsetsu-card `<h2>` surface text is replaced by
  `<SegmentedSurface morphemes={selected.morphemes} {quiet} active={hoverPart} onhover={...}/>`;
  the speak button stays in the heading unchanged.
- Local `hoverPart: number | null` state. Segment hover sets it and, when
  the entry is outside the viewport, calls
  `entryEls[i]?.scrollIntoView({ block: 'nearest' })`.
- Each morpheme entry gets `style="--part: ..."` and a colored left
  border (quiet mode: neutral until active); `mouseenter` on an entry sets
  `hoverPart` too (highlights its segment); additionally CSS
  `:focus-within` on an entry applies the active styling, so keyboard
  users tabbing to Jisho/speak controls get the segment link for free.
- Punctuation entries participate (gray) — they still have no speak
  button.
- New prop `quiet: boolean` threaded from App.
- The `.actions` row (share button) currently sits flush under the last
  morpheme entry and reads as belonging to it. It gets a clear card-level
  separation: a top hairline border (same style as the entry separators)
  plus increased spacing above, in BOTH inspector cards for consistency —
  the row visibly applies to the whole bunsetsu/sentence, not the last
  entry.

### Setting

`quietParts: boolean` (default `false`) in `Settings` with the standard
boolean validator; checkbox row in the settings menu after the chain-color
fieldset; saved by the App save effect; NOT part of share links.

### Help dialog

New section "The parts of a bunsetsu" after the terminology section: intro
paragraph, a static SegmentedSurface of 行きましょうね。 (new fixture
`HELP_PARTS: MorphemeVM[]` in `src/lib/helpexample.ts` — five morphemes
with the posJa values kuromoji produces: 動詞・自立, 助動詞, 助動詞,
助詞・終助詞, 記号・句点), and a 5-item legend with real-color swatches
(pattern of the existing chain legend). The demo ignores `quietParts` (like
the demo's forced chain color — the legend must show its colors).

### Locale catalogs (8 new keys ×4)

| key | en | de | ja | zh |
| --- | --- | --- | --- | --- |
| quietPartsToggle | quiet part colors | Dezente Teilfarben | 部分の色を控えめに | 低调的组成部分配色 |
| helpPartsTitle | The parts of a bunsetsu | Die Teile eines Bunsetsu | 文節の内部構造 | 文节的组成部分 |
| helpPartsIntro | When a bunsetsu is selected, its surface is shown split into its parts, colored by role — hover a part to highlight its entry below. A quieter style is available in the settings. | Bei einem ausgewählten Bunsetsu wird die Oberfläche in ihre Teile zerlegt angezeigt, nach Rolle eingefärbt — beim Überfahren eines Teils wird der zugehörige Eintrag darunter hervorgehoben. Eine dezentere Darstellung lässt sich in den Einstellungen wählen. | 文節を選択すると、その表層が部分ごとに分割され、役割別の色で表示されます。部分にカーソルを合わせると、下の対応する項目が強調されます。控えめな配色は設定で選べます。 | 选中文节后，其表层会按组成部分拆分，并按角色着色——将鼠标悬停在某一部分上，可高亮下方对应的条目。可在设置中改用低调配色。 |
| partHead | head (content word) | Kopf (Inhaltswort) | 主辞（内容語） | 中心语（实词） |
| partAux | auxiliary | Hilfsverb | 助動詞 | 助动词 |
| partParticle | particle | Partikel | 助詞 | 助词 |
| partAffix | prefix/suffix | Präfix/Suffix | 接頭辞・接尾辞 | 前缀/后缀 |
| partSymbol | punctuation | Interpunktion | 記号 | 标点 |

(Terminology stays consistent with the existing help: head = 主辞, zh
中心语.)

### Verification tooling

- `live-check`: one new check — select a bunsetsu of the example parse,
  assert the inspector heading contains ≥2 `.part` segments and that the
  segment count equals the morpheme-entry count.
- README screenshots: `screenshot-tree.png` shows the morpheme inspector,
  so **all three** screenshots are regenerated via `npm run shots`
  (standing rule: one run regenerates the whole set).

## Not changing

Sentence card and all three diagram views, share-link schema, speech,
Jisho links, `confidenceLabel`/uncertainty display, chain palette,
`HELP_SENTENCE` demo fixture.

## Testing

- `tests/lib/partroles.test.ts`: mapping matrix incl. 動詞・自立→head,
  助動詞→aux, 助詞・終助詞→particle, 記号・句点→symbol, 接頭詞→affix,
  名詞・接尾→affix, 名詞・代名詞→head.
- `tests/components/SegmentedSurface.test.ts`: one pill per morpheme,
  data-role/`--part` assignment, quiet class, active class, onhover
  callbacks, role-label tooltips.
- `tests/components/Inspector.test.ts`: segmented heading renders for a
  selected bunsetsu (entry count == segment count), hover on segment
  activates entry + calls the scrollIntoView spy, hover on entry activates
  segment, quiet prop pass-through.
- Settings round-trip for `quietParts`; catalog parity automatic.
- Help: section renders with 5 legend items and the 行きましょうね。
  example (scoped queries — the dialog is always mounted).
- Post-merge: live-check (now 12 checks) + production probe measuring
  segment colors for the two modes.

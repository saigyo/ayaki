# Chain Direct-Attachment Note — Design

**Date:** 2026-07-19
**Status:** Approved

## Problem

A bunsetsu attaching directly to the predicate shows no chain when selected
(by design — the blue immediate link already is the whole path), which can
read as "the chain feature isn't working." Markus decided (2026-07-19) to
resolve this with a help-legend mention rather than a diagram change.

## Change

One new catalog key `legendChainDirect`, rendered in `HelpDialog.svelte` as
a muted note directly under the legend list, BEFORE the existing
`legendChainNote` (configurability) paragraph:

```svelte
      <p class="help-note">{t('legendChainDirect')}</p>
      <p class="help-note">{t('legendChainNote')}</p>
```

The note points into the live demo, whose 見に attaches directly to the
predicate — the reader can see the case firsthand.

| locale | value |
| --- | --- |
| en | A bunsetsu that attaches directly to the predicate has no onward chain — the blue link itself is the whole path (try 見に in the demo). |
| de | Ein Bunsetsu, das sich direkt an das Prädikat anschließt, hat keine weitere Kette — der blaue Link selbst ist schon der ganze Pfad (probieren Sie 見に im Beispiel). |
| ja | 述語に直接係る文節には、その先の連鎖はありません。青いリンク自体が経路のすべてです(上の図で「見に」を選んでみてください)。 |
| zh | 直接依附于谓语的文节没有后续依存链——蓝色连线本身就是完整路径(可在上图中点击「見に」试试)。 |

The key is inserted directly after `legendChainNote` in each catalog.

## Not changing

Diagram/chain behavior, `chainpalette.ts`, CSS (`.help-note` exists),
screenshots (help dialog closed in all scenes), live-check.

## Testing

- `HelpDialog.test.ts`: the open-dialog test additionally asserts the note
  text is present (`/directly to the predicate/`).
- Catalog parity automatic (compile-time Record + runtime parity test).
- Pre-PR live sanity pass by the controller (micro-cycle: no separate final
  review — the single task review + live sanity replace it).

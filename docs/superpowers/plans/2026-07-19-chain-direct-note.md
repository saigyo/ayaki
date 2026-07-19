# Chain Direct-Attachment Note Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Explain in the help legend that direct-to-predicate attachments show no onward chain, pointing at 見に in the live demo.

**Architecture:** One catalog key ×4 + one paragraph in `HelpDialog.svelte` + one test assertion.

**Tech Stack:** Svelte 5, TypeScript, vitest/jsdom.

**Spec:** `docs/superpowers/specs/2026-07-19-chain-direct-note-design.md`

## Global Constraints

- Catalog values VERBATIM from the spec's table; key `legendChainDirect` inserted directly after `legendChainNote` in each of the four catalogs.
- The new note paragraph renders BEFORE the existing `legendChainNote` paragraph; both use the existing `help-note` class. Nothing else in `HelpDialog.svelte` changes.
- No CSS, screenshot, live-check, or diagram changes.
- Conventional Commits; the git hook adds the Co-Authored-By trailer — do not add it manually.
- All commands run from `/Users/markus/IdeaProjects/ayaki`.

---

### Task 1: Note + catalogs + test

**Files:**
- Modify: `src/lib/locales/{en,de,ja,zh}.ts` (1 key each), `src/components/HelpDialog.svelte` (1 line)
- Test: `tests/components/HelpDialog.test.ts` (1 added assertion)

**Interfaces:**
- Consumes: `t()` and the existing `help-note` styling.
- Produces: nothing new for other components.

- [ ] **Step 1: Failing test**

In `tests/components/HelpDialog.test.ts`, inside the test `'renders the trigger and opens a dialog with all six sections'`, after the headings assertion add:

```ts
    expect(within(dialog).getByText(/directly to the predicate/)).toBeInTheDocument()
```

Run: `npx vitest run tests/components/HelpDialog.test.ts`
Expected: FAIL (text absent).

- [ ] **Step 2: Catalog key**

Insert directly after the `legendChainNote` line in each catalog:

`src/lib/locales/en.ts`:
```ts
  legendChainDirect:
    'A bunsetsu that attaches directly to the predicate has no onward chain — the blue link itself is the whole path (try 見に in the demo).',
```
`src/lib/locales/de.ts`:
```ts
  legendChainDirect:
    'Ein Bunsetsu, das sich direkt an das Prädikat anschließt, hat keine weitere Kette — der blaue Link selbst ist schon der ganze Pfad (probieren Sie 見に im Beispiel).',
```
`src/lib/locales/ja.ts`:
```ts
  legendChainDirect:
    '述語に直接係る文節には、その先の連鎖はありません。青いリンク自体が経路のすべてです(上の図で「見に」を選んでみてください)。',
```
`src/lib/locales/zh.ts`:
```ts
  legendChainDirect:
    '直接依附于谓语的文节没有后续依存链——蓝色连线本身就是完整路径(可在上图中点击「見に」试试)。',
```

- [ ] **Step 3: Markup**

In `src/components/HelpDialog.svelte`, replace

```svelte
      <p class="help-note">{t('legendChainNote')}</p>
```

with

```svelte
      <p class="help-note">{t('legendChainDirect')}</p>
      <p class="help-note">{t('legendChainNote')}</p>
```

- [ ] **Step 4: Gates**

Run: `npx vitest run tests/components/HelpDialog.test.ts`, then `npm test && npm run check`
Expected: PASS, 0 errors 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add src/lib/locales src/components/HelpDialog.svelte tests/components/HelpDialog.test.ts
git commit -m "feat: help legend explains direct-to-predicate attachments"
```

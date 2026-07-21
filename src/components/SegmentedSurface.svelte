<script lang="ts">
  import { morphemeRole, PART_LABEL_KEYS, PART_PALETTE, PART_SHORT_KEYS } from '../lib/partroles'
  import { t } from '../lib/i18n.svelte'
  import type { MorphemeVM } from '../lib/types'

  let {
    morphemes,
    quiet = false,
    active = null,
    showFurigana = false,
    onhover = () => {},
  }: {
    morphemes: MorphemeVM[]
    quiet?: boolean
    active?: number | null
    showFurigana?: boolean
    onhover?: (index: number | null) => void
  } = $props()
</script>

<!-- Pointer-only hover affordance: keyboard users get the segment↔entry link
     via :focus-within on the entries. Making parts focusable would add dead
     tab stops that announce as buttons doing nothing. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<span class="parts" lang="ja" onmouseleave={() => onhover(null)}>
  {#each morphemes as m, i}
    {@const role = morphemeRole(m.posJa)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span
      class="part-col"
      data-role={role}
      style="--part: {PART_PALETTE[role]}"
      title={t(PART_LABEL_KEYS[role])}
      onmouseenter={() => onhover(i)}
    >
      {#if showFurigana}
        <span class="part-ruby">{m.reading && m.reading !== m.surface ? m.reading : ''}</span>
      {/if}
      <span class="part" class:quiet class:active={active === i}>{m.surface}</span>
      <span class="part-label">{t(PART_SHORT_KEYS[role])}</span>
    </span>
  {/each}
</span>

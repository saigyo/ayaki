<script lang="ts">
  import { morphemeRole, PART_LABEL_KEYS, PART_PALETTE } from '../lib/partroles'
  import { t } from '../lib/i18n.svelte'
  import type { MorphemeVM } from '../lib/types'

  let {
    morphemes,
    quiet = false,
    active = null,
    onhover = () => {},
  }: {
    morphemes: MorphemeVM[]
    quiet?: boolean
    active?: number | null
    onhover?: (index: number | null) => void
  } = $props()
</script>

<span class="parts" lang="ja" role="presentation" onmouseleave={() => onhover(null)}>
  {#each morphemes as m, i}
    {@const role = morphemeRole(m.posJa)}
    <span
      class="part"
      class:quiet
      class:active={active === i}
      data-role={role}
      role="button"
      tabindex="0"
      style="--part: {PART_PALETTE[role]}"
      title={t(PART_LABEL_KEYS[role])}
      onmouseenter={() => onhover(i)}
    >{m.surface}</span>
  {/each}
</span>

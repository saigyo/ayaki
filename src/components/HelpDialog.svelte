<script lang="ts">
  import StairView from './StairView.svelte'
  import SegmentedSurface from './SegmentedSurface.svelte'
  import { HELP_SENTENCE, HELP_PARTS } from '../lib/helpexample'
  import { t } from '../lib/i18n.svelte'
  import { CHAIN_PALETTE, type ChainColor } from '../lib/chainpalette'
  import { PART_LABEL_KEYS, PART_PALETTE, PART_ROLES } from '../lib/partroles'
  import { RELATION_EXPLAIN_KEYS, RELATION_LABELS, RELATION_TERM_KEYS } from '../lib/relations'

  let { chainColor = 'amber' }: { chainColor?: ChainColor } = $props()

  const uid = $props.id()
  let dialog = $state<HTMLDialogElement>()
  let demoSelected = $state<number | null>(0)

  // the demo must always show a chain — fall back to amber when disabled
  const demoChain = $derived(chainColor === 'none' ? 'amber' : chainColor)
  const demoPalette = $derived(CHAIN_PALETTE[demoChain])

  function open() {
    demoSelected = 0
    dialog?.showModal()
  }
</script>

<button
  class="icon-button help-trigger"
  aria-label={t('helpLabel')}
  title={t('helpLabel')}
  aria-haspopup="dialog"
  onclick={open}
>
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
</button>

<dialog
  class="help-dialog"
  bind:this={dialog}
  aria-labelledby="help-title-{uid}"
  onclick={(e) => {
    // only the backdrop has the dialog itself as target — .help-body fills the frame
    if (e.target === dialog) dialog?.close()
  }}
  onkeydown={(e) => {
    // the native cancel (a default action) still closes the dialog; this only
    // keeps App's window-level Escape handler from clearing the selection too
    if (e.key === 'Escape') e.stopPropagation()
  }}
>
  <div class="help-body">
    <header class="help-header">
      <h2 id="help-title-{uid}">{t('helpLabel')}</h2>
      <button class="icon-button" aria-label={t('helpClose')} onclick={() => dialog?.close()}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </header>
    <section>
      <h3>{t('helpAboutTitle')}</h3>
      <p>{t('helpAboutBody')}</p>
    </section>
    <section>
      <h3>{t('helpViewsTitle')}</h3>
      <ul>
        <li>{t('helpViewArcs')}</li>
        <li>{t('helpViewTree')}</li>
        <li>{t('helpViewStairs')}</li>
      </ul>
    </section>
    <section>
      <h3>{t('helpDiagramTitle')}</h3>
      <p>{t('helpDiagramHint')}</p>
      <div class="help-demo">
        <StairView
          bunsetsu={HELP_SENTENCE}
          showConfidence={true}
          showRelations={true}
          selected={demoSelected}
          chainColor={demoChain}
          onselect={(i) => (demoSelected = demoSelected === i ? null : i)}
        />
      </div>
      <ul class="help-legend">
        <li><span class="legend-swatch legend-selected" aria-hidden="true"></span>{t('legendSelection')}</li>
        <li><span class="legend-swatch legend-link" aria-hidden="true"></span>{t('legendLink')}</li>
        <li>
          <span
            class="legend-swatch legend-chain"
            style="--sw: {demoPalette.line}; --sw-soft: {demoPalette.soft}"
            aria-hidden="true"
          ></span>{t('legendChain')}
        </li>
        <li><span class="legend-line" aria-hidden="true"></span>{t('legendUncertain')}</li>
      </ul>
      <p class="help-note">{t('legendChainDirect')}</p>
      <p class="help-note">{t('legendChainNote')}</p>
    </section>
    <section>
      <h3>{t('helpConfidenceTitle')}</h3>
      <p>{t('helpConfidenceBody')}</p>
    </section>
    <section>
      <h3>{t('helpTermTitle')}</h3>
      <p>{t('helpTermBody')}</p>
    </section>
    <section>
      <h3>{t('helpPartsTitle')}</h3>
      <p>{t('helpPartsIntro')}</p>
      <p class="parts-example"><SegmentedSurface morphemes={HELP_PARTS} showFurigana={true} /></p>
      <ul class="help-legend">
        {#each PART_ROLES as r (r)}
          <li><span class="legend-swatch" style="background: color-mix(in srgb, {PART_PALETTE[r]} 30%, transparent); border: 2px solid {PART_PALETTE[r]}" aria-hidden="true"></span>{t(PART_LABEL_KEYS[r])}</li>
        {/each}
      </ul>
    </section>
    <section>
      <h3>{t('helpRelationsTitle')}</h3>
      <p>{t('helpRelationsIntro')}</p>
      <ul class="help-legend relations-legend">
        {#each RELATION_LABELS as r (r)}
          <li><strong>{t(RELATION_TERM_KEYS[r])}</strong> — {t(RELATION_EXPLAIN_KEYS[r])}</li>
        {/each}
      </ul>
    </section>
    <section>
      <h3>{t('helpTipsTitle')}</h3>
      <ul>
        <li>{t('helpTipSelect')}</li>
        <li>{t('helpTipHover')}</li>
        <li>{t('helpTipSpeak')}</li>
      </ul>
    </section>
  </div>
</dialog>

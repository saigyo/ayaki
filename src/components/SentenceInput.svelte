<script lang="ts">
  import { t } from '../lib/i18n.svelte'

  let {
    text = $bindable(),
    busy = false,
    onparse,
  }: {
    text: string
    busy?: boolean
    onparse: () => void
  } = $props()
</script>

<form
  class="sentence-input"
  onsubmit={(e) => {
    e.preventDefault()
    if (text.trim()) onparse()
  }}
>
  <textarea
    bind:value={text}
    lang="ja"
    rows="3"
    placeholder={t('inputPlaceholder')}
    aria-label={t('inputLabel')}
  ></textarea>
  <button type="submit" disabled={busy || !text.trim()}>{t('parseButton')}</button>
</form>

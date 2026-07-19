<script lang="ts">
  import { t, type Locale, SUPPORTED_LOCALES } from '../lib/i18n.svelte'

  let { locale = $bindable(null) }: { locale?: Locale | null } = $props()

  const LOCALE_NAMES: Record<Locale, string> = { en: 'English', de: 'Deutsch', ja: '日本語', zh: '中文' }
</script>

<span class="locale-switcher">
  <span aria-hidden="true">🌐</span>
  <select
    aria-label={t('localeLabel')}
    onchange={(e) => {
      const v = e.currentTarget.value
      locale = SUPPORTED_LOCALES.includes(v as Locale) ? (v as Locale) : null
    }}
  >
    <option value="" selected={locale === null}>{t('localeAuto')}</option>
    {#each SUPPORTED_LOCALES as l}
      <option value={l} selected={l === locale}>{LOCALE_NAMES[l]}</option>
    {/each}
  </select>
</span>

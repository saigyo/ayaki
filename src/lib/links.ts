import type { Locale } from './i18n.svelte'

export function jishoUrl(term: string): string {
  return `https://jisho.org/search/${encodeURIComponent(term)}`
}

export function googleTranslateUrl(text: string, locale: Locale): string {
  const tl = locale === 'ja' ? 'en' : locale
  return `https://translate.google.com/?sl=ja&tl=${tl}&op=translate&text=${encodeURIComponent(text)}`
}

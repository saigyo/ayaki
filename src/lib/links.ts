export function jishoUrl(term: string): string {
  return `https://jisho.org/search/${encodeURIComponent(term)}`
}

export function googleTranslateUrl(text: string): string {
  return `https://translate.google.com/?sl=ja&tl=en&op=translate&text=${encodeURIComponent(text)}`
}

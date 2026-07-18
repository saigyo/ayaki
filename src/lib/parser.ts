/** Split text into single sentences for sasara (which only accepts one sentence). */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？!?])|\n+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

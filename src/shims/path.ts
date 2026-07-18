/** Minimal browser stand-in for node:path — kuromoji's DictionaryLoader only uses join(). */
export function join(...parts: string[]): string {
  return parts.join('/').replace(/(?<!:)\/{2,}/g, '/')
}
export default { join }

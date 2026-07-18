/** Minimal browser stand-in for node:path — kuromoji's DictionaryLoader only uses join(). */
export function join(...parts: string[]): string {
  return parts.join('/').replace(/(?<!:)\/{2,}/g, '/')
}

/**
 * Minimal dirname — kuromojin has a currently-dead code path that calls path.dirname; a patch
 * release could activate it, so this shim covers it defensively even though nothing exercises
 * it today.
 */
export function dirname(p: string): string {
  const i = p.lastIndexOf('/')
  return i === -1 ? '.' : p.slice(0, i)
}

export default { join, dirname }

import type { MessageKey } from './i18n.svelte'

export type PartRole = 'head' | 'aux' | 'particle' | 'affix' | 'symbol'

/** legend/display order */
export const PART_ROLES: PartRole[] = ['head', 'aux', 'particle', 'affix', 'symbol']

export const PART_PALETTE: Record<PartRole, string> = {
  head: '#3b82f6',
  aux: '#d97706',
  particle: '#059669',
  affix: '#8b5cf6',
  symbol: '#64748b',
}

/** i18n catalog key holding the localized label of each role */
export const PART_LABEL_KEYS = {
  head: 'partHead',
  aux: 'partAux',
  particle: 'partParticle',
  affix: 'partAffix',
  symbol: 'partSymbol',
} as const satisfies Record<PartRole, MessageKey>

/** i18n catalog key holding the SHORT under-pill label of each role */
export const PART_SHORT_KEYS = {
  head: 'partHeadShort',
  aux: 'partAuxShort',
  particle: 'partParticleShort',
  affix: 'partAffixShort',
  symbol: 'partSymbolShort',
} as const satisfies Record<PartRole, MessageKey>

/**
 * Structural role of a morpheme within its bunsetsu, from the combined
 * IPAdic POS (`pos・detail1`). Head is the default: any content word that
 * is not an auxiliary, particle, symbol, or affix. 接尾 appears as a
 * detail on several POS classes (名詞・接尾, 動詞・接尾, …), hence the
 * substring check.
 */
export function morphemeRole(posJa: string): PartRole {
  if (posJa.startsWith('助動詞')) return 'aux'
  if (posJa.startsWith('助詞')) return 'particle'
  if (posJa.startsWith('記号')) return 'symbol'
  if (posJa.startsWith('接頭詞') || posJa.includes('接尾')) return 'affix'
  return 'head'
}

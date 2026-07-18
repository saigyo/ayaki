import { describe, expect, it } from 'vitest'
import { splitSentences } from '../../src/lib/parser'

describe('splitSentences', () => {
  it('splits on Japanese sentence enders, keeping them', () => {
    expect(splitSentences('猫が来た。犬も来た！君は？')).toEqual(['猫が来た。', '犬も来た！', '君は？'])
  })
  it('splits on ASCII ! and ?', () => {
    expect(splitSentences('すごい!ほんと?')).toEqual(['すごい!', 'ほんと?'])
  })
  it('splits on newlines, dropping them', () => {
    expect(splitSentences('一行目\n二行目')).toEqual(['一行目', '二行目'])
  })
  it('keeps a trailing sentence without punctuation', () => {
    expect(splitSentences('終わりのない文')).toEqual(['終わりのない文'])
  })
  it('returns [] for empty and whitespace-only input', () => {
    expect(splitSentences('')).toEqual([])
    expect(splitSentences(' \n　 ')).toEqual([])
  })
})

// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import SegmentedSurface from '../../src/components/SegmentedSurface.svelte'
import { morphemeFixture } from '../fixtures'

const morphemes = [
  morphemeFixture({ surface: '行き', reading: 'いき', posJa: '動詞・自立' }),
  morphemeFixture({ surface: 'ましょ', reading: 'ましょ', posJa: '助動詞' }),
  morphemeFixture({ surface: 'う', reading: 'う', posJa: '助動詞' }),
  morphemeFixture({ surface: 'ね', reading: 'ね', posJa: '助詞・終助詞' }),
  morphemeFixture({ surface: '。', reading: null, posJa: '記号・句点' }),
]

describe('SegmentedSurface', () => {
  it('renders one column per morpheme with role, color, tooltip, and label', () => {
    const { container } = render(SegmentedSurface, { props: { morphemes } })
    const cols = container.querySelectorAll('.part-col')
    const parts = container.querySelectorAll('.part')
    expect(cols).toHaveLength(5)
    expect(parts).toHaveLength(5)
    expect(parts[0].textContent).toBe('行き')
    expect(cols[0].getAttribute('data-role')).toBe('head')
    expect(cols[1].getAttribute('data-role')).toBe('aux')
    expect(cols[3].getAttribute('data-role')).toBe('particle')
    expect(cols[4].getAttribute('data-role')).toBe('symbol')
    expect(cols[0].getAttribute('style')).toContain('#3b82f6')
    expect(cols[0].getAttribute('title')).toBe('head (content word)')
    const labels = [...container.querySelectorAll('.part-label')].map((l) => l.textContent)
    expect(labels).toEqual(['head', 'aux', 'aux', 'particle', 'punct.'])
  })
  it('applies quiet and active classes to the pills, labels present in quiet mode', () => {
    const { container } = render(SegmentedSurface, { props: { morphemes, quiet: true, active: 1 } })
    const parts = container.querySelectorAll('.part')
    expect(parts[0]).toHaveClass('quiet')
    expect(parts[1]).toHaveClass('active')
    expect(parts[0]).not.toHaveClass('active')
    expect(container.querySelectorAll('.part-label')).toHaveLength(5)
  })
  it('renders ruby only for differing readings when furigana is on', () => {
    const off = render(SegmentedSurface, { props: { morphemes } })
    expect(off.container.querySelectorAll('.part-ruby')).toHaveLength(0)
    const on = render(SegmentedSurface, { props: { morphemes, showFurigana: true } })
    const rubies = [...on.container.querySelectorAll('.part-ruby')].map((r) => r.textContent)
    expect(rubies).toEqual(['いき', '', '', '', ''])
  })
  it('reports hover enter and leave on the columns', async () => {
    const onhover = vi.fn()
    const { container } = render(SegmentedSurface, { props: { morphemes, onhover } })
    await fireEvent.mouseEnter(container.querySelectorAll('.part-col')[2])
    expect(onhover).toHaveBeenLastCalledWith(2)
    await fireEvent.mouseLeave(container.querySelector('.parts')!)
    expect(onhover).toHaveBeenLastCalledWith(null)
  })
})

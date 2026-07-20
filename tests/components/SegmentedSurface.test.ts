// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import SegmentedSurface from '../../src/components/SegmentedSurface.svelte'
import { morphemeFixture } from '../fixtures'

const morphemes = [
  morphemeFixture({ surface: '行き', posJa: '動詞・自立' }),
  morphemeFixture({ surface: 'ましょ', posJa: '助動詞' }),
  morphemeFixture({ surface: 'う', posJa: '助動詞' }),
  morphemeFixture({ surface: 'ね', posJa: '助詞・終助詞' }),
  morphemeFixture({ surface: '。', posJa: '記号・句点' }),
]

describe('SegmentedSurface', () => {
  it('renders one colored part per morpheme with role, color, and tooltip', () => {
    const { container } = render(SegmentedSurface, { props: { morphemes } })
    const parts = container.querySelectorAll('.part')
    expect(parts).toHaveLength(5)
    expect(parts[0].textContent).toBe('行き')
    expect(parts[0].getAttribute('data-role')).toBe('head')
    expect(parts[1].getAttribute('data-role')).toBe('aux')
    expect(parts[3].getAttribute('data-role')).toBe('particle')
    expect(parts[4].getAttribute('data-role')).toBe('symbol')
    expect(parts[0].getAttribute('style')).toContain('#3b82f6')
    expect(parts[0].getAttribute('title')).toBe('head (content word)')
    expect(parts[0]).not.toHaveClass('quiet')
  })
  it('applies quiet and active classes', () => {
    const { container } = render(SegmentedSurface, { props: { morphemes, quiet: true, active: 1 } })
    const parts = container.querySelectorAll('.part')
    expect(parts[0]).toHaveClass('quiet')
    expect(parts[1]).toHaveClass('active')
    expect(parts[0]).not.toHaveClass('active')
  })
  it('reports hover enter and leave', async () => {
    const onhover = vi.fn()
    const { container } = render(SegmentedSurface, { props: { morphemes, onhover } })
    await fireEvent.mouseEnter(container.querySelectorAll('.part')[2])
    expect(onhover).toHaveBeenLastCalledWith(2)
    await fireEvent.mouseLeave(container.querySelector('.parts')!)
    expect(onhover).toHaveBeenLastCalledWith(null)
  })
})

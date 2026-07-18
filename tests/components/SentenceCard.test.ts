// @vitest-environment jsdom
import { render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import SentenceCard from '../../src/components/SentenceCard.svelte'
import { sentenceFixture } from '../fixtures'

const base = {
  sentence: sentenceFixture(),
  view: 'arcs' as const,
  showFurigana: false,
  selected: null,
  onselect: () => {},
}

describe('SentenceCard', () => {
  it('fires onactivate when the empty card space is clicked', () => {
    const onactivate = vi.fn()
    const { container } = render(SentenceCard, { props: { ...base, onactivate } })
    const card = container.querySelector('.card')!
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onactivate).toHaveBeenCalledTimes(1)
  })
  it('does not fire onactivate when a bunsetsu is clicked', () => {
    const onactivate = vi.fn()
    const onselect = vi.fn()
    const { getByText } = render(SentenceCard, { props: { ...base, onselect, onactivate } })
    getByText('魚を').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onselect).toHaveBeenCalledWith(1)
    expect(onactivate).not.toHaveBeenCalled()
  })
  it('applies the active class only when active', () => {
    const active = render(SentenceCard, { props: { ...base, active: true } })
    expect(active.container.querySelector('.card')!.classList.contains('active')).toBe(true)
    const inactive = render(SentenceCard, { props: { ...base } })
    expect(inactive.container.querySelector('.card')!.classList.contains('active')).toBe(false)
  })
})

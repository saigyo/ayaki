// @vitest-environment jsdom
import { render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import StairView from '../../src/components/StairView.svelte'
import { forcedSentenceFixture, sentenceFixture } from '../fixtures'

const bunsetsu = sentenceFixture().bunsetsu

describe('StairView', () => {
  it('renders one box per bunsetsu and one connector per non-root', () => {
    const { container } = render(StairView, { props: { bunsetsu, onselect: () => {} } })
    expect(container.querySelectorAll('g.bunsetsu rect')).toHaveLength(3)
    expect(container.querySelectorAll('path.arc')).toHaveLength(2)
  })
  it('marks low-confidence connectors and titles them with the probability', () => {
    const { container } = render(StairView, { props: { bunsetsu, onselect: () => {} } })
    const low = container.querySelectorAll('path.arc.low')
    expect(low).toHaveLength(1)
    expect(low[0].querySelector('title')?.textContent).toContain('55')
  })
  it('titles forced attachments', () => {
    const forced = forcedSentenceFixture().bunsetsu
    const { container } = render(StairView, { props: { bunsetsu: forced, onselect: () => {} } })
    const f = container.querySelectorAll('path.arc.forced')
    expect(f.length).toBeGreaterThan(0)
    expect(f[0].querySelector('title')?.textContent).toMatch(/forced/i)
  })
  it('shows furigana only when enabled', () => {
    const off = render(StairView, { props: { bunsetsu, onselect: () => {} } })
    expect(off.container.querySelectorAll('text.furigana')).toHaveLength(0)
    const on = render(StairView, { props: { bunsetsu, showFurigana: true, onselect: () => {} } })
    expect(on.container.querySelectorAll('text.furigana')).toHaveLength(3)
  })
  it('invokes onselect on click and Enter, and stops click propagation', () => {
    const onselect = vi.fn()
    const outer = vi.fn()
    const { getByText } = render(StairView, { props: { bunsetsu, onselect } })
    document.body.addEventListener('click', outer)
    try {
      getByText('魚を').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(onselect).toHaveBeenCalledWith(1)
      expect(outer).not.toHaveBeenCalled()
    } finally {
      document.body.removeEventListener('click', outer)
    }
    const g = getByText('猫が').closest('g')!
    g.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onselect).toHaveBeenCalledWith(0)
  })
  it('uses per-instance arrowhead marker ids and a localized group label', () => {
    const a = render(StairView, { props: { bunsetsu, onselect: () => {} } })
    const b = render(StairView, { props: { bunsetsu, onselect: () => {} } })
    const idA = a.container.querySelector('marker')!.id
    const idB = b.container.querySelector('marker')!.id
    expect(idA).not.toBe(idB)
    expect(a.container.querySelector('svg')!.getAttribute('aria-label')).toBe('CaboCha dependency stairs')
  })
})

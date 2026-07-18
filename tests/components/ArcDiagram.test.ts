// @vitest-environment jsdom
import { render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import ArcDiagram from '../../src/components/ArcDiagram.svelte'
import { sentenceFixture } from '../fixtures'

const bunsetsu = sentenceFixture().bunsetsu

describe('ArcDiagram', () => {
  it('renders one box per bunsetsu and one arc per non-root', () => {
    const { container } = render(ArcDiagram, { props: { bunsetsu, onselect: () => {} } })
    expect(container.querySelectorAll('g.bunsetsu rect')).toHaveLength(3)
    expect(container.querySelectorAll('path.arc')).toHaveLength(2)
  })
  it('marks low-confidence arcs and titles them with the probability', () => {
    const { container } = render(ArcDiagram, { props: { bunsetsu, onselect: () => {} } })
    const low = container.querySelectorAll('path.arc.low')
    expect(low).toHaveLength(1)
    expect(low[0].querySelector('title')?.textContent).toContain('55')
  })
  it('shows furigana only when enabled, skipping empty readings', () => {
    const noFuri = render(ArcDiagram, { props: { bunsetsu, onselect: () => {} } })
    expect(noFuri.container.querySelectorAll('text.furigana')).toHaveLength(0)
    const furi = render(ArcDiagram, { props: { bunsetsu, showFurigana: true, onselect: () => {} } })
    expect(furi.container.querySelectorAll('text.furigana')).toHaveLength(3)
  })
  it('invokes onselect with the bunsetsu index on click', async () => {
    const onselect = vi.fn()
    const { getByText } = render(ArcDiagram, { props: { bunsetsu, onselect } })
    getByText('魚を').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onselect).toHaveBeenCalledWith(1)
  })
  it('marks the selected bunsetsu', () => {
    const { container } = render(ArcDiagram, { props: { bunsetsu, selected: 1, onselect: () => {} } })
    expect(container.querySelectorAll('g.bunsetsu.selected')).toHaveLength(1)
  })
})

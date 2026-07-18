// @vitest-environment jsdom
import { render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import NodeTree from '../../src/components/NodeTree.svelte'
import { sentenceFixture, forcedSentenceFixture } from '../fixtures'

const bunsetsu = sentenceFixture().bunsetsu

describe('NodeTree', () => {
  it('renders all bunsetsu as boxes with head→dependent edges', () => {
    const { container } = render(NodeTree, { props: { bunsetsu, onselect: () => {} } })
    expect(container.querySelectorAll('g.bunsetsu rect')).toHaveLength(3)
    expect(container.querySelectorAll('line.edge')).toHaveLength(2)
  })
  it('places the root above its dependents', () => {
    const { getByText } = render(NodeTree, { props: { bunsetsu, onselect: () => {} } })
    const rootY = Number(getByText('食べた。').getAttribute('y'))
    const depY = Number(getByText('猫が').getAttribute('y'))
    expect(rootY).toBeLessThan(depY)
  })
  it('marks low-confidence edges', () => {
    const { container } = render(NodeTree, { props: { bunsetsu, onselect: () => {} } })
    expect(container.querySelectorAll('line.edge.low')).toHaveLength(1)
  })
  it('marks forced edges with the forced class, not low', () => {
    const { container } = render(NodeTree, { props: { bunsetsu: forcedSentenceFixture().bunsetsu, onselect: () => {} } })
    expect(container.querySelectorAll('line.edge.forced')).toHaveLength(1)
    expect(container.querySelectorAll('line.edge.low')).toHaveLength(0)
  })
  it('titles edges with the attachment confidence, including forced edges', () => {
    const withP = render(NodeTree, { props: { bunsetsu, onselect: () => {} } })
    expect(withP.container.querySelector('line.edge.low title')?.textContent).toContain('55')
    const forced = render(NodeTree, { props: { bunsetsu: forcedSentenceFixture().bunsetsu, onselect: () => {} } })
    expect(forced.container.querySelector('line.edge.forced title')?.textContent).toContain('forced attachment')
  })
  it('shows furigana above nodes only when enabled, skipping kana-only bunsetsu', () => {
    const off = render(NodeTree, { props: { bunsetsu, onselect: () => {} } })
    expect(off.container.querySelectorAll('text.furigana')).toHaveLength(0)
    const on = render(NodeTree, { props: { bunsetsu, showFurigana: true, onselect: () => {} } })
    expect(on.container.querySelectorAll('text.furigana')).toHaveLength(3)
    const forced = render(NodeTree, { props: { bunsetsu: forcedSentenceFixture().bunsetsu, showFurigana: true, onselect: () => {} } })
    const furigana = forced.container.querySelectorAll('text.furigana')
    expect(furigana).toHaveLength(1)
    expect(furigana[0].textContent).toBe('なに。')
  })
  it('invokes onselect on click', async () => {
    const onselect = vi.fn()
    const { getByText } = render(NodeTree, { props: { bunsetsu, onselect } })
    getByText('猫が').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onselect).toHaveBeenCalledWith(0)
  })
})

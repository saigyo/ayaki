// @vitest-environment jsdom
import { render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import NodeTree from '../../src/components/NodeTree.svelte'
import { sentenceFixture } from '../fixtures'

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
  it('invokes onselect on click', async () => {
    const onselect = vi.fn()
    const { getByText } = render(NodeTree, { props: { bunsetsu, onselect } })
    getByText('猫が').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onselect).toHaveBeenCalledWith(0)
  })
})

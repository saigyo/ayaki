// @vitest-environment jsdom
import { render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import NodeTree from '../../src/components/NodeTree.svelte'
import { chainSentenceFixture, sentenceFixture, forcedSentenceFixture } from '../fixtures'

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
    const { container } = render(NodeTree, { props: { bunsetsu, showConfidence: true, onselect: () => {} } })
    expect(container.querySelectorAll('line.edge.low')).toHaveLength(1)
  })
  it('marks forced edges with the forced class, not low', () => {
    const { container } = render(NodeTree, {
      props: { bunsetsu: forcedSentenceFixture().bunsetsu, showConfidence: true, onselect: () => {} },
    })
    expect(container.querySelectorAll('line.edge.forced')).toHaveLength(1)
    expect(container.querySelectorAll('line.edge.low')).toHaveLength(0)
  })
  it('renders a confidently-forced attachment solid, tooltip still disclosing forcedness', () => {
    const s = forcedSentenceFixture()
    s.bunsetsu[0].probability = 0.97
    const { container } = render(NodeTree, { props: { bunsetsu: s.bunsetsu, showConfidence: true, onselect: () => {} } })
    expect(container.querySelectorAll('.low, .forced')).toHaveLength(0)
    expect(container.querySelector('g.connector title')?.textContent).toBe('P = 97% (forced)')
  })
  it('titles edges with the attachment confidence, including forced edges', () => {
    const withP = render(NodeTree, { props: { bunsetsu, showConfidence: true, onselect: () => {} } })
    expect(withP.container.querySelector('line.edge.low')?.closest('g.connector')?.querySelector('title')?.textContent).toContain('55')
    const forced = render(NodeTree, {
      props: { bunsetsu: forcedSentenceFixture().bunsetsu, showConfidence: true, onselect: () => {} },
    })
    expect(
      forced.container.querySelector('line.edge.forced')?.closest('g.connector')?.querySelector('title')?.textContent,
    ).toContain('forced attachment')
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
  it('exposes each bunsetsu as a named button for assistive tech', () => {
    const { getByRole } = render(NodeTree, { props: { bunsetsu, onselect: () => {} } })
    expect(getByRole('button', { name: '猫が' })).toBeInTheDocument()
  })
  it('invokes onselect on click', async () => {
    const onselect = vi.fn()
    const { getByText } = render(NodeTree, { props: { bunsetsu, onselect } })
    getByText('猫が').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onselect).toHaveBeenCalledWith(0)
  })
  it('does not let bunsetsu clicks bubble out of the component', () => {
    const onselect = vi.fn()
    const outer = vi.fn()
    const { getByText } = render(NodeTree, { props: { bunsetsu, onselect } })
    document.body.addEventListener('click', outer)
    try {
      getByText('魚を').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(onselect).toHaveBeenCalledWith(1)
      expect(outer).not.toHaveBeenCalled()
    } finally {
      document.body.removeEventListener('click', outer)
    }
  })
  it('renders plain edges by default but keeps the probability title', () => {
    const { container } = render(NodeTree, { props: { bunsetsu, onselect: () => {} } })
    expect(container.querySelectorAll('.low, .forced')).toHaveLength(0)
    const titles = [...container.querySelectorAll('g.connector title')].map((el) => el.textContent)
    expect(titles.some((text) => text?.includes('55'))).toBe(true)
  })
  it('gives every connector an identical-geometry hit twin', () => {
    const { container } = render(NodeTree, { props: { bunsetsu, onselect: () => {} } })
    const groups = [...container.querySelectorAll('g.connector')]
    expect(groups.length).toBeGreaterThan(0)
    for (const g of groups) {
      const visible = g.querySelector('line.edge')!
      const hit = g.querySelector('line.hit')!
      expect(hit.getAttribute('x1')).toBe(visible.getAttribute('x1'))
      expect(hit.getAttribute('y1')).toBe(visible.getAttribute('y1'))
      expect(hit.getAttribute('x2')).toBe(visible.getAttribute('x2'))
      expect(hit.getAttribute('y2')).toBe(visible.getAttribute('y2'))
    }
  })
  it('traces the chain beyond the immediate link on selection', () => {
    const chainB = chainSentenceFixture().bunsetsu
    const { container } = render(NodeTree, { props: { bunsetsu: chainB, selected: 0, chainColor: 'amber', onselect: () => {} } })
    const chains = container.querySelectorAll('line.edge.chain')
    expect(chains).toHaveLength(2)
    expect(container.querySelectorAll('g.bunsetsu.chain')).toHaveLength(2)
    const hl = container.querySelector('line.edge.hl')!
    expect(hl.classList.contains('chain')).toBe(false)
    expect(container.querySelector('svg')!.getAttribute('style')).toContain('--chain')
  })
  it('renders no chain elements without selection or with chainColor none', () => {
    const chainB = chainSentenceFixture().bunsetsu
    const none = render(NodeTree, { props: { bunsetsu: chainB, selected: 0, chainColor: 'none', onselect: () => {} } })
    expect(none.container.querySelectorAll('.chain')).toHaveLength(0)
    expect(none.container.querySelector('svg')!.getAttribute('style') ?? '').not.toContain('--chain')
    const unselected = render(NodeTree, { props: { bunsetsu: chainB, chainColor: 'amber', onselect: () => {} } })
    expect(unselected.container.querySelectorAll('.chain')).toHaveLength(0)
  })
  it('shows relation badges when showRelations is on', () => {
    const { container } = render(NodeTree, { props: { bunsetsu, onselect: () => {}, relationDisplay: 'badges' } })
    const labels = [...container.querySelectorAll('.relation-label')]
    expect(labels.length).toBe(bunsetsu.length)
    expect(labels.every((l) => l.getAttribute('aria-hidden') === 'true')).toBe(true)
  })
  it('shows no badges by default', () => {
    const { container } = render(NodeTree, { props: { bunsetsu, onselect: () => {} } })
    expect(container.querySelectorAll('.relation-label')).toHaveLength(0)
  })
})

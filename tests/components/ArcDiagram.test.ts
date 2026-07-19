// @vitest-environment jsdom
import { render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import ArcDiagram from '../../src/components/ArcDiagram.svelte'
import { chainSentenceFixture, forcedSentenceFixture, sentenceFixture } from '../fixtures'

const bunsetsu = sentenceFixture().bunsetsu

describe('ArcDiagram', () => {
  it('renders one box per bunsetsu and one arc per non-root', () => {
    const { container } = render(ArcDiagram, { props: { bunsetsu, onselect: () => {} } })
    expect(container.querySelectorAll('g.bunsetsu rect')).toHaveLength(3)
    expect(container.querySelectorAll('path.arc')).toHaveLength(2)
  })
  it('marks low-confidence arcs and titles them with the probability', () => {
    const { container } = render(ArcDiagram, { props: { bunsetsu, showConfidence: true, onselect: () => {} } })
    const low = container.querySelectorAll('path.arc.low')
    expect(low).toHaveLength(1)
    expect(low[0].closest('g.connector')?.querySelector('title')?.textContent).toContain('55')
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
  it('exposes each bunsetsu as a named button for assistive tech', () => {
    const { getByRole } = render(ArcDiagram, { props: { bunsetsu, onselect: () => {} } })
    expect(getByRole('button', { name: '魚を' })).toBeInTheDocument()
    expect(getByRole('button', { name: '食べた。' })).toBeInTheDocument()
  })
  it('marks the selected bunsetsu', () => {
    const { container } = render(ArcDiagram, { props: { bunsetsu, selected: 1, onselect: () => {} } })
    expect(container.querySelectorAll('g.bunsetsu.selected')).toHaveLength(1)
  })
  it('marks forced arcs with the forced class', () => {
    const forced = forcedSentenceFixture().bunsetsu
    const { container } = render(ArcDiagram, { props: { bunsetsu: forced, showConfidence: true, onselect: () => {} } })
    expect(container.querySelectorAll('path.arc.forced')).toHaveLength(1)
    expect(container.querySelector('path.arc.forced')?.closest('g.connector')?.querySelector('title')?.textContent).toContain(
      'forced attachment',
    )
    expect(container.querySelectorAll('path.arc.low')).toHaveLength(0)
  })
  it('renders a confidently-forced attachment solid, tooltip still disclosing forcedness', () => {
    const s = forcedSentenceFixture()
    s.bunsetsu[0].probability = 0.97
    const { container } = render(ArcDiagram, { props: { bunsetsu: s.bunsetsu, showConfidence: true, onselect: () => {} } })
    expect(container.querySelectorAll('.low, .forced')).toHaveLength(0)
    expect(container.querySelector('g.connector title')?.textContent).toBe('P = 97% (forced)')
  })
  it('skips furigana for bunsetsu without readings', () => {
    const forced = forcedSentenceFixture().bunsetsu
    const { container } = render(ArcDiagram, { props: { bunsetsu: forced, showFurigana: true, onselect: () => {} } })
    const furigana = container.querySelectorAll('text.furigana')
    expect(furigana).toHaveLength(1)
    expect(furigana[0].textContent).toBe('なに。')
  })
  it('supports keyboard selection with Enter', () => {
    const onselect = vi.fn()
    const { getByText } = render(ArcDiagram, { props: { bunsetsu, onselect } })
    getByText('魚を').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onselect).toHaveBeenCalledWith(1)
  })
  it('does not let bunsetsu clicks bubble out of the component', () => {
    const onselect = vi.fn()
    const outer = vi.fn()
    const { getByText } = render(ArcDiagram, { props: { bunsetsu, onselect } })
    document.body.addEventListener('click', outer)
    try {
      getByText('魚を').dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(onselect).toHaveBeenCalledWith(1)
      expect(outer).not.toHaveBeenCalled()
    } finally {
      document.body.removeEventListener('click', outer)
    }
  })
  it('renders plain connectors by default but keeps the probability title', () => {
    const { container } = render(ArcDiagram, { props: { bunsetsu, onselect: () => {} } })
    expect(container.querySelectorAll('.low, .forced')).toHaveLength(0)
    const titles = [...container.querySelectorAll('g.connector title')].map((el) => el.textContent)
    expect(titles.some((text) => text?.includes('55'))).toBe(true)
  })
  it('gives every connector an identical-geometry hit twin', () => {
    const { container } = render(ArcDiagram, { props: { bunsetsu, onselect: () => {} } })
    const groups = [...container.querySelectorAll('g.connector')]
    expect(groups.length).toBeGreaterThan(0)
    for (const g of groups) {
      const visible = g.querySelector('path.arc')!
      const hit = g.querySelector('path.hit')!
      expect(hit.getAttribute('d')).toBe(visible.getAttribute('d'))
    }
  })
  it('traces the chain beyond the immediate link on selection', () => {
    const chainB = chainSentenceFixture().bunsetsu
    const { container } = render(ArcDiagram, { props: { bunsetsu: chainB, selected: 0, chainColor: 'amber', onselect: () => {} } })
    const chains = container.querySelectorAll('path.arc.chain')
    expect(chains).toHaveLength(2)
    expect(container.querySelectorAll('g.bunsetsu.chain')).toHaveLength(2)
    const hl = container.querySelector('path.arc.hl')!
    expect(hl.classList.contains('chain')).toBe(false)
    for (const c of chains) expect(c.getAttribute('marker-end')).toContain('arrowhead-chain-')
    expect(container.querySelector('svg')!.getAttribute('style')).toContain('--chain')
  })
  it('renders no chain elements without selection or with chainColor none', () => {
    const chainB = chainSentenceFixture().bunsetsu
    const none = render(ArcDiagram, { props: { bunsetsu: chainB, selected: 0, chainColor: 'none', onselect: () => {} } })
    expect(none.container.querySelectorAll('.chain')).toHaveLength(0)
    expect(none.container.querySelector('svg')!.getAttribute('style') ?? '').not.toContain('--chain')
    const unselected = render(ArcDiagram, { props: { bunsetsu: chainB, chainColor: 'amber', onselect: () => {} } })
    expect(unselected.container.querySelectorAll('.chain')).toHaveLength(0)
  })
})

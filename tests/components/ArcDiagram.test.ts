// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import ArcDiagram from '../../src/components/ArcDiagram.svelte'
import { bunsetsuFixture, chainSentenceFixture, forcedSentenceFixture, morphemeFixture, sentenceFixture } from '../fixtures'
import { layoutArcs } from '../../src/lib/arclayout'

const bunsetsu = sentenceFixture().bunsetsu

const clauseB = [
  bunsetsuFixture(0, '本屋で', 1, 0.9, 'ほんやで', [morphemeFixture({ surface: '本屋' })], 'adverbial'),
  bunsetsuFixture(1, '買った', 2, 0.9, 'かった', [morphemeFixture({ surface: '買った', posJa: '動詞・自立' })], 'relclause'),
  bunsetsuFixture(2, '本を', 3, 0.9, 'ほんを', [morphemeFixture({ surface: '本' })], 'object'),
  bunsetsuFixture(3, '読んだ。', null, null, 'よんだ。', [morphemeFixture({ surface: '読んだ' })], 'predicate'),
]

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
  it('shows relation badges when showRelations is on', () => {
    const { container, getByRole } = render(ArcDiagram, { props: { bunsetsu, onselect: () => {}, relationDisplay: 'badges' } })
    const labels = [...container.querySelectorAll('.relation-label')]
    expect(labels.length).toBe(bunsetsu.length)
    expect(labels.every((l) => l.getAttribute('aria-hidden') === 'true')).toBe(true)
    // badges must not change the accessible name of the box itself
    expect(getByRole('button', { name: '魚を' })).toBeInTheDocument()
  })
  it('shows no badges by default', () => {
    const { container } = render(ArcDiagram, { props: { bunsetsu, onselect: () => {} } })
    expect(container.querySelectorAll('.relation-label')).toHaveLength(0)
  })
  it('points arrows head → dependent by default (ud)', () => {
    const { container } = render(ArcDiagram, { props: { bunsetsu, onselect: () => {} } })
    const l = layoutArcs(bunsetsu.map((b) => b.surface), bunsetsu.map((b) => b.head))
    const arc0 = l.arcs.find((a) => a.dep === 0)!
    const d = container.querySelector('path.arc')!.getAttribute('d')!
    expect(d.startsWith(`M ${arc0.x2 + 4} `)).toBe(true)
    expect(d.endsWith(` ${arc0.x1 + 4} ${l.arcAreaHeight}`)).toBe(true)
  })
  it('kakariuke direction restores dependent → head', () => {
    const { container } = render(ArcDiagram, { props: { bunsetsu, onselect: () => {}, arrowDirection: 'kakariuke' } })
    const l = layoutArcs(bunsetsu.map((b) => b.surface), bunsetsu.map((b) => b.head))
    const arc0 = l.arcs.find((a) => a.dep === 0)!
    expect(container.querySelector('path.arc')!.getAttribute('d')!.startsWith(`M ${arc0.x1 + 4} `)).toBe(true)
  })
  describe('arrows mode', () => {
    const chainB = chainSentenceFixture().bunsetsu
    it('labels ride the arcs; badges only for root and clause heads', () => {
      const { container } = render(ArcDiagram, { props: { bunsetsu: chainB, onselect: () => {}, relationDisplay: 'arrows' } })
      const onEdge = [...container.querySelectorAll('text.relation-label.on-edge')]
      expect(onEdge.map((l) => l.textContent)).toEqual(['relative clause', 'object', 'adverbial'])
      const badges = [...container.querySelectorAll('text.relation-label:not(.on-edge)')]
      expect(badges.map((l) => l.textContent)).toEqual(['predicate', 'main predicate'])
      expect([...container.querySelectorAll('.relation-label')].every((l) => l.getAttribute('aria-hidden') === 'true')).toBe(true)
    })
    it('apex labels sit above the box row', () => {
      const { container } = render(ArcDiagram, { props: { bunsetsu: chainB, onselect: () => {}, relationDisplay: 'arrows' } })
      const label = container.querySelector('text.relation-label.on-edge')!
      const box = container.querySelector('g.bunsetsu rect')!
      expect(Number(label.getAttribute('y'))).toBeLessThan(Number(box.getAttribute('y')))
    })
    it('arrows mode raises the arcs to make room for labels', () => {
      const chainB = chainSentenceFixture().bunsetsu
      const arrows = render(ArcDiagram, { props: { bunsetsu: chainB, onselect: () => {}, relationDisplay: 'arrows' } })
      const badges = render(ArcDiagram, { props: { bunsetsu: chainB, onselect: () => {}, relationDisplay: 'badges' } })
      const h = (r: typeof arrows) => Number(r.container.querySelector('svg')!.getAttribute('height'))
      expect(h(arrows)).toBeGreaterThan(h(badges))
    })
  })
  describe('extent bracket', () => {
    it('hovering the clause head draws the bracket over its span; leaving removes it', async () => {
      const { container } = render(ArcDiagram, { props: { bunsetsu: clauseB, onselect: () => {} } })
      expect(container.querySelector('.extent-bracket')).toBeNull()
      await fireEvent.mouseEnter([...container.querySelectorAll('g.bunsetsu')][1])
      const br = container.querySelector('.extent-bracket')!
      const l = layoutArcs(clauseB.map((b) => b.surface), clauseB.map((b) => b.head))
      expect(br.getAttribute('d')!.startsWith(`M ${l.boxes[0].x + 4} `)).toBe(true)
      expect(container.querySelector('.extent-label')!.textContent).toBe('relative clause')
      await fireEvent.mouseLeave([...container.querySelectorAll('g.bunsetsu')][1])
      expect(container.querySelector('.extent-bracket')).toBeNull()
    })
    it('selection draws it too; non-clause bunsetsu never do', () => {
      const sel = render(ArcDiagram, { props: { bunsetsu: clauseB, selected: 1, onselect: () => {} } })
      expect(sel.container.querySelector('.extent-bracket')).not.toBeNull()
      expect(sel.container.querySelector('.extent-bracket')!.getAttribute('aria-hidden')).toBe('true')
      const non = render(ArcDiagram, { props: { bunsetsu: clauseB, selected: 0, onselect: () => {} } })
      expect(non.container.querySelector('.extent-bracket')).toBeNull()
    })
    it('single-bunsetsu clauses get no bracket', async () => {
      const chainB = chainSentenceFixture().bunsetsu
      const { container } = render(ArcDiagram, { props: { bunsetsu: chainB, onselect: () => {} } })
      await fireEvent.mouseEnter([...container.querySelectorAll('g.bunsetsu')][0])
      expect(container.querySelector('.extent-bracket')).toBeNull()
    })
  })
})

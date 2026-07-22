// @vitest-environment jsdom
import { render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import StairView from '../../src/components/StairView.svelte'
import { bunsetsuFixture, chainSentenceFixture, forcedSentenceFixture, morphemeFixture, sentenceFixture } from '../fixtures'
import { layoutStairs } from '../../src/lib/stairlayout'

const bunsetsu = sentenceFixture().bunsetsu

const clauseB = [
  bunsetsuFixture(0, '本屋で', 1, 0.9, 'ほんやで', [morphemeFixture({ surface: '本屋' })], 'adverbial'),
  bunsetsuFixture(1, '買った', 2, 0.9, 'かった', [morphemeFixture({ surface: '買った', posJa: '動詞・自立' })], 'relclause'),
  bunsetsuFixture(2, '本を', 3, 0.9, 'ほんを', [morphemeFixture({ surface: '本' })], 'object'),
  bunsetsuFixture(3, '読んだ。', null, null, 'よんだ。', [morphemeFixture({ surface: '読んだ' })], 'predicate'),
]

describe('StairView', () => {
  it('renders one box per bunsetsu and one connector per non-root', () => {
    const { container } = render(StairView, { props: { bunsetsu, onselect: () => {} } })
    expect(container.querySelectorAll('g.bunsetsu rect')).toHaveLength(3)
    expect(container.querySelectorAll('path.arc')).toHaveLength(2)
  })
  it('marks low-confidence connectors and titles them with the probability', () => {
    const { container } = render(StairView, { props: { bunsetsu, showConfidence: true, onselect: () => {} } })
    const low = container.querySelectorAll('path.arc.low')
    expect(low).toHaveLength(1)
    expect(low[0].closest('g.connector')?.querySelector('title')?.textContent).toContain('55')
  })
  it('titles forced attachments', () => {
    const forced = forcedSentenceFixture().bunsetsu
    const { container } = render(StairView, { props: { bunsetsu: forced, showConfidence: true, onselect: () => {} } })
    const f = container.querySelectorAll('path.arc.forced')
    expect(f.length).toBeGreaterThan(0)
    expect(f[0].closest('g.connector')?.querySelector('title')?.textContent).toMatch(/forced/i)
  })
  it('renders a confidently-forced attachment solid, tooltip still disclosing forcedness', () => {
    const s = forcedSentenceFixture()
    s.bunsetsu[0].probability = 0.97
    const { container } = render(StairView, { props: { bunsetsu: s.bunsetsu, showConfidence: true, onselect: () => {} } })
    expect(container.querySelectorAll('.low, .forced')).toHaveLength(0)
    expect(container.querySelector('g.connector title')?.textContent).toBe('P = 97% (forced)')
  })
  it('dashes connectors by the configurable threshold', () => {
    const s = sentenceFixture()
    s.bunsetsu[0].probability = 0.75
    const at7 = render(StairView, { props: { bunsetsu: s.bunsetsu, showConfidence: true, confidenceThreshold: 0.7, onselect: () => {} } })
    expect(at7.container.querySelectorAll('path.arc.low')).toHaveLength(1)
    const at8 = render(StairView, { props: { bunsetsu: s.bunsetsu, showConfidence: true, confidenceThreshold: 0.8, onselect: () => {} } })
    expect(at8.container.querySelectorAll('path.arc.low')).toHaveLength(2)
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
  it('renders plain connectors by default but keeps the probability title', () => {
    const { container } = render(StairView, { props: { bunsetsu, onselect: () => {} } })
    expect(container.querySelectorAll('.low, .forced')).toHaveLength(0)
    const titles = [...container.querySelectorAll('svg.stairview g.connector title')].map((el) => el.textContent)
    expect(titles.some((text) => text?.includes('55'))).toBe(true)
  })
  it('gives every connector an identical-geometry hit twin', () => {
    const { container } = render(StairView, { props: { bunsetsu, onselect: () => {} } })
    const groups = [...container.querySelectorAll('svg.stairview g.connector')]
    expect(groups.length).toBeGreaterThan(0)
    for (const g of groups) {
      const visible = g.querySelector('path.arc')!
      const hit = g.querySelector('path.hit')!
      expect(hit.getAttribute('d')).toBe(visible.getAttribute('d'))
    }
  })
  it('traces the chain beyond the immediate link on selection', () => {
    const chainB = chainSentenceFixture().bunsetsu
    const { container } = render(StairView, { props: { bunsetsu: chainB, selected: 0, chainColor: 'amber', onselect: () => {} } })
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
    const none = render(StairView, { props: { bunsetsu: chainB, selected: 0, chainColor: 'none', onselect: () => {} } })
    expect(none.container.querySelectorAll('.chain')).toHaveLength(0)
    expect(none.container.querySelector('svg')!.getAttribute('style') ?? '').not.toContain('--chain')
    const unselected = render(StairView, { props: { bunsetsu: chainB, chainColor: 'amber', onselect: () => {} } })
    expect(unselected.container.querySelectorAll('.chain')).toHaveLength(0)
  })
  it('shows relation badges when showRelations is on', () => {
    const { container } = render(StairView, { props: { bunsetsu, onselect: () => {}, relationDisplay: 'badges' } })
    const labels = [...container.querySelectorAll('.relation-label')]
    expect(labels.length).toBe(bunsetsu.length)
    expect(labels.every((l) => l.getAttribute('aria-hidden') === 'true')).toBe(true)
  })
  it('shows no badges by default', () => {
    const { container } = render(StairView, { props: { bunsetsu, onselect: () => {} } })
    expect(container.querySelectorAll('.relation-label')).toHaveLength(0)
  })
  it('ud direction draws head edge → rail → dependent edge', () => {
    const { container } = render(StairView, { props: { bunsetsu, onselect: () => {} } })
    const l = layoutStairs(bunsetsu.map((b) => b.surface), bunsetsu.map((b) => b.head), { rowHeight: 46, boxCenterOffset: 17 })
    const c = l.connectors.find((x) => x.dep === 0)!
    expect(container.querySelector('.connector path.arc')!.getAttribute('d')).toBe(`M ${c.x2} ${c.y2} H ${c.railX} V ${c.y1} H ${c.x1}`)
  })
  it('kakariuke direction draws dependent edge → rail → head edge', () => {
    const { container } = render(StairView, { props: { bunsetsu, onselect: () => {}, arrowDirection: 'kakariuke' } })
    const l = layoutStairs(bunsetsu.map((b) => b.surface), bunsetsu.map((b) => b.head), { rowHeight: 46, boxCenterOffset: 17 })
    const c = l.connectors.find((x) => x.dep === 0)!
    expect(container.querySelector('.connector path.arc')!.getAttribute('d')).toBe(`M ${c.x1} ${c.y1} H ${c.railX} V ${c.y2} H ${c.x2}`)
  })
  it('arrows mode: corner labels right-aligned at the rail, badges on predicates only', () => {
    const chainB = chainSentenceFixture().bunsetsu
    const { container } = render(StairView, { props: { bunsetsu: chainB, onselect: () => {}, relationDisplay: 'arrows' } })
    const onEdge = [...container.querySelectorAll('text.relation-label.on-edge')]
    expect(onEdge.map((l) => l.textContent)).toEqual(['relative clause', 'object', 'adverbial'])
    expect(onEdge.every((l) => l.getAttribute('text-anchor') === 'end')).toBe(true)
    const badges = [...container.querySelectorAll('text.relation-label:not(.on-edge)')]
    expect(badges.map((l) => l.textContent)).toEqual(['predicate', 'main predicate'])
  })
  it('draws the extent bracket left of the covered rows on selection', () => {
    const { container } = render(StairView, { props: { bunsetsu: clauseB, selected: 1, onselect: () => {} } })
    const br = container.querySelector('.extent-bracket')!
    const l = layoutStairs(clauseB.map((b) => b.surface), clauseB.map((b) => b.head), { rowHeight: 46, boxCenterOffset: 17 })
    const bx = Math.max(-2, Math.min(l.boxes[0].x, l.boxes[1].x) - 8)
    expect(br.getAttribute('d')).toBe(`M ${bx + 6} ${l.boxes[0].y} H ${bx} V ${l.boxes[1].y + 34} H ${bx + 6}`)
  })
})

// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import NodeTree from '../../src/components/NodeTree.svelte'
import { bunsetsuFixture, chainSentenceFixture, sentenceFixture, forcedSentenceFixture, morphemeFixture } from '../fixtures'
import { layoutTree } from '../../src/lib/treelayout'
import { textWidth } from '../../src/lib/arclayout'

const bunsetsu = sentenceFixture().bunsetsu

const clauseB = [
  bunsetsuFixture(0, '本屋で', 1, 0.9, 'ほんやで', [morphemeFixture({ surface: '本屋' })], 'adverbial'),
  bunsetsuFixture(1, '買った', 2, 0.9, 'かった', [morphemeFixture({ surface: '買った', posJa: '動詞・自立' })], 'relclause'),
  bunsetsuFixture(2, '本を', 3, 0.9, 'ほんを', [morphemeFixture({ surface: '本' })], 'object'),
  bunsetsuFixture(3, '読んだ。', null, null, 'よんだ。', [morphemeFixture({ surface: '読んだ' })], 'predicate'),
]

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
  it('arrows mode: labels cap each dependent, badges on predicates only', () => {
    const chainB = chainSentenceFixture().bunsetsu
    const { container } = render(NodeTree, { props: { bunsetsu: chainB, onselect: () => {}, relationDisplay: 'arrows' } })
    // DOM order follows layout.nodes = root-first DFS: 行きました。→ 見に → 映画を → 新しい
    const onEdge = [...container.querySelectorAll('text.relation-label.on-edge')]
    expect(onEdge.map((l) => l.textContent)).toEqual(['adverbial', 'object', 'relative clause'])
    const badges = [...container.querySelectorAll('text.relation-label:not(.on-edge)')]
    expect(badges.map((l) => l.textContent)).toEqual(['main predicate', 'predicate'])
  })
  it('arrows mode stacks the label above the furigana above the box', () => {
    const chainB = chainSentenceFixture().bunsetsu
    const { container } = render(NodeTree, { props: { bunsetsu: chainB, onselect: () => {}, relationDisplay: 'arrows', showFurigana: true } })
    const g = [...container.querySelectorAll('g.bunsetsu')].find((el) => el.getAttribute('aria-label') === '新しい')!
    const labelY = Number(g.querySelector('text.relation-label.on-edge')!.getAttribute('y'))
    const furiY = Number(g.querySelector('text.furigana')!.getAttribute('y'))
    const boxY = Number(g.querySelector('rect')!.getAttribute('y'))
    expect(labelY).toBeLessThan(furiY)
    expect(furiY).toBeLessThan(boxY + 34)
  })
  describe('extent bracket side', () => {
    it('ties resolve to the right side (chain subtree, equal gaps)', () => {
      // clauseB is a pure chain → the subtree band of 買った is centered, so
      // left and right clearance are equal and the tie-break picks right
      const { container } = render(NodeTree, { props: { bunsetsu: clauseB, onselect: () => {}, selected: 1 } })
      const br = container.querySelector('.extent-bracket')!
      const widths = clauseB.map((b) => textWidth(b.surface) + 20)
      const l = layoutTree(widths, clauseB.map((b) => b.head))
      const nodesIn = l.nodes.filter((n) => n.index <= 1) // span of 買った = {0, 1}
      const maxX = Math.max(...nodesIn.map((n) => n.x + widths[n.index] / 2))
      const m = br.getAttribute('d')!.match(/H (-?[\d.]+) V/)!
      expect(Number(m[1])).toBeGreaterThanOrEqual(maxX)
    })
    it('hover works like selection and only for clause labels', async () => {
      const { container } = render(NodeTree, { props: { bunsetsu: clauseB, onselect: () => {} } })
      const clauseG = [...container.querySelectorAll('g.bunsetsu')].find((el) => el.getAttribute('aria-label') === '買った')!
      await fireEvent.mouseEnter(clauseG)
      expect(container.querySelector('.extent-bracket')).not.toBeNull()
      await fireEvent.mouseLeave(clauseG)
      expect(container.querySelector('.extent-bracket')).toBeNull()
      const nonClause = [...container.querySelectorAll('g.bunsetsu')].find((el) => el.getAttribute('aria-label') === '本屋で')!
      await fireEvent.mouseEnter(nonClause)
      expect(container.querySelector('.extent-bracket')).toBeNull()
    })
    it('prefers the open right edge over a crowded left side', () => {
      // root 4; children 0,1,3 (3 = linked-clause head with child 2): the
      // clause band {2,3} is the rightmost column, foreign boxes only on the left
      const rightmost = [
        bunsetsuFixture(0, '昨日、', 4, 0.9, 'きのう、', [morphemeFixture()], 'adverbial'),
        bunsetsuFixture(1, '私は', 4, 0.9, 'わたしは', [morphemeFixture()], 'topic'),
        bunsetsuFixture(2, '映画を', 3, 0.9, 'えいがを', [morphemeFixture()], 'object'),
        bunsetsuFixture(3, '見に', 4, 0.9, 'みに', [morphemeFixture()], 'linkedclause'),
        bunsetsuFixture(4, '行きました。', null, null, 'いきました。', [morphemeFixture()], 'predicate'),
      ]
      const { container } = render(NodeTree, { props: { bunsetsu: rightmost, onselect: () => {}, selected: 3 } })
      const widths = rightmost.map((b) => textWidth(b.surface) + 20)
      const l = layoutTree(widths, rightmost.map((b) => b.head))
      const nodesIn = l.nodes.filter((n) => n.index === 2 || n.index === 3)
      const maxX = Math.max(...nodesIn.map((n) => n.x + widths[n.index] / 2))
      const m = container.querySelector('.extent-bracket')!.getAttribute('d')!.match(/H (-?[\d.]+) V/)!
      expect(Number(m[1])).toBeGreaterThanOrEqual(maxX)
    })
    it('keeps a full gap from the nodes on a leftmost clause (uses the left gutter)', () => {
      // clause 持って、(3) is the leftmost column, foreign boxes (私は/家に/帰った)
      // only on the right → the bracket goes left, into the gutter
      const leftmost = [
        bunsetsuFixture(0, '本屋で', 1, 0.9, 'ほんやで', [morphemeFixture()], 'adverbial'),
        bunsetsuFixture(1, '買った', 2, 0.9, 'かった', [morphemeFixture()], 'relclause'),
        bunsetsuFixture(2, '本を', 3, 0.9, 'ほんを', [morphemeFixture()], 'object'),
        bunsetsuFixture(3, '持って、', 6, 0.9, 'もって', [morphemeFixture()], 'linkedclause'),
        bunsetsuFixture(4, '私は', 6, 0.9, 'わたしは', [morphemeFixture()], 'topic'),
        bunsetsuFixture(5, '家に', 6, 0.9, 'いえに', [morphemeFixture()], 'adverbial'),
        bunsetsuFixture(6, '帰った。', null, null, 'かえった', [morphemeFixture()], 'predicate'),
      ]
      const { container } = render(NodeTree, { props: { bunsetsu: leftmost, onselect: () => {}, selected: 3 } })
      const widths = leftmost.map((b) => textWidth(b.surface) + 20)
      const l = layoutTree(widths, leftmost.map((b) => b.head))
      const nodesIn = l.nodes.filter((n) => n.index >= 0 && n.index <= 3)
      const minLeftEdge = Math.min(...nodesIn.map((n) => n.x - widths[n.index] / 2)) + 4 // + PAD_X
      const x = Number(container.querySelector('.extent-bracket')!.getAttribute('d')!.match(/H (-?[\d.]+) V/)![1])
      // the 6px arm (x → x+6) points at the boxes; it must leave a clean 8px gap,
      // and the vertical bar lives in the negative gutter
      expect(minLeftEdge - (x + 6)).toBe(8)
      expect(x).toBeLessThan(0)
    })
  })
  it('edges leave badge-less boxes flush at the bottom, badged boxes below the badge', () => {
    const { container } = render(NodeTree, { props: { bunsetsu: clauseB, onselect: () => {}, relationDisplay: 'arrows' } })
    const edges = [...container.querySelectorAll('line.edge')]
    const gs = [...container.querySelectorAll('g.bunsetsu')]
    const boxBottom = (label: string) => {
      const rect = gs.find((g) => g.getAttribute('aria-label') === label)!.querySelector('rect')!
      return Number(rect.getAttribute('y')) + 34
    }
    // edge from badge-less 本を (head of 買った) starts at its box bottom
    const fromHonwo = edges.find((e) => Number(e.getAttribute('y1')) === boxBottom('本を'))
    expect(fromHonwo).toBeDefined()
    // edge from badged 買った starts 15px lower (below the badge)
    const fromKatta = edges.find((e) => Number(e.getAttribute('y1')) === boxBottom('買った') + 15)
    expect(fromKatta).toBeDefined()
  })
})

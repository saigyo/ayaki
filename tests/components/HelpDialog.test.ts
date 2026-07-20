// @vitest-environment jsdom
import { render, screen, fireEvent, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import HelpDialog from '../../src/components/HelpDialog.svelte'

// jsdom gained <dialog> showModal/close in recent versions; polyfill minimally
// if this environment lacks them so the suite doesn't hard-crash
beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  }
})

function getDialog(): HTMLDialogElement {
  const d = document.querySelector('dialog.help-dialog')
  if (!d) throw new Error('help dialog not rendered')
  return d as HTMLDialogElement
}

describe('HelpDialog', () => {
  it('renders the trigger and opens a dialog with all seven sections', async () => {
    const user = userEvent.setup()
    render(HelpDialog, { props: { chainColor: 'amber' } })
    const trigger = screen.getByRole('button', { name: 'help' })
    expect(trigger.classList.contains('help-trigger')).toBe(true)
    expect(getDialog().open).toBe(false)
    await user.click(trigger)
    const dialog = getDialog()
    expect(dialog.open).toBe(true)
    const headings = within(dialog).getAllByRole('heading', { level: 3 })
    expect(headings.map((h) => h.textContent)).toEqual([
      'What is this?',
      'The three views',
      'Reading the diagram',
      'Attachment confidence',
      'Predicate and head',
      'The parts of a bunsetsu',
      'Tips',
    ])
    expect(within(dialog).getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('auxiliary')]),
    )
    expect(dialog.querySelectorAll('.parts-example .part')).toHaveLength(5)
    expect(within(dialog).getByText(/directly to the predicate/)).toBeInTheDocument()
  })

  it('shows the live demo: 4 bunsetsu, 新しい preselected, chain traced, dotted uncertainty', async () => {
    const user = userEvent.setup()
    render(HelpDialog, { props: { chainColor: 'amber' } })
    await user.click(screen.getByRole('button', { name: 'help' }))
    const boxes = document.querySelectorAll('dialog g.bunsetsu')
    expect(boxes).toHaveLength(4)
    expect(boxes[0].classList.contains('selected')).toBe(true)
    const chained = [...document.querySelectorAll('dialog g.bunsetsu.chain')]
    expect(chained.map((g) => g.getAttribute('aria-label'))).toEqual(['見に', '行きました。'])
    expect(document.querySelectorAll('dialog path.arc.chain')).toHaveLength(2)
    // P = 0.55 on 新しい → its connector is dotted (showConfidence forced on)
    expect(document.querySelectorAll('dialog path.arc.low')).toHaveLength(1)
  })

  it('lets the reader move and clear the demo selection', async () => {
    const user = userEvent.setup()
    render(HelpDialog, { props: { chainColor: 'amber' } })
    await user.click(screen.getByRole('button', { name: 'help' }))
    const boxes = document.querySelectorAll('dialog g.bunsetsu')
    await user.click(boxes[1]) // 映画を
    expect(boxes[1].classList.contains('selected')).toBe(true)
    expect(boxes[0].classList.contains('selected')).toBe(false)
    expect([...document.querySelectorAll('dialog g.bunsetsu.chain')].map((g) => g.getAttribute('aria-label'))).toEqual([
      '行きました。',
    ])
    await user.click(boxes[1]) // re-click clears
    expect(document.querySelector('dialog g.bunsetsu.selected')).toBeNull()
    expect(document.querySelector('dialog g.bunsetsu.chain')).toBeNull()
  })

  it('falls back to amber when the configured chain color is none', async () => {
    const user = userEvent.setup()
    render(HelpDialog, { props: { chainColor: 'none' } })
    await user.click(screen.getByRole('button', { name: 'help' }))
    const svg = document.querySelector('dialog svg.stairview')
    expect(svg?.getAttribute('style') ?? '').toContain('#b07a2a')
  })

  it('closes via the close button and via backdrop click', async () => {
    const user = userEvent.setup()
    render(HelpDialog, { props: { chainColor: 'amber' } })
    await user.click(screen.getByRole('button', { name: 'help' }))
    await user.click(screen.getByRole('button', { name: 'close help' }))
    expect(getDialog().open).toBe(false)
    await user.click(screen.getByRole('button', { name: 'help' }))
    await fireEvent.click(getDialog()) // backdrop: target is the dialog element itself
    expect(getDialog().open).toBe(false)
  })

  it('stops Escape from reaching document-level listeners', async () => {
    const docListener = vi.fn()
    document.addEventListener('keydown', docListener)
    try {
      const user = userEvent.setup()
      render(HelpDialog, { props: { chainColor: 'amber' } })
      await user.click(screen.getByRole('button', { name: 'help' }))
      await fireEvent.keyDown(getDialog(), { key: 'Escape' })
      expect(docListener).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener('keydown', docListener)
    }
  })

  it('resets the demo selection to 新しい on every open', async () => {
    const user = userEvent.setup()
    render(HelpDialog, { props: { chainColor: 'amber' } })
    await user.click(screen.getByRole('button', { name: 'help' }))
    const boxes = document.querySelectorAll('dialog g.bunsetsu')
    await user.click(boxes[2])
    await user.click(screen.getByRole('button', { name: 'close help' }))
    await user.click(screen.getByRole('button', { name: 'help' }))
    expect(boxes[0].classList.contains('selected')).toBe(true)
  })
})

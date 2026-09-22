import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PomodoroTool from './PomodoroTool'

function renderPomodoroTool() {
  return render(
    <MemoryRouter>
      <PomodoroTool />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('PomodoroTool', () => {
  it('shows the full focus duration before starting', () => {
    renderPomodoroTool()
    expect(screen.getByText('25:00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '開始' })).toBeInTheDocument()
  })

  it('counts down once started, and can be paused', () => {
    renderPomodoroTool()

    fireEvent.click(screen.getByRole('button', { name: '開始' }))

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByText('24:57')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '暫停' }))

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByText('24:57')).toBeInTheDocument()
  })

  it('resets back to the full duration for the current mode', () => {
    renderPomodoroTool()

    fireEvent.click(screen.getByRole('button', { name: '開始' }))
    act(() => {
      vi.advanceTimersByTime(10_000)
    })

    fireEvent.click(screen.getByRole('button', { name: '重設' }))

    expect(screen.getByText('25:00')).toBeInTheDocument()
  })

  it('switches to break mode once the focus countdown reaches zero', () => {
    renderPomodoroTool()

    fireEvent.click(screen.getByRole('button', { name: '開始' }))
    act(() => {
      vi.advanceTimersByTime(25 * 60 * 1000)
    })

    expect(screen.getByText('05:00')).toBeInTheDocument()
    expect(screen.getByText('休息')).toHaveAttribute('data-active', 'true')
  })

  it('exposes the current mode as an honest, non-interactive status instead of a fake tab', () => {
    renderPomodoroTool()

    expect(screen.queryAllByRole('tab')).toHaveLength(0)
    expect(screen.queryAllByRole('tablist')).toHaveLength(0)
    expect(screen.getByText('專注')).toHaveAttribute('aria-current', 'true')
    expect(screen.getByText('休息')).not.toHaveAttribute('aria-current')
  })

  it('does not use a disruptive per-second aria-live region for the countdown', () => {
    renderPomodoroTool()

    expect(screen.getByText('25:00')).not.toHaveAttribute('aria-live', 'polite')
  })
})

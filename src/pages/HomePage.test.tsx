import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HomePage from './HomePage'
import { HOME_WIDGETS_STORAGE_KEY } from './homeWidgetPrefs'
import { tools } from '../app/tools'

function stubWeatherFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            url.endsWith('rhrread')
              ? {
                  temperature: { data: [{ place: '香港天文台', value: 29 }] },
                  icon: [60],
                  warningMessage: '',
                }
              : {},
          ),
      }),
    ),
  )
}

function renderHome() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<p>工具頁面</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function dashboard() {
  return screen.getByRole('region', { name: '工具列表' })
}

function dashboardPaths() {
  return within(dashboard())
    .queryAllByRole('link')
    .map((link) => link.getAttribute('href'))
}

function card(path: string) {
  const link = within(dashboard())
    .getAllByRole('link')
    .find((candidate) => candidate.getAttribute('href') === path)
  if (!link) throw new Error(`No card for ${path}`)
  return link
}

function openCustomize() {
  return userEvent.click(screen.getByRole('button', { name: '自訂工具' }))
}

const sourcePaths = tools.map((tool) => tool.path)
const [first, second, third] = tools

beforeEach(() => {
  localStorage.clear()
  stubWeatherFetch()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('HomePage', () => {
  it('renders a compact hero heading', () => {
    renderHome()

    expect(screen.getByRole('heading', { level: 1, name: /Small Tools/ })).toBeInTheDocument()
  })

  it('renders a card for every registered tool, linking to its path', () => {
    renderHome()

    for (const tool of tools) {
      const link = screen.getByRole('link', { name: new RegExp(tool.name) })
      expect(link).toHaveAttribute('href', tool.path)
    }
  })

  it('shows live Hong Kong weather on the clock and weather card', async () => {
    renderHome()

    expect(await screen.findByText('☁️ 29°C · 多雲')).toBeInTheDocument()
    expect(screen.getByText(/^\d{2}:\d{2}:\d{2}$/)).toBeInTheDocument()
  })
})

describe('HomePage widget customization', () => {
  it('renders all tools in source order by default', () => {
    renderHome()

    expect(dashboardPaths()).toEqual(sourcePaths)
  })

  it('opens an inline panel listing every tool from the 自訂工具 control', async () => {
    renderHome()
    const toggle = screen.getByRole('button', { name: '自訂工具' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await openCustomize()

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const panel = screen.getByRole('region', { name: '自訂首頁工具' })
    for (const tool of tools) {
      expect(within(panel).getByRole('checkbox', { name: `顯示 ${tool.name}` })).toBeChecked()
      expect(within(panel).getByRole('button', { name: `上移 ${tool.name}` })).toBeInTheDocument()
      expect(within(panel).getByRole('button', { name: `下移 ${tool.name}` })).toBeInTheDocument()
    }

    await userEvent.click(within(panel).getByRole('button', { name: '完成' }))

    expect(screen.queryByRole('region', { name: '自訂首頁工具' })).not.toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('hides a tool from the dashboard and persists the choice', async () => {
    const { unmount } = renderHome()
    await openCustomize()

    await userEvent.click(screen.getByRole('checkbox', { name: `顯示 ${second.name}` }))

    expect(dashboardPaths()).toEqual(sourcePaths.filter((path) => path !== second.path))
    unmount()
    renderHome()
    expect(dashboardPaths()).not.toContain(second.path)
  })

  it('shows a hidden tool again from the panel', async () => {
    renderHome()
    await openCustomize()
    const checkbox = screen.getByRole('checkbox', { name: `顯示 ${second.name}` })

    await userEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()
    await userEvent.click(checkbox)

    expect(checkbox).toBeChecked()
    expect(dashboardPaths()).toEqual(sourcePaths)
  })

  it('moves tools with the panel buttons, changing DOM order and persisting it', async () => {
    const { unmount } = renderHome()
    await openCustomize()

    await userEvent.click(screen.getByRole('button', { name: `下移 ${first.name}` }))
    await userEvent.click(screen.getByRole('button', { name: `上移 ${third.name}` }))

    const expected = [second.path, third.path, first.path, ...sourcePaths.slice(3)]
    expect(dashboardPaths()).toEqual(expected)
    const panelOrder = within(screen.getByRole('region', { name: '自訂首頁工具' }))
      .getAllByRole('checkbox')
      .map((checkbox) => checkbox.getAttribute('aria-label'))
    expect(panelOrder.slice(0, 3)).toEqual([second, third, first].map((tool) => `顯示 ${tool.name}`))
    expect(screen.getByRole('button', { name: `上移 ${second.name}` })).toBeDisabled()
    expect(screen.getByRole('button', { name: `下移 ${tools[tools.length - 1].name}` })).toBeDisabled()

    unmount()
    renderHome()
    expect(dashboardPaths()).toEqual(expected)
  })

  it('reorders cards with mouse drag-and-drop while customizing', async () => {
    const { unmount } = renderHome()
    await openCustomize()

    const dragged = card(third.path)
    fireEvent.dragStart(dragged)
    fireEvent.dragOver(card(first.path))
    fireEvent.drop(card(first.path))
    fireEvent.dragEnd(dragged)

    const expected = [third.path, first.path, second.path, ...sourcePaths.slice(3)]
    expect(dashboardPaths()).toEqual(expected)
    unmount()
    renderHome()
    expect(dashboardPaths()).toEqual(expected)
  })

  it('does not reorder by dragging when not customizing', () => {
    renderHome()

    fireEvent.dragStart(card(third.path))
    fireEvent.dragOver(card(first.path))
    fireEvent.drop(card(first.path))

    expect(dashboardPaths()).toEqual(sourcePaths)
  })

  it('suppresses card navigation during an active drag', async () => {
    renderHome()
    await openCustomize()

    fireEvent.dragStart(card(second.path))
    fireEvent.click(card(second.path))

    expect(screen.queryByText('工具頁面')).not.toBeInTheDocument()
  })

  it('keeps normal card clicks working while customizing', async () => {
    renderHome()
    await openCustomize()

    await userEvent.click(card(second.path))

    expect(screen.getByText('工具頁面')).toBeInTheDocument()
  })

  it('does not leave card links blocked when customization closes mid-drag', async () => {
    renderHome()
    await openCustomize()

    fireEvent.dragStart(card(second.path))
    await userEvent.click(screen.getByRole('button', { name: '完成' }))
    await userEvent.click(card(second.path))

    expect(screen.getByText('工具頁面')).toBeInTheDocument()
  })

  it.each([
    ['dropped on another card', true],
    ['cancelled', false],
  ])('suppresses only the click right after a completed drag (%s)', async (_label, dropped) => {
    renderHome()
    await openCustomize()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    const dragged = card(second.path)
    fireEvent.dragStart(dragged)
    if (dropped) {
      fireEvent.dragOver(card(first.path))
      fireEvent.drop(card(first.path))
    }
    fireEvent.dragEnd(dragged)
    fireEvent.click(card(second.path))
    expect(screen.queryByText('工具頁面')).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    fireEvent.click(card(second.path))
    expect(screen.getByText('工具頁面')).toBeInTheDocument()
  })

  it('restores saved preferences on a fresh render', () => {
    localStorage.setItem(
      HOME_WIDGETS_STORAGE_KEY,
      JSON.stringify({ order: [...tools].reverse().map((tool) => tool.id), hidden: [first.id] }),
    )

    renderHome()

    expect(dashboardPaths()).toEqual([...sourcePaths].reverse().filter((path) => path !== first.path))
  })

  it('normalizes stale preferences: unknown and duplicate IDs dropped, new tools appended visible', async () => {
    localStorage.setItem(
      HOME_WIDGETS_STORAGE_KEY,
      JSON.stringify({
        order: [third.id, 'retired-tool', first.id, third.id],
        hidden: [first.id, 'retired-tool'],
      }),
    )

    renderHome()

    const expected = [
      third.path,
      ...sourcePaths.filter((path) => path !== third.path && path !== first.path),
    ]
    expect(dashboardPaths()).toEqual(expected)
    await openCustomize()
    expect(screen.getAllByRole('checkbox')).toHaveLength(tools.length)
    expect(screen.getByRole('checkbox', { name: `顯示 ${first.name}` })).not.toBeChecked()
  })

  it.each(['{broken', '"text"', '[1,2]', 'null'])('ignores malformed stored value %s', (value) => {
    localStorage.setItem(HOME_WIDGETS_STORAGE_KEY, value)

    renderHome()

    expect(dashboardPaths()).toEqual(sourcePaths)
  })

  it('resets to source order with every tool visible', async () => {
    const { unmount } = renderHome()
    await openCustomize()
    await userEvent.click(screen.getByRole('button', { name: `下移 ${first.name}` }))
    await userEvent.click(screen.getByRole('checkbox', { name: `顯示 ${third.name}` }))

    await userEvent.click(screen.getByRole('button', { name: '重設預設' }))

    expect(dashboardPaths()).toEqual(sourcePaths)
    expect(screen.getByRole('checkbox', { name: `顯示 ${third.name}` })).toBeChecked()
    unmount()
    renderHome()
    expect(dashboardPaths()).toEqual(sourcePaths)
  })

  it('shows a recoverable empty state when every tool is hidden', async () => {
    renderHome()
    await openCustomize()
    for (const tool of tools) {
      await userEvent.click(screen.getByRole('checkbox', { name: `顯示 ${tool.name}` }))
    }
    await userEvent.click(screen.getByRole('button', { name: '完成' }))

    expect(dashboardPaths()).toEqual([])
    expect(screen.getByText(/所有工具都已隱藏/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '選擇要顯示的工具' }))
    await userEvent.click(screen.getByRole('checkbox', { name: `顯示 ${second.name}` }))

    expect(dashboardPaths()).toEqual([second.path])
    expect(screen.queryByText(/所有工具都已隱藏/)).not.toBeInTheDocument()
  })

  it('keeps working when storage reads and writes throw', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    renderHome()
    expect(dashboardPaths()).toEqual(sourcePaths)

    await openCustomize()
    await userEvent.click(screen.getByRole('checkbox', { name: `顯示 ${first.name}` }))

    expect(dashboardPaths()).toEqual(sourcePaths.slice(1))
  })
})

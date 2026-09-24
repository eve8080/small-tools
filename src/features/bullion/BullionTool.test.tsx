import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BullionTool from './BullionTool'

const METALS = {
  metals: {
    XAU: { priceUsd: 4000, previousCloseUsd: 3960, changePercent: 1.01, time: '2026-09-24 22:58:00' },
    XAG: { priceUsd: 50, previousCloseUsd: 51, changePercent: -1.96, time: '2026-09-24 22:58:00' },
  },
  usdHkd: 7.8,
}

const POSITIONS = [
  { name: '金條', symbol: null, asset_class: '貴金屬', quantity: 2, quantity_unit: 'oz', market_value_hkd: 60000 },
  { name: 'HKD Savings', symbol: null, asset_class: '現金存款', quantity: 1, market_value_hkd: 5000 },
]

function stubFetch() {
  const fetchMock = vi.fn((url: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(url.startsWith('/api/asset_positions') ? POSITIONS : METALS),
    }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderTool() {
  return render(
    <MemoryRouter>
      <BullionTool />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('BullionTool', () => {
  it('shows spot prices without a password', async () => {
    const fetchMock = stubFetch()
    renderTool()

    expect(await screen.findByText('現貨價格')).toBeInTheDocument()
    expect(screen.getAllByText('US$4,000.00').length).toBeGreaterThan(0)
    expect(screen.getByText('今日 +1.01%')).toHaveAttribute('data-change', 'up')
    expect(screen.getByLabelText('密碼')).toBeInTheDocument()
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/metals'])
  })

  it('shows bullion holdings and today’s gain once unlocked', async () => {
    localStorage.setItem('small-tools:assets-password', 'pw')
    stubFetch()
    renderTool()

    expect(await screen.findByText('共 1 種貴金屬')).toBeInTheDocument()
    expect(screen.getAllByText('HK$62,400').length).toBeGreaterThan(0)
    expect(screen.getByText(/今日 \+HK\$624/)).toHaveAttribute('data-change', 'up')
  })
})

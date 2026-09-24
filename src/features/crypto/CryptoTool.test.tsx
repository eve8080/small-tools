import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CryptoTool from './CryptoTool'

const BTC = {
  id: 'bitcoin',
  symbol: 'btc',
  name: 'Bitcoin',
  image: null,
  market_cap_rank: 1,
  current_price: 600000,
  price_change_24h: -6000,
  price_change_percentage_24h: -1,
  market_cap: 12e12,
}

const POSITIONS = [
  { name: 'Bitcoin', symbol: 'BTC', asset_class: '加密貨幣', quantity: 2, current_price: 70000, currency_code: 'USD', market_value_hkd: 1100000, price_date: '2026-09-23' },
  { name: 'HKD Savings', symbol: null, asset_class: '現金存款', quantity: 1, currency_code: 'HKD', market_value_hkd: 5000 },
]

function stubFetch() {
  const fetchMock = vi.fn((url: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve(
          url.startsWith('/api/asset_positions')
            ? POSITIONS
            : {
                top: [BTC],
                held: url.includes('symbols=btc') ? [BTC] : [],
                global: { total_market_cap: { hkd: 30e12 }, market_cap_change_percentage_24h_usd: 1.2, market_cap_percentage: { btc: 56 } },
              },
        ),
    }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderTool() {
  return render(
    <MemoryRouter>
      <CryptoTool />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('CryptoTool', () => {
  it('shows market data without a password', async () => {
    const fetchMock = stubFetch()
    renderTool()

    expect(await screen.findByText('市值前 10 名')).toBeInTheDocument()
    expect(screen.getByText('BTC 佔比 56.0%')).toBeInTheDocument()
    expect(screen.getByLabelText('密碼')).toBeInTheDocument()
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/crypto?symbols='])
  })

  it('shows crypto holdings and the 24h gain once unlocked', async () => {
    localStorage.setItem('small-tools:assets-password', 'pw')
    stubFetch()
    renderTool()

    expect(await screen.findByText('共 1 種加密貨幣')).toBeInTheDocument()
    expect(screen.getAllByText('HK$1,200,000').length).toBeGreaterThan(0)
    expect(screen.getByText(/24 小時 −HK\$12,000/)).toHaveAttribute('data-change', 'down')
  })

  it('shows Supabase prices and values when live market data is unavailable', async () => {
    localStorage.setItem('small-tools:assets-password', 'pw')
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url.startsWith('/api/asset_positions')
            ? { ok: true, status: 200, json: () => Promise.resolve(POSITIONS) }
            : { ok: false, status: 502, json: () => Promise.resolve({ error: 'Upstream unavailable' }) },
        ),
      ),
    )
    renderTool()

    expect(await screen.findByText('共 1 種加密貨幣 · 部分以 Supabase 價格計算')).toBeInTheDocument()
    expect(screen.getAllByText('HK$1,100,000').length).toBeGreaterThan(0)
    expect(screen.getByText('HK$550,000')).toBeInTheDocument()
    expect(screen.getByText('Supabase · 2026-09-23')).toBeInTheDocument()
    expect(screen.getByText('24 小時 —')).toBeInTheDocument()
  })
})

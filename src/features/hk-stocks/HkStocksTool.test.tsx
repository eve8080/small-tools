import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HkStocksTool from './HkStocksTool'

const QUOTES = {
  quotes: {
    HSI: { price: 24761.13, previousClose: 24834.12, change: -72.99, changePercent: -0.29, time: '2026/09/24 16:08:39' },
    '00001': { price: 68.1, previousClose: 67.6, change: 0.5, changePercent: 0.74, time: '2026/09/24 16:08:39' },
  },
}

const POSITIONS = [
  { name: '長和', symbol: '0001.HK', asset_class: '港股', quantity: 1000, current_price: 67.6, currency_code: 'HKD', market_value_hkd: 67600 },
  { name: 'Apple', symbol: 'AAPL', asset_class: '美股個股', quantity: 10, current_price: 200, currency_code: 'USD', market_value_hkd: 15600 },
]

function stubFetch() {
  const fetchMock = vi.fn((url: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(url.startsWith('/api/hk-quotes') ? QUOTES : POSITIONS),
    }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderTool() {
  return render(
    <MemoryRouter>
      <HkStocksTool />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('HkStocksTool', () => {
  it('shows the Hang Seng Index without a password', async () => {
    const fetchMock = stubFetch()
    renderTool()

    expect(await screen.findByText('24,761.13')).toBeInTheDocument()
    expect(screen.getByText('−72.99 (−0.29%)')).toHaveAttribute('data-change', 'down')
    expect(screen.getByLabelText('密碼')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/hk-quotes?codes=HSI')
  })

  it('shows HK holdings total and today’s gain once unlocked', async () => {
    localStorage.setItem('small-tools:assets-password', 'pw')
    const fetchMock = stubFetch()
    renderTool()

    expect(await screen.findByText('共 1 隻港股')).toBeInTheDocument()
    expect(screen.getAllByText('HK$68,100').length).toBeGreaterThan(0)
    expect(screen.getByText(/今日 \+HK\$500/)).toHaveAttribute('data-change', 'up')
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/hk-quotes?codes=HSI,00001')).toBe(true)
  })
})

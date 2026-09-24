import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HkMarketTool from './HkMarketTool'

const QUOTES = {
  quotes: {
    HSI: { price: 24761.13, previousClose: 24834.12, change: -72.99, changePercent: -0.29, high: 24791.2, low: 24648.29, turnover: 1, time: '2026/09/24 16:08:39' },
    '00700': { price: 438.4, previousClose: 441, change: -2.6, changePercent: -0.59, high: 439.8, low: 433.4, turnover: 6237711469, time: null },
    '00857': { price: 8, previousClose: 7.83, change: 0.17, changePercent: 2.17, high: 8.1, low: 7.8, turnover: 900000000, time: null },
  },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('HkMarketTool', () => {
  it('draws indices, breadth, sectors, heat map and movers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(QUOTES) })
    vi.stubGlobal('fetch', fetchMock)
    render(
      <MemoryRouter>
        <HkMarketTool />
      </MemoryRouter>,
    )

    expect(await screen.findByText('24,761.13')).toBeInTheDocument()
    expect(screen.getByLabelText('今日波幅 24,648.29 至 24,791.20')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '上升 1 隻，下跌 1 隻，不變 0 隻' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '板塊表現' })).toBeInTheDocument()
    expect(screen.getAllByText('騰訊控股').length).toBeGreaterThan(1)
    expect(screen.getByText('HK$62.4億')).toBeInTheDocument()
    expect(fetchMock.mock.calls[0][0]).toMatch(/^\/api\/hk-quotes\?codes=HSI,HSCEI,HSTECH,HSCCI,00005,/)
  })

  it('shows an error when quotes fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    render(
      <MemoryRouter>
        <HkMarketTool />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('暫時無法取得即時報價')
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HkHeatmapTool from './HkHeatmapTool'
import HkHeatmapCardPreview from './HkHeatmapCardPreview'

const QUOTES = {
  quotes: {
    HSI: { price: 24761.13, previousClose: 24834.12, change: -72.99, changePercent: -0.29, time: '2026/09/24 16:08:39' },
    '00700': { price: 438.4, previousClose: 441, change: -2.6, changePercent: -0.59, high: 439.8, low: 433.4, turnover: 6.2e9, marketCap: 3.99e12, time: null },
    '00005': { price: 156.9, previousClose: 159.5, change: -2.6, changePercent: -1.63, high: 158.4, low: 156.3, turnover: 1.7e9, marketCap: 2.69e12, time: null },
    '00857': { price: 8, previousClose: 7.83, change: 0.17, changePercent: 2.17, high: 8.1, low: 7.8, turnover: 9e8, marketCap: 3e11, time: null },
  },
}

function stubQuotes() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(QUOTES) }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('HkHeatmapTool', () => {
  it('draws a tile per stock and shows details when one is tapped', async () => {
    stubQuotes()
    render(
      <MemoryRouter>
        <HkHeatmapTool />
      </MemoryRouter>,
    )

    const tencent = await screen.findByRole('button', { name: '騰訊控股 −0.59%' })
    expect(screen.getByRole('button', { name: '滙豐控股 −1.63%' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '中國石油 +2.17%' })).toBeInTheDocument()
    expect(screen.getByText('點選方塊查看股份詳情。')).toBeInTheDocument()

    fireEvent.click(tencent)
    expect(tencent).toHaveAttribute('data-selected', 'true')
    expect(screen.getByText('HK$3.99萬億')).toBeInTheDocument()
    expect(screen.getByText('433.40 – 439.80')).toBeInTheDocument()

    fireEvent.click(tencent)
    expect(screen.getByText('點選方塊查看股份詳情。')).toBeInTheDocument()
  })

  it('switches tile size between market value and turnover', async () => {
    stubQuotes()
    render(
      <MemoryRouter>
        <HkHeatmapTool />
      </MemoryRouter>,
    )
    await screen.findByRole('button', { name: '騰訊控股 −0.59%' })

    const byTurnover = screen.getByRole('button', { name: '按成交額' })
    fireEvent.click(byTurnover)
    expect(byTurnover).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/方塊面積按成交額/)).toBeInTheDocument()
  })
})

it('shows a non-interactive mini heat map on the home card', async () => {
  stubQuotes()
  render(<HkHeatmapCardPreview />)

  expect(await screen.findByRole('img', { name: '港股熱圖' })).toBeInTheDocument()
  expect(screen.queryAllByRole('button')).toHaveLength(0)
  expect(screen.getByText('升 1')).toBeInTheDocument()
  expect(screen.getByText('跌 2')).toBeInTheDocument()
})

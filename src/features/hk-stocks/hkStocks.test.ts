import { describe, expect, it, vi } from 'vitest'
import type { AssetPosition } from '../assets/assetsClient'
import { fetchHkQuotes, formatSignedHkd, normalizeHkCode, summarizeHoldings, type Quote } from './hkStocks'

function position(overrides: Partial<AssetPosition>): AssetPosition {
  return {
    name: null,
    symbol: null,
    asset_class: '港股',
    account: null,
    quantity: null,
    current_price: null,
    currency_code: 'HKD',
    market_value_hkd: null,
    price_date: null,
    ...overrides,
  }
}

function quote(price: number, previousClose: number): Quote {
  return { price, previousClose, change: price - previousClose, changePercent: null, time: null }
}

describe('normalizeHkCode', () => {
  it.each([
    ['0001.HK', '00001'],
    ['700', '00700'],
    ['09988.hk', '09988'],
    ['AAPL', null],
    [null, null],
  ])('%s → %s', (symbol, expected) => {
    expect(normalizeHkCode(symbol)).toBe(expected)
  })
})

describe('summarizeHoldings', () => {
  it('values HK stocks at live prices and sums today’s gain', () => {
    const positions = [
      position({ name: '長和', symbol: '0001.HK', quantity: 1000, market_value_hkd: 60000 }),
      position({ name: '騰訊', symbol: '0700.HK', quantity: 100, market_value_hkd: 40000 }),
      position({ name: 'Apple', symbol: 'AAPL', asset_class: '美股個股', quantity: 10, market_value_hkd: 99999 }),
    ]
    const summary = summarizeHoldings(positions, { '00001': quote(68, 67.5), '00700': quote(400, 410) })

    expect(summary.rows.map((row) => row.name)).toEqual(['長和', '騰訊'])
    expect(summary.totalHkd).toBe(108000)
    expect(summary.dayGainHkd).toBe(500 - 1000)
    expect(summary.dayGainPercent).toBeCloseTo((-500 / 108500) * 100)
    expect(summary.complete).toBe(true)
  })

  it('falls back to the stored value when a quote is missing', () => {
    const summary = summarizeHoldings(
      [position({ name: '長和', symbol: '0001.HK', quantity: 1000, market_value_hkd: 60000 })],
      {},
    )
    expect(summary.totalHkd).toBe(60000)
    expect(summary.dayGainHkd).toBe(0)
    expect(summary.rows[0].dayGainHkd).toBeNull()
    expect(summary.complete).toBe(false)
  })

  it('converts non-HKD counters using the stored exchange rate', () => {
    const summary = summarizeHoldings(
      [position({ symbol: '80700', currency_code: 'CNY', quantity: 100, current_price: 10, market_value_hkd: 1080 })],
      { '80700': quote(11, 10) },
    )
    expect(summary.totalHkd).toBeCloseTo(1188)
    expect(summary.dayGainHkd).toBeCloseTo(108)
  })
})

describe('fetchHkQuotes', () => {
  it('requests the Worker endpoint and returns quotes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ quotes: { HSI: quote(100, 99) } }),
    })
    const result = await fetchHkQuotes(['HSI', '00001'], fetchMock)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/hk-quotes?codes=HSI,00001')
    expect(result).toEqual({ ok: true, quotes: { HSI: quote(100, 99) } })
  })

  it('reports failures', async () => {
    expect((await fetchHkQuotes(['HSI'], vi.fn().mockRejectedValue(new Error('x')))).ok).toBe(false)
    expect((await fetchHkQuotes(['HSI'], vi.fn().mockResolvedValue({ ok: false }))).ok).toBe(false)
  })
})

it('formats signed HKD amounts', () => {
  expect(formatSignedHkd(1234)).toMatch(/^\+.*1,234$/)
  expect(formatSignedHkd(-1234)).toMatch(/^−.*1,234$/)
})

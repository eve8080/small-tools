import { describe, expect, it, vi } from 'vitest'
import type { AssetPosition } from '../assets/assetsClient'
import { fetchCryptoMarket, normalizeCryptoSymbol, summarizeCryptoHoldings, type CoinMarket } from './crypto'

function position(overrides: Partial<AssetPosition>): AssetPosition {
  return {
    name: null,
    symbol: null,
    asset_class: '加密貨幣',
    account: null,
    quantity: null,
    current_price: null,
    currency_code: 'USD',
    market_value_hkd: null,
    price_date: null,
    ...overrides,
  }
}

function coin(symbol: string, priceHkd: number, change24hHkd: number): CoinMarket {
  return {
    id: symbol,
    symbol,
    name: symbol.toUpperCase(),
    image: null,
    rank: 1,
    priceHkd,
    change24hHkd,
    change24hPercent: null,
    marketCapHkd: null,
  }
}

describe('normalizeCryptoSymbol', () => {
  it.each([
    ['BTC', 'btc'],
    [' eth ', 'eth'],
    ['BTC-USD', 'btc'],
    ['SOL/USDT', 'sol'],
    ['', null],
    [null, null],
  ])('%s → %s', (symbol, expected) => {
    expect(normalizeCryptoSymbol(symbol)).toBe(expected)
  })
})

describe('summarizeCryptoHoldings', () => {
  it('values holdings live, groups the same coin, and sums the 24h change', () => {
    const summary = summarizeCryptoHoldings(
      [
        position({ symbol: 'BTC', account: 'cold-wallet', quantity: 1 }),
        position({ symbol: 'btc', account: 'exchange', quantity: 0.5, asset_class: 'crypto' }),
        position({ symbol: 'ETH', quantity: 10 }),
        position({ symbol: 'AAPL', asset_class: '美股個股', quantity: 5, market_value_hkd: 9999 }),
      ],
      { btc: coin('btc', 600000, -6000), eth: coin('eth', 20000, 400) },
    )

    expect(summary.rows).toHaveLength(2)
    expect(summary.rows[0]).toMatchObject({ symbol: 'BTC', quantity: 1.5, valueHkd: 900000, change24hHkd: -9000 })
    expect(summary.totalHkd).toBe(1100000)
    expect(summary.change24hHkd).toBe(-9000 + 4000)
    expect(summary.change24hPercent).toBeCloseTo((-5000 / 1105000) * 100)
    expect(summary.complete).toBe(true)
  })

  it('falls back to the stored value when a coin has no market data', () => {
    const summary = summarizeCryptoHoldings([position({ symbol: 'XYZ', quantity: 3, market_value_hkd: 1200 })], {})
    expect(summary.totalHkd).toBe(1200)
    expect(summary.rows[0].change24hHkd).toBeNull()
    expect(summary.complete).toBe(false)
  })
})

describe('fetchCryptoMarket', () => {
  const rawCoin = {
    id: 'bitcoin',
    symbol: 'btc',
    name: 'Bitcoin',
    image: 'https://img/btc.png',
    market_cap_rank: 1,
    current_price: 659730,
    price_change_24h: -1559.6,
    price_change_percentage_24h: -0.25,
    market_cap: 13253133013205,
  }

  it('loads top coins, held coins and global data from the Worker', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          top: [rawCoin],
          held: [rawCoin, { ...rawCoin, id: 'other-btc', current_price: 1 }],
          global: { total_market_cap: { hkd: 30e12 }, market_cap_change_percentage_24h_usd: 1.5, market_cap_percentage: { btc: 56.2 } },
        }),
    })

    const result = await fetchCryptoMarket(['btc', 'eth'], fetchMock)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/crypto?symbols=btc,eth')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.top[0]).toMatchObject({ name: 'Bitcoin', priceHkd: 659730, rank: 1 })
    expect(result.data.held.btc).toMatchObject({ id: 'bitcoin', change24hHkd: -1559.6 })
    expect(result.data.global).toEqual({ marketCapHkd: 30e12, marketCapChange24hPercent: 1.5, btcDominance: 56.2 })
  })

  it('reports failures', async () => {
    expect((await fetchCryptoMarket([], vi.fn().mockResolvedValue({ ok: false, status: 502 }))).ok).toBe(false)
    expect((await fetchCryptoMarket([], vi.fn().mockRejectedValue(new Error('offline')))).ok).toBe(false)
  })
})

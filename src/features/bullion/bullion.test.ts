import { describe, expect, it, vi } from 'vitest'
import type { AssetPosition } from '../assets/assetsClient'
import { TROY_OUNCES_PER_TAEL, detectMetal, fetchMetals, hkdPerTael, summarizeBullion, type MetalsData } from './bullion'

function position(overrides: Partial<AssetPosition>): AssetPosition {
  return {
    name: null,
    symbol: null,
    asset_class: '貴金屬',
    account: null,
    quantity: null,
    quantity_unit: null,
    current_price: null,
    currency_code: 'HKD',
    market_value_hkd: null,
    price_date: null,
    ...overrides,
  }
}

const MARKET: MetalsData = {
  metals: {
    XAU: { priceUsd: 4000, previousCloseUsd: 3960, changePercent: 1.01, time: null },
    XAG: { priceUsd: 50, previousCloseUsd: 51, changePercent: -1.96, time: null },
  },
  usdHkd: 7.8,
}

describe('detectMetal', () => {
  it.each([
    ['恒生金粒 (1両)', 'XAU'],
    ['Gold bar', 'XAU'],
    ['白銀', 'XAG'],
    ['鉑金幣', 'XPT'],
    ['白金', 'XPT'],
    ['鈀金', 'XPD'],
    ['Savings', null],
  ])('%s → %s', (name, expected) => {
    expect(detectMetal(position({ name }))).toBe(expected)
  })

  it('uses the symbol too', () => {
    expect(detectMetal(position({ symbol: 'XAG' }))).toBe('XAG')
  })
})

describe('summarizeBullion', () => {
  it('values holdings at spot, converting taels, grams and ounces, grouped by metal', () => {
    const summary = summarizeBullion(
      [
        position({ name: '恒生金粒', quantity: 10, quantity_unit: 'taels' }),
        position({ name: '金條', quantity: 1, quantity_unit: 'oz' }),
        position({ name: '銀條', quantity: 311.034768, quantity_unit: 'g' }),
        position({ name: 'BTC', asset_class: '加密貨幣', quantity: 1, quantity_unit: 'oz' }),
      ],
      MARKET,
    )

    expect(summary.rows.map((row) => row.name)).toEqual(['黃金', '白銀'])
    const goldOunces = 10 * TROY_OUNCES_PER_TAEL + 1
    expect(summary.rows[0].valueHkd).toBeCloseTo(goldOunces * 4000 * 7.8)
    expect(summary.rows[0].dayGainHkd).toBeCloseTo(goldOunces * 40 * 7.8)
    expect(summary.rows[0].quantityLabel).toBe(`${goldOunces.toFixed(4).replace(/0+$/, '')} 盎司`)
    expect(summary.rows[1]).toMatchObject({ quantityLabel: '311.0348 克' })
    expect(summary.rows[1].valueHkd).toBeCloseTo(10 * 50 * 7.8)
    expect(summary.rows[1].dayGainHkd).toBeCloseTo(-10 * 7.8)
    expect(summary.complete).toBe(true)
  })

  it('keeps a single unit label when every position uses it', () => {
    const summary = summarizeBullion([position({ name: '金粒', quantity: 5, quantity_unit: '両' })], MARKET)
    expect(summary.rows[0].quantityLabel).toBe('5 両')
  })

  it('falls back to the stored value for unknown metals, units, or missing prices', () => {
    const summary = summarizeBullion(
      [
        position({ name: 'Mystery coin', quantity: 1, quantity_unit: 'oz', market_value_hkd: 1000 }),
        position({ name: '金粒', quantity: 1, quantity_unit: 'bars', market_value_hkd: 2000 }),
      ],
      MARKET,
    )
    expect(summary.totalHkd).toBe(3000)
    expect(summary.dayGainHkd).toBe(0)
    expect(summary.complete).toBe(false)

    expect(summarizeBullion([position({ name: '金粒', quantity: 1, quantity_unit: 'oz', market_value_hkd: 500 })], null).totalHkd).toBe(500)
  })
})

describe('fetchMetals', () => {
  it('loads from the Worker and reports failures', async () => {
    const ok = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(MARKET) })
    expect(await fetchMetals(ok)).toEqual({ ok: true, data: MARKET })
    expect(ok.mock.calls[0][0]).toBe('/api/metals')
    expect((await fetchMetals(vi.fn().mockResolvedValue({ ok: false }))).ok).toBe(false)
    expect((await fetchMetals(vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }))).ok).toBe(false)
    expect((await fetchMetals(vi.fn().mockRejectedValue(new Error('x')))).ok).toBe(false)
  })
})

it('converts USD per ounce to HKD per tael', () => {
  expect(hkdPerTael(MARKET.metals.XAU!, 7.8)).toBeCloseTo(4000 * 1.20337 * 7.8, 0)
})

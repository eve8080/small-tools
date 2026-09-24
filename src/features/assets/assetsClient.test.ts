import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearStoredPassword,
  fetchAssetPositions,
  formatHkd,
  latestPriceDate,
  loadStoredPassword,
  storePassword,
  totalValueHkd,
  type AssetPosition,
} from './assetsClient'

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) }
}

afterEach(() => {
  localStorage.clear()
})

describe('fetchAssetPositions', () => {
  it('calls the same-origin proxy with the password and parses numeric strings', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        { name: '現金', market_value_hkd: '1000.5', quantity: '1', current_price: null, is_active: true },
        { name: '已平倉', market_value_hkd: 500, is_active: false },
      ]),
    )

    const result = await fetchAssetPositions('pw', fetchMock)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toMatch(/^\/api\/asset_positions\?/)
    expect(init.headers).toEqual({ Authorization: 'Bearer pw' })
    expect(result.ok && result.positions).toEqual([
      expect.objectContaining({ name: '現金', market_value_hkd: 1000.5, quantity: 1, current_price: null }),
    ])
  })

  it('flags a wrong password as unauthorized', async () => {
    const result = await fetchAssetPositions('bad', vi.fn().mockResolvedValue(jsonResponse({}, 401)))
    expect(result).toEqual(expect.objectContaining({ ok: false, unauthorized: true }))
  })

  it('surfaces server and network errors', async () => {
    expect((await fetchAssetPositions('pw', vi.fn().mockResolvedValue(jsonResponse({}, 502)))).ok).toBe(false)
    expect((await fetchAssetPositions('pw', vi.fn().mockRejectedValue(new TypeError('offline')))).ok).toBe(false)
  })
})

describe('summaries', () => {
  const positions = [
    { market_value_hkd: 1000, price_date: '2026-09-23' },
    { market_value_hkd: null, price_date: null },
    { market_value_hkd: 250.5, price_date: '2026-09-24' },
  ] as AssetPosition[]

  it('totals market values, treating missing values as zero', () => {
    expect(totalValueHkd(positions)).toBe(1250.5)
  })

  it('finds the latest price date', () => {
    expect(latestPriceDate(positions)).toBe('2026-09-24')
  })

  it('formats HKD without decimals', () => {
    expect(formatHkd(1234567.8)).toContain('1,234,568')
  })
})

describe('password storage', () => {
  it('stores, loads and clears the password', () => {
    expect(loadStoredPassword()).toBe('')
    storePassword('pw')
    expect(loadStoredPassword()).toBe('pw')
    clearStoredPassword()
    expect(loadStoredPassword()).toBe('')
  })
})

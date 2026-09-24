import { describe, expect, it } from 'vitest'
import type { Quote } from '../hk-stocks/hkStocks'
import { BLUE_CHIPS } from './blueChips'
import { MARKET_CODES, buildSnapshot, formatTurnover, heatColor, rangePosition } from './hkMarket'

function quote(changePercent: number, turnover: number): Quote {
  return { price: 100 + changePercent, previousClose: 100, change: changePercent, changePercent, turnover, time: null }
}

describe('blue-chip list', () => {
  it('has unique 5-digit codes and fits the quote endpoint limit with the indices', () => {
    const codes = BLUE_CHIPS.map((chip) => chip.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes.every((code) => /^\d{5}$/.test(code))).toBe(true)
    expect(MARKET_CODES.length).toBeLessThanOrEqual(100)
  })
})

describe('buildSnapshot', () => {
  const snapshot = buildSnapshot({
    '00005': quote(2, 1000), // 金融
    '00388': quote(-1, 3000), // 金融
    '00700': quote(-3, 5000), // 科技
    '09988': quote(1, 1000), // 科技
    '00002': quote(0, 100), // 公用
  })

  it('counts rising, falling and unchanged stocks', () => {
    expect(snapshot.breadth).toEqual({ up: 2, down: 2, flat: 1 })
    expect(snapshot.stocks).toHaveLength(5)
    expect(snapshot.turnover).toBe(10100)
  })

  it('weights sector moves by turnover and sorts best first', () => {
    expect(snapshot.sectors.map((sector) => sector.sector)).toEqual(['公用', '金融', '科技'])
    expect(snapshot.sectors[1].changePercent).toBeCloseTo((2 * 1000 - 1 * 3000) / 4000)
    expect(snapshot.sectors[2].stocks.map((stock) => stock.code)).toEqual(['00700', '09988'])
  })

  it('lists top gainers, losers and most active', () => {
    expect(snapshot.gainers.map((stock) => stock.code)).toEqual(['00005', '09988'])
    expect(snapshot.losers.map((stock) => stock.code)).toEqual(['00700', '00388'])
    expect(snapshot.mostActive[0].name).toBe('騰訊控股')
  })
})

it('places a value within the day range', () => {
  expect(rangePosition(15, 10, 20)).toBe(0.5)
  expect(rangePosition(25, 10, 20)).toBe(1)
  expect(rangePosition(15, null, 20)).toBeNull()
  expect(rangePosition(15, 20, 20)).toBeNull()
})

it('colours heat-map tiles by direction and size of move', () => {
  expect(heatColor(0)).toBe('var(--color-surface)')
  expect(heatColor(1.5)).toContain('var(--color-success) 45%')
  expect(heatColor(-9)).toContain('var(--color-error) 80%')
})

it('formats turnover in 億 and 萬', () => {
  expect(formatTurnover(6_237_711_469)).toBe('HK$62.4億')
  expect(formatTurnover(15_000_000_000)).toBe('HK$150億')
  expect(formatTurnover(56_000)).toBe('HK$6萬')
  expect(formatTurnover(3_987_306_350_000)).toBe('HK$3.99萬億')
})

import type { Quote } from '../hk-stocks/hkStocks'
import { BLUE_CHIPS, SECTORS, type BlueChip, type Sector } from './blueChips'

export const INDICES = [
  { code: 'HSI', name: '恒生指數' },
  { code: 'HSCEI', name: '國企指數' },
  { code: 'HSTECH', name: '恒生科技指數' },
  { code: 'HSCCI', name: '紅籌指數' },
] as const

export const MARKET_CODES = [...INDICES.map((index) => index.code), ...BLUE_CHIPS.map((chip) => chip.code)]

export interface StockMove extends BlueChip {
  quote: Quote
  changePercent: number
  turnover: number
}

export interface SectorMove {
  sector: Sector
  /** Turnover-weighted average change, in percent. */
  changePercent: number
  turnover: number
  stocks: StockMove[]
}

export interface MarketSnapshot {
  stocks: StockMove[]
  breadth: { up: number; down: number; flat: number }
  sectors: SectorMove[]
  gainers: StockMove[]
  losers: StockMove[]
  mostActive: StockMove[]
  turnover: number
}

function percentOf(quote: Quote): number {
  if (quote.changePercent !== null) return quote.changePercent
  return quote.previousClose ? ((quote.price - quote.previousClose) / quote.previousClose) * 100 : 0
}

export function buildSnapshot(quotes: Record<string, Quote>, topCount = 5): MarketSnapshot {
  const stocks: StockMove[] = BLUE_CHIPS.flatMap((chip) => {
    const quote = quotes[chip.code]
    if (!quote) return []
    return [{ ...chip, quote, changePercent: percentOf(quote), turnover: quote.turnover ?? 0 }]
  })

  const breadth = { up: 0, down: 0, flat: 0 }
  for (const stock of stocks) {
    if (stock.changePercent > 0) breadth.up += 1
    else if (stock.changePercent < 0) breadth.down += 1
    else breadth.flat += 1
  }

  const sectors: SectorMove[] = SECTORS.flatMap((sector) => {
    const members = stocks.filter((stock) => stock.sector === sector).sort((a, b) => b.turnover - a.turnover)
    if (members.length === 0) return []
    const turnover = members.reduce((sum, stock) => sum + stock.turnover, 0)
    const changePercent =
      turnover > 0
        ? members.reduce((sum, stock) => sum + stock.changePercent * stock.turnover, 0) / turnover
        : members.reduce((sum, stock) => sum + stock.changePercent, 0) / members.length
    return [{ sector, changePercent, turnover, stocks: members }]
  }).sort((a, b) => b.changePercent - a.changePercent)

  const byChange = [...stocks].sort((a, b) => b.changePercent - a.changePercent)
  return {
    stocks,
    breadth,
    sectors,
    gainers: byChange.filter((stock) => stock.changePercent > 0).slice(0, topCount),
    losers: byChange.reverse().filter((stock) => stock.changePercent < 0).slice(0, topCount),
    mostActive: [...stocks].sort((a, b) => b.turnover - a.turnover).slice(0, topCount),
    turnover: stocks.reduce((sum, stock) => sum + stock.turnover, 0),
  }
}

/** Where the price sits in the day's range, 0 (low) to 1 (high); null without a range. */
export function rangePosition(value: number, low: number | null | undefined, high: number | null | undefined): number | null {
  if (low == null || high == null || high <= low) return null
  return Math.min(1, Math.max(0, (value - low) / (high - low)))
}

/** Background for a heat-map tile: green up, red down (HK convention), stronger for bigger moves. */
export function heatColor(changePercent: number, maxStrength = 80): string {
  const strength = Math.round(Math.min(Math.abs(changePercent) / 3, 1) * (maxStrength - 10)) + 10
  if (changePercent === 0) return 'var(--color-surface)'
  const color = changePercent > 0 ? 'var(--color-success)' : 'var(--color-error)'
  return `color-mix(in srgb, ${color} ${strength}%, var(--color-surface))`
}

export function formatTurnover(value: number): string {
  if (value >= 1e12) return `HK$${(value / 1e12).toFixed(2)}萬億`
  if (value >= 1e8) return `HK$${(value / 1e8).toFixed(value >= 1e10 ? 0 : 1)}億`
  if (value >= 1e4) return `HK$${(value / 1e4).toFixed(0)}萬`
  return `HK$${value.toFixed(0)}`
}

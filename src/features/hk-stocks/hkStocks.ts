import type { AssetPosition } from '../assets/assetsClient'

export const HSI_CODE = 'HSI'
export const HK_STOCK_CLASS = '港股'

export interface Quote {
  price: number
  previousClose: number
  change: number
  changePercent: number | null
  time: string | null
}

export type QuotesResult = { ok: true; quotes: Record<string, Quote> } | { ok: false; error: string }

export interface HoldingRow {
  name: string
  code: string
  quantity: number | null
  quote: Quote | null
  valueHkd: number
  dayGainHkd: number | null
}

export interface HoldingsSummary {
  rows: HoldingRow[]
  totalHkd: number
  dayGainHkd: number
  dayGainPercent: number | null
  /** True when every holding had a live quote, so today's gain covers the whole total. */
  complete: boolean
}

const QUOTES_ERROR = '暫時無法取得即時報價，請稍後再試。'

/** "0001.HK", "1", "00001" → "00001"; anything that isn't an HK stock number → null. */
export function normalizeHkCode(symbol: string | null): string | null {
  const digits = (symbol ?? '').trim().toUpperCase().replace(/\.HK$/, '')
  if (!/^\d{1,5}$/.test(digits)) return null
  return digits.padStart(5, '0')
}

export function hkStockPositions(positions: AssetPosition[]): AssetPosition[] {
  return positions.filter((position) => position.asset_class === HK_STOCK_CLASS)
}

export async function fetchHkQuotes(codes: string[], fetchFn: typeof fetch = fetch): Promise<QuotesResult> {
  try {
    const response = await fetchFn(`/api/hk-quotes?codes=${codes.map(encodeURIComponent).join(',')}`, {
      cache: 'no-store',
    })
    if (!response.ok) return { ok: false, error: QUOTES_ERROR }
    const body = (await response.json()) as { quotes?: Record<string, Quote> }
    return { ok: true, quotes: body.quotes ?? {} }
  } catch {
    return { ok: false, error: QUOTES_ERROR }
  }
}

// HKD per unit of the stock's trading currency, inferred from the stored position (1 for HKD counters).
function hkdRate(position: AssetPosition): number {
  if (!position.currency_code || position.currency_code === 'HKD') return 1
  const { quantity, current_price: price, market_value_hkd: value } = position
  if (quantity && price && value) return value / (quantity * price)
  return 1
}

export function summarizeHoldings(positions: AssetPosition[], quotes: Record<string, Quote>): HoldingsSummary {
  const positionRows = hkStockPositions(positions).map((position): HoldingRow => {
    const code = normalizeHkCode(position.symbol)
    const quote = code ? (quotes[code] ?? null) : null
    const name = position.name ?? position.symbol ?? '—'
    if (quote && position.quantity !== null) {
      const rate = hkdRate(position)
      return {
        name,
        code: code!,
        quantity: position.quantity,
        quote,
        valueHkd: position.quantity * quote.price * rate,
        dayGainHkd: position.quantity * (quote.price - quote.previousClose) * rate,
      }
    }
    return {
      name,
      code: code ?? position.symbol ?? '—',
      quantity: position.quantity,
      quote: null,
      valueHkd: position.market_value_hkd ?? 0,
      dayGainHkd: null,
    }
  })

  const rows = groupBySecurity(positionRows)
  rows.sort((a, b) => b.valueHkd - a.valueHkd)
  const totalHkd = rows.reduce((sum, row) => sum + row.valueHkd, 0)
  const dayGainHkd = rows.reduce((sum, row) => sum + (row.dayGainHkd ?? 0), 0)
  const previousTotal = totalHkd - dayGainHkd
  return {
    rows,
    totalHkd,
    dayGainHkd,
    dayGainPercent: previousTotal > 0 ? (dayGainHkd / previousTotal) * 100 : null,
    complete: positionRows.every((row) => row.dayGainHkd !== null),
  }
}

// The same stock held in several accounts becomes one row with combined quantity, value and gain.
function groupBySecurity(rows: HoldingRow[]): HoldingRow[] {
  const groups = new Map<string, HoldingRow>()
  for (const row of rows) {
    const existing = groups.get(row.code)
    if (!existing) {
      groups.set(row.code, { ...row })
      continue
    }
    existing.quantity = existing.quantity !== null && row.quantity !== null ? existing.quantity + row.quantity : null
    existing.quote ??= row.quote
    existing.valueHkd += row.valueHkd
    existing.dayGainHkd =
      existing.dayGainHkd === null && row.dayGainHkd === null
        ? null
        : (existing.dayGainHkd ?? 0) + (row.dayGainHkd ?? 0)
  }
  return [...groups.values()]
}

export function changeDirection(value: number | null): 'up' | 'down' | 'flat' {
  if (value === null || value === 0) return 'flat'
  return value > 0 ? 'up' : 'down'
}

export function formatSigned(value: number, fractionDigits = 2): string {
  const formatted = new Intl.NumberFormat('zh-HK', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Math.abs(value))
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatted}`
}

export function formatSignedHkd(value: number): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${new Intl.NumberFormat('zh-HK', {
    style: 'currency',
    currency: 'HKD',
    maximumFractionDigits: 0,
  }).format(Math.abs(value))}`
}

export function formatPercent(value: number | null): string {
  return value === null ? '' : `${formatSigned(value)}%`
}

export function formatIndex(value: number): string {
  return new Intl.NumberFormat('zh-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

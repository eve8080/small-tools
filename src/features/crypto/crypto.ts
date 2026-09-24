import type { AssetPosition } from '../assets/assetsClient'

export const CRYPTO_CLASSES = ['加密貨幣', 'crypto']

const MARKET_ERROR = '暫時無法取得加密貨幣市場數據，請稍後再試。'

export interface CoinMarket {
  id: string
  symbol: string
  name: string
  image: string | null
  rank: number | null
  priceHkd: number
  change24hHkd: number | null
  change24hPercent: number | null
  marketCapHkd: number | null
}

export interface GlobalMarket {
  marketCapHkd: number | null
  marketCapChange24hPercent: number | null
  btcDominance: number | null
}

export interface CryptoMarketData {
  top: CoinMarket[]
  held: Record<string, CoinMarket>
  global: GlobalMarket | null
}

export type CryptoMarketResult = { ok: true; data: CryptoMarketData } | { ok: false; error: string }

export interface CryptoHoldingRow {
  symbol: string
  name: string
  quantity: number | null
  coin: CoinMarket | null
  valueHkd: number
  change24hHkd: number | null
}

export interface CryptoHoldingsSummary {
  rows: CryptoHoldingRow[]
  totalHkd: number
  change24hHkd: number
  change24hPercent: number | null
  complete: boolean
}

/** "BTC", " eth ", "BTC-USD" → "btc", "eth", "btc". */
export function normalizeCryptoSymbol(symbol: string | null): string | null {
  const cleaned = (symbol ?? '').trim().toLowerCase().replace(/[-/](usd|usdt|hkd)$/, '')
  return /^[a-z0-9]{1,15}$/.test(cleaned) ? cleaned : null
}

export function cryptoPositions(positions: AssetPosition[]): AssetPosition[] {
  return positions.filter((position) => CRYPTO_CLASSES.includes(position.asset_class ?? ''))
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function parseCoin(raw: Record<string, unknown>): CoinMarket | null {
  const price = toNumber(raw.current_price)
  if (price === null || typeof raw.symbol !== 'string') return null
  return {
    id: String(raw.id),
    symbol: raw.symbol.toLowerCase(),
    name: String(raw.name ?? raw.symbol),
    image: typeof raw.image === 'string' ? raw.image : null,
    rank: toNumber(raw.market_cap_rank),
    priceHkd: price,
    change24hHkd: toNumber(raw.price_change_24h),
    change24hPercent: toNumber(raw.price_change_percentage_24h),
    marketCapHkd: toNumber(raw.market_cap),
  }
}

export async function fetchCryptoMarket(
  heldSymbols: string[],
  fetchFn: typeof fetch = fetch,
): Promise<CryptoMarketResult> {
  try {
    const response = await fetchFn(`/api/crypto?symbols=${heldSymbols.map(encodeURIComponent).join(',')}`, {
      cache: 'no-store',
    })
    if (!response.ok) return { ok: false, error: MARKET_ERROR }
    const body = (await response.json()) as {
      top?: Record<string, unknown>[]
      held?: Record<string, unknown>[]
      global?: Record<string, unknown> | null
    }

    const top = (body.top ?? []).map(parseCoin).filter((coin) => coin !== null)
    const held: Record<string, CoinMarket> = {}
    for (const coin of (body.held ?? []).map(parseCoin)) {
      // With include_tokens=top CoinGecko returns the largest coin per symbol; keep the first match.
      if (coin && !held[coin.symbol]) held[coin.symbol] = coin
    }

    const data = body.global
    const global: GlobalMarket | null = data
      ? {
          marketCapHkd: toNumber((data.total_market_cap as Record<string, unknown> | undefined)?.hkd),
          marketCapChange24hPercent: toNumber(data.market_cap_change_percentage_24h_usd),
          btcDominance: toNumber((data.market_cap_percentage as Record<string, unknown> | undefined)?.btc),
        }
      : null

    return { ok: true, data: { top, held, global } }
  } catch {
    return { ok: false, error: MARKET_ERROR }
  }
}

export function summarizeCryptoHoldings(
  positions: AssetPosition[],
  held: Record<string, CoinMarket>,
): CryptoHoldingsSummary {
  const groups = new Map<string, CryptoHoldingRow>()
  let complete = true

  for (const position of cryptoPositions(positions)) {
    const symbol = normalizeCryptoSymbol(position.symbol)
    const coin = symbol ? (held[symbol] ?? null) : null
    const live = coin !== null && position.quantity !== null
    if (!live) complete = false

    const valueHkd = live ? position.quantity! * coin.priceHkd : (position.market_value_hkd ?? 0)
    const change24hHkd = live && coin.change24hHkd !== null ? position.quantity! * coin.change24hHkd : null
    const key = symbol ?? position.name ?? position.symbol ?? '—'

    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, {
        symbol: (symbol ?? position.symbol ?? '—').toUpperCase(),
        name: coin?.name ?? position.name ?? position.symbol ?? '—',
        quantity: position.quantity,
        coin,
        valueHkd,
        change24hHkd,
      })
      continue
    }
    existing.quantity =
      existing.quantity !== null && position.quantity !== null ? existing.quantity + position.quantity : null
    existing.valueHkd += valueHkd
    existing.change24hHkd =
      existing.change24hHkd === null && change24hHkd === null
        ? null
        : (existing.change24hHkd ?? 0) + (change24hHkd ?? 0)
  }

  const rows = [...groups.values()].sort((a, b) => b.valueHkd - a.valueHkd)
  const totalHkd = rows.reduce((sum, row) => sum + row.valueHkd, 0)
  const change24hHkd = rows.reduce((sum, row) => sum + (row.change24hHkd ?? 0), 0)
  const previousTotal = totalHkd - change24hHkd
  return {
    rows,
    totalHkd,
    change24hHkd,
    change24hPercent: previousTotal > 0 ? (change24hHkd / previousTotal) * 100 : null,
    complete,
  }
}

export function formatCompactHkd(value: number): string {
  return new Intl.NumberFormat('zh-HK', {
    style: 'currency',
    currency: 'HKD',
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatCoinPrice(value: number): string {
  return new Intl.NumberFormat('zh-HK', {
    style: 'currency',
    currency: 'HKD',
    maximumFractionDigits: value >= 100 ? 0 : value >= 1 ? 2 : 6,
  }).format(value)
}

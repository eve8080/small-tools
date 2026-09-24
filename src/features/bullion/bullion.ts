import type { AssetPosition } from '../assets/assetsClient'

export const BULLION_CLASS = '貴金屬'
export const METAL_CODES = ['XAU', 'XAG', 'XPT', 'XPD'] as const
export type MetalCode = (typeof METAL_CODES)[number]

export const METAL_NAMES: Record<MetalCode, string> = {
  XAU: '黃金',
  XAG: '白銀',
  XPT: '鉑金',
  XPD: '鈀金',
}

const GRAMS_PER_TROY_OUNCE = 31.1034768
/** Hong Kong tael (両) = 37.429 g. */
export const TROY_OUNCES_PER_TAEL = 37.429 / GRAMS_PER_TROY_OUNCE

export interface MetalQuote {
  priceUsd: number
  previousCloseUsd: number
  changePercent: number | null
  time: string | null
}

export interface MetalsData {
  metals: Partial<Record<MetalCode, MetalQuote>>
  usdHkd: number
}

export type MetalsResult = { ok: true; data: MetalsData } | { ok: false; error: string }

export interface BullionRow {
  metal: MetalCode | null
  name: string
  quantityLabel: string
  quote: MetalQuote | null
  valueHkd: number
  dayGainHkd: number | null
}

export interface BullionSummary {
  rows: BullionRow[]
  totalHkd: number
  dayGainHkd: number
  dayGainPercent: number | null
  complete: boolean
}

const METALS_ERROR = '暫時無法取得貴金屬報價，請稍後再試。'

// Order matters: 鉑金, 鈀金 and 白金 (platinum) all contain 金, so they're checked before gold.
const METAL_PATTERNS: [MetalCode, RegExp][] = [
  ['XPD', /xpd|palladium|鈀|钯/i],
  ['XPT', /xpt|platinum|鉑|铂|白金/i],
  ['XAG', /xag|silver|銀|银/i],
  ['XAU', /xau|gold|金/i],
]

/** Which metal a position holds, from its symbol or name (e.g. "恒生金粒" → gold). */
export function detectMetal(position: AssetPosition): MetalCode | null {
  const text = `${position.symbol ?? ''} ${position.name ?? ''}`
  for (const [code, pattern] of METAL_PATTERNS) {
    if (pattern.test(text)) return code
  }
  return null
}

const UNIT_TO_OUNCES: [RegExp, number, string][] = [
  [/^(oz|ozt|troy ?oz|troy ?ounces?|ounces?|盎司|安士)$/i, 1, '盎司'],
  [/^(taels?|両|兩|两)$/i, TROY_OUNCES_PER_TAEL, '両'],
  [/^(g|grams?|gm|克)$/i, 1 / GRAMS_PER_TROY_OUNCE, '克'],
  [/^(kg|kilograms?|公斤)$/i, 1000 / GRAMS_PER_TROY_OUNCE, '公斤'],
]

function unitInfo(unit: string | null | undefined): { ounces: number; label: string } | null {
  const cleaned = (unit ?? '').trim()
  for (const [pattern, ounces, label] of UNIT_TO_OUNCES) {
    if (pattern.test(cleaned)) return { ounces, label }
  }
  return null
}

export function bullionPositions(positions: AssetPosition[]): AssetPosition[] {
  return positions.filter((position) => position.asset_class === BULLION_CLASS)
}

export async function fetchMetals(fetchFn: typeof fetch = fetch): Promise<MetalsResult> {
  try {
    const response = await fetchFn('/api/metals', { cache: 'no-store' })
    if (!response.ok) return { ok: false, error: METALS_ERROR }
    const body = (await response.json()) as Partial<MetalsData> | null
    if (!body?.metals || typeof body.usdHkd !== 'number') return { ok: false, error: METALS_ERROR }
    return { ok: true, data: { metals: body.metals, usdHkd: body.usdHkd } }
  } catch {
    return { ok: false, error: METALS_ERROR }
  }
}

const quantityFormat = new Intl.NumberFormat('zh-HK', { maximumFractionDigits: 4 })

interface Group {
  metal: MetalCode | null
  name: string
  units: Set<string>
  quantity: number
  ounces: number
  quantityKnown: boolean
  quote: MetalQuote | null
  valueHkd: number
  dayGainHkd: number | null
}

export function summarizeBullion(positions: AssetPosition[], data: MetalsData | null): BullionSummary {
  const groups = new Map<string, Group>()
  let complete = true

  for (const position of bullionPositions(positions)) {
    const metal = detectMetal(position)
    const unit = unitInfo(position.quantity_unit)
    const quote = metal && data ? (data.metals[metal] ?? null) : null
    const live = quote !== null && unit !== null && position.quantity !== null && data !== null
    if (!live) complete = false

    const ounces = unit && position.quantity !== null ? position.quantity * unit.ounces : 0
    const valueHkd = live ? ounces * quote.priceUsd * data.usdHkd : (position.market_value_hkd ?? 0)
    const dayGainHkd = live ? ounces * (quote.priceUsd - quote.previousCloseUsd) * data.usdHkd : null

    const key = metal ?? position.name ?? position.symbol ?? '—'
    let group = groups.get(key)
    if (!group) {
      group = {
        metal,
        name: metal ? METAL_NAMES[metal] : (position.name ?? position.symbol ?? '—'),
        units: new Set(),
        quantity: 0,
        ounces: 0,
        quantityKnown: true,
        quote,
        valueHkd: 0,
        dayGainHkd: null,
      }
      groups.set(key, group)
    }
    if (unit && position.quantity !== null) {
      group.units.add(unit.label)
      group.quantity += position.quantity
      group.ounces += ounces
    } else {
      group.quantityKnown = false
    }
    group.valueHkd += valueHkd
    if (dayGainHkd !== null) group.dayGainHkd = (group.dayGainHkd ?? 0) + dayGainHkd
  }

  const rows = [...groups.values()]
    .map((group): BullionRow => {
      let quantityLabel = '—'
      if (group.quantityKnown && group.units.size === 1) {
        quantityLabel = `${quantityFormat.format(group.quantity)} ${[...group.units][0]}`
      } else if (group.quantityKnown && group.units.size > 1) {
        quantityLabel = `${quantityFormat.format(group.ounces)} 盎司`
      }
      return {
        metal: group.metal,
        name: group.name,
        quantityLabel,
        quote: group.quote,
        valueHkd: group.valueHkd,
        dayGainHkd: group.dayGainHkd,
      }
    })
    .sort((a, b) => b.valueHkd - a.valueHkd)

  const totalHkd = rows.reduce((sum, row) => sum + row.valueHkd, 0)
  const dayGainHkd = rows.reduce((sum, row) => sum + (row.dayGainHkd ?? 0), 0)
  const previousTotal = totalHkd - dayGainHkd
  return {
    rows,
    totalHkd,
    dayGainHkd,
    dayGainPercent: previousTotal > 0 ? (dayGainHkd / previousTotal) * 100 : null,
    complete,
  }
}

export function hkdPerTael(quote: MetalQuote, usdHkd: number): number {
  return quote.priceUsd * TROY_OUNCES_PER_TAEL * usdHkd
}

export function formatUsd(value: number): string {
  return `US$${new Intl.NumberFormat('zh-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`
}

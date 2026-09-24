export interface AssetPosition {
  name: string | null
  symbol: string | null
  asset_class: string | null
  account: string | null
  quantity: number | null
  quantity_unit?: string | null
  current_price: number | null
  currency_code: string | null
  market_value_hkd: number | null
  price_date: string | null
  is_active?: boolean | null
}

export type AssetsResult =
  | { ok: true; positions: AssetPosition[] }
  | { ok: false; error: string; unauthorized?: boolean }

const POSITIONS_ENDPOINT = '/api/asset_positions?select=*&order=market_value_hkd.desc'
const PASSWORD_STORAGE_KEY = 'small-tools:assets-password'
const NETWORK_ERROR = '無法取得資產資料，請檢查網絡連線後再試一次。'
const UNAUTHORIZED_ERROR = '密碼不正確，請重新輸入。'
const SERVER_ERROR = '伺服器暫時無法提供資產資料，請稍後再試。'

export function loadStoredPassword(): string {
  try {
    return localStorage.getItem(PASSWORD_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function storePassword(password: string): void {
  try {
    localStorage.setItem(PASSWORD_STORAGE_KEY, password)
  } catch {
    // Storage unavailable (private mode etc.): the password just won't be remembered.
  }
}

export function clearStoredPassword(): void {
  try {
    localStorage.removeItem(PASSWORD_STORAGE_KEY)
  } catch {
    // Nothing to clear.
  }
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export async function fetchAssetPositions(
  password: string,
  fetchFn: typeof fetch = fetch,
): Promise<AssetsResult> {
  try {
    const response = await fetchFn(POSITIONS_ENDPOINT, {
      headers: { Authorization: `Bearer ${password}` },
      cache: 'no-store',
    })

    if (response.status === 401) {
      return { ok: false, error: UNAUTHORIZED_ERROR, unauthorized: true }
    }
    if (!response.ok) {
      return { ok: false, error: SERVER_ERROR }
    }

    const rows = (await response.json()) as Record<string, unknown>[]
    const positions = rows
      .filter((row) => row.is_active !== false)
      .map((row) => ({
        ...(row as unknown as AssetPosition),
        quantity: toNumber(row.quantity),
        current_price: toNumber(row.current_price),
        market_value_hkd: toNumber(row.market_value_hkd),
      }))

    return { ok: true, positions }
  } catch {
    return { ok: false, error: NETWORK_ERROR }
  }
}

export function totalValueHkd(positions: AssetPosition[]): number {
  return positions.reduce((sum, position) => sum + (position.market_value_hkd ?? 0), 0)
}

export function latestPriceDate(positions: AssetPosition[]): string {
  return positions.reduce((latest, position) => {
    const date = position.price_date ?? ''
    return date > latest ? date : latest
  }, '')
}

export function formatHkd(value: number): string {
  return new Intl.NumberFormat('zh-HK', {
    style: 'currency',
    currency: 'HKD',
    maximumFractionDigits: 0,
  }).format(value)
}

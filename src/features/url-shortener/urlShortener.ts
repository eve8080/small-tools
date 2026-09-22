export function isValidHttpUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return false
  }

  return url.protocol === 'http:' || url.protocol === 'https:'
}

export type ShortenResult = { ok: true; shortUrl: string } | { ok: false; error: string }

const IS_GD_ENDPOINT = 'https://is.gd/create.php?format=json&url='
const GENERIC_ERROR = '無法連接伺服器,請檢查網絡連線後再試一次。'
const UNKNOWN_ERROR = '縮短網址失敗,請稍後再試。'

export async function shortenUrl(
  longUrl: string,
  fetchFn: typeof fetch = fetch,
): Promise<ShortenResult> {
  try {
    const response = await fetchFn(IS_GD_ENDPOINT + encodeURIComponent(longUrl))
    const data = (await response.json()) as { shorturl?: string; errormessage?: string }

    if (typeof data.shorturl === 'string') {
      return { ok: true, shortUrl: data.shorturl }
    }

    return { ok: false, error: data.errormessage ?? UNKNOWN_ERROR }
  } catch {
    return { ok: false, error: GENERIC_ERROR }
  }
}

// Cloudflare Worker: serves the SPA from static assets and exposes a read-only,
// password-protected proxy to Supabase at /api/<table>.
//
// Required secrets (set with `wrangler secret put <NAME>`; never commit them):
//   SUPABASE_URL               e.g. https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  server-side only; bypasses row-level security
//   ASSETS_PASSWORD            clients must send `Authorization: Bearer <password>`
//
// It also exposes /api/hk-quotes?codes=HSI,00001,... — public Hong Kong market quotes
// (Hang Seng family indices and HK stocks) from Tencent's quote feed, which browsers can't call directly.
//
// /api/metals — spot gold, silver, platinum and palladium plus USD/HKD, from the same feed.
//
// And /api/crypto?symbols=btc,eth — crypto market data (top 10 coins, the held coins, global
// totals) in HKD, cached at the edge for a minute. It comes from CoinPaprika's free API, which
// needs no key; CoinGecko's keyless API rate-limits Cloudflare's shared IPs (HTTP 429).
// Optional secret: COINGECKO_API_KEY — with a free CoinGecko "demo" key, CoinGecko is used instead.

const ALLOWED_TABLES = new Set(['asset_positions', 'asset_categories', 'dashboard_positions'])
const ALLOWED_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'is_active'])

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

// Constant-time comparison so response timing doesn't reveal how much of the password matched.
function passwordMatches(provided, expected) {
  const encoder = new TextEncoder()
  const a = encoder.encode(provided)
  const b = encoder.encode(expected)
  let diff = a.length ^ b.length
  for (let i = 0; i < b.length; i++) {
    diff |= (a[i] ?? 0) ^ b[i]
  }
  return diff === 0
}

export async function handleApi(request, env, fetchFn = fetch) {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.ASSETS_PASSWORD) {
    return json({ error: 'Server is not configured' }, 500)
  }

  const auth = request.headers.get('Authorization') ?? ''
  const provided = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : ''
  if (!provided || !passwordMatches(provided, env.ASSETS_PASSWORD)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const url = new URL(request.url)
  const table = url.pathname.slice('/api/'.length)
  if (!ALLOWED_TABLES.has(table)) {
    return json({ error: 'Not found' }, 404)
  }

  const upstreamParams = new URLSearchParams()
  for (const [key, value] of url.searchParams) {
    if (ALLOWED_PARAMS.has(key)) upstreamParams.append(key, value)
  }

  const upstreamUrl = `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${table}?${upstreamParams}`
  let upstream
  try {
    upstream = await fetchFn(upstreamUrl, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: 'application/json',
      },
    })
  } catch {
    return json({ error: 'Upstream unavailable' }, 502)
  }

  if (!upstream.ok) {
    return json({ error: 'Upstream error' }, 502)
  }

  return json(await upstream.json())
}

const QUOTE_CODE = /^(HSI|HSCEI|HSTECH|HSCCI|\d{5})$/
const MAX_QUOTE_CODES = 100
const QUOTE_UPSTREAM = 'https://qt.gtimg.cn/q='

function toNumber(value) {
  if (value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

// Tencent returns lines like: v_r_hk00001="100~name~00001~price~prevClose~...~time~change~change%~...";
export function parseTencentQuotes(text) {
  const quotes = {}
  for (const match of text.matchAll(/v_r_hk(\w+)="([^"]*)"/g)) {
    const fields = match[2].split('~')
    const price = toNumber(fields[3])
    const previousClose = toNumber(fields[4])
    if (price === null || previousClose === null) continue
    quotes[match[1]] = {
      price,
      previousClose,
      change: toNumber(fields[31]) ?? price - previousClose,
      changePercent: toNumber(fields[32]),
      high: toNumber(fields[33]),
      low: toNumber(fields[34]),
      turnover: toNumber(fields[37]),
      // Field 44 is the HK-listed market value in units of HK$100 million (億).
      marketCap: toNumber(fields[44]) === null ? null : toNumber(fields[44]) * 1e8,
      time: fields[30] || null,
    }
  }
  return quotes
}

export async function handleQuotes(request, fetchFn = fetch) {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const codes = [
    ...new Set(
      (new URL(request.url).searchParams.get('codes') ?? '')
        .split(',')
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean),
    ),
  ]
  if (codes.length === 0 || codes.length > MAX_QUOTE_CODES || !codes.every((code) => QUOTE_CODE.test(code))) {
    return json({ error: 'Invalid codes' }, 400)
  }

  let upstream
  try {
    upstream = await fetchFn(QUOTE_UPSTREAM + codes.map((code) => `r_hk${code}`).join(','))
  } catch {
    return json({ error: 'Upstream unavailable' }, 502)
  }
  if (!upstream.ok) {
    return json({ error: 'Upstream error' }, 502)
  }

  return json({ quotes: parseTencentQuotes(await upstream.text()) })
}

const CRYPTO_SYMBOL = /^[a-z0-9]{1,15}$/
const MAX_CRYPTO_SYMBOLS = 50
const COINGECKO_API = 'https://api.coingecko.com/api/v3'
const CRYPTO_FRESH_MS = 60 * 1000
// Keep a stale copy for a while so a CoinGecko rate limit or outage still shows recent data.
const CRYPTO_STALE_SECONDS = 60 * 60

async function coingecko(path, env, fetchFn) {
  // CoinGecko rejects requests without a User-Agent (403), and Workers don't send one by default.
  const headers = { Accept: 'application/json', 'User-Agent': 'small-tools/1.0' }
  if (env.COINGECKO_API_KEY) headers['x-cg-demo-api-key'] = env.COINGECKO_API_KEY
  const response = await fetchFn(`${COINGECKO_API}${path}`, { headers })
  if (!response.ok) throw new Error(`CoinGecko ${response.status}`)
  return response.json()
}

const COINPAPRIKA_API = 'https://api.coinpaprika.com/v1'

async function coinpaprika(path, fetchFn) {
  const response = await fetchFn(`${COINPAPRIKA_API}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'small-tools/1.0' },
  })
  if (!response.ok) throw new Error(`CoinPaprika ${response.status}`)
  return response.json()
}

// Reshape a CoinPaprika ticker into the CoinGecko /coins/markets fields the app reads.
function paprikaToMarket(ticker) {
  const hkd = ticker.quotes?.HKD ?? {}
  const percent = typeof hkd.percent_change_24h === 'number' ? hkd.percent_change_24h : null
  const price = hkd.price
  return {
    id: ticker.id,
    symbol: String(ticker.symbol).toLowerCase(),
    name: ticker.name,
    image: `https://static.coinpaprika.com/coin/${ticker.id}/logo.png`,
    market_cap_rank: ticker.rank,
    current_price: price,
    price_change_24h: percent === null || typeof price !== 'number' ? null : price - price / (1 + percent / 100),
    price_change_percentage_24h: percent,
    market_cap: hkd.market_cap,
  }
}

async function loadFromCoinPaprika(symbols, fetchFn) {
  const [tickers, global] = await Promise.all([
    // Ranked by market cap; the top 500 covers the held coins without a lookup per symbol.
    coinpaprika('/tickers?quotes=USD,HKD&limit=500', fetchFn),
    coinpaprika('/global', fetchFn).catch(() => null),
  ])

  const ranked = tickers
    .filter((ticker) => ticker.rank > 0 && typeof ticker.quotes?.HKD?.price === 'number')
    .sort((a, b) => a.rank - b.rank)
  const wanted = new Set(symbols)
  const held = ranked.filter((ticker) => wanted.has(String(ticker.symbol).toLowerCase())).map(paprikaToMarket)

  const btc = ranked.find((ticker) => ticker.id === 'btc-bitcoin')
  const usdToHkd = btc ? btc.quotes.HKD.price / btc.quotes.USD.price : null
  return {
    top: ranked.slice(0, 10).map(paprikaToMarket),
    held,
    global: global
      ? {
          total_market_cap: { hkd: usdToHkd ? global.market_cap_usd * usdToHkd : null },
          market_cap_change_percentage_24h_usd: global.market_cap_change_24h,
          market_cap_percentage: { btc: global.bitcoin_dominance_percentage },
        }
      : null,
  }
}

async function loadCryptoMarket(symbols, env, fetchFn) {
  if (!env.COINGECKO_API_KEY) return loadFromCoinPaprika(symbols, fetchFn)

  const [top, held, global] = await Promise.all([
    coingecko('/coins/markets?vs_currency=hkd&order=market_cap_desc&per_page=10&page=1', env, fetchFn),
    symbols.length > 0
      ? coingecko(`/coins/markets?vs_currency=hkd&symbols=${symbols.join(',')}&include_tokens=top`, env, fetchFn)
      : [],
    coingecko('/global', env, fetchFn).then(
      (body) => body.data ?? null,
      () => null,
    ),
  ])
  return { top, held, global }
}

export async function handleCrypto(request, env, fetchFn = fetch, cache = globalThis.caches?.default) {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const symbols = [
    ...new Set(
      (new URL(request.url).searchParams.get('symbols') ?? '')
        .split(',')
        .map((symbol) => symbol.trim().toLowerCase())
        .filter(Boolean),
    ),
  ].sort()
  if (symbols.length > MAX_CRYPTO_SYMBOLS || !symbols.every((symbol) => CRYPTO_SYMBOL.test(symbol))) {
    return json({ error: 'Invalid symbols' }, 400)
  }

  const cacheKey = new Request(`https://small-tools.cache/crypto?symbols=${symbols.join(',')}`)
  const cached = cache ? await cache.match(cacheKey) : undefined
  const cachedAt = Number(cached?.headers.get('X-Fetched-At') ?? 0)
  if (cached && Date.now() - cachedAt < CRYPTO_FRESH_MS) {
    return json(await cached.json())
  }

  let body
  try {
    body = await loadCryptoMarket(symbols, env, fetchFn)
  } catch (error) {
    if (cached) return json(await cached.json())
    return json({ error: 'Upstream unavailable', detail: String(error?.message ?? error) }, 502)
  }

  if (cache) {
    await cache.put(
      cacheKey,
      new Response(JSON.stringify(body), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `max-age=${CRYPTO_STALE_SECONDS}`,
          'X-Fetched-At': String(Date.now()),
        },
      }),
    )
  }
  return json(body)
}

// Spot precious metals (USD per troy ounce) and USD/HKD, from the same Tencent quote feed.
// Lines look like: v_hf_XAU="price,change%,bid,ask,high,low,time,previousClose,...,date,name";
const METAL_CODES = ['XAU', 'XAG', 'XPT', 'XPD']

export function parseTencentMetals(text) {
  const metals = {}
  for (const match of text.matchAll(/v_hf_(XAU|XAG|XPT|XPD)="([^"]*)"/g)) {
    const fields = match[2].split(',')
    const price = toNumber(fields[0])
    const previousClose = toNumber(fields[7])
    if (price === null || previousClose === null) continue
    metals[match[1]] = {
      priceUsd: price,
      previousCloseUsd: previousClose,
      changePercent: toNumber(fields[1]),
      time: fields[12] && fields[6] ? `${fields[12]} ${fields[6]}` : null,
    }
  }
  const fx = text.match(/v_whUSDHKD="([^"]*)"/)
  const usdHkd = fx ? toNumber(fx[1].split('~')[3]) : null
  return { metals, usdHkd }
}

export async function handleMetals(request, fetchFn = fetch) {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
  }
  let upstream
  try {
    upstream = await fetchFn(QUOTE_UPSTREAM + [...METAL_CODES.map((code) => `hf_${code}`), 'whUSDHKD'].join(','))
  } catch {
    return json({ error: 'Upstream unavailable' }, 502)
  }
  if (!upstream.ok) {
    return json({ error: 'Upstream error' }, 502)
  }
  const body = parseTencentMetals(await upstream.text())
  if (Object.keys(body.metals).length === 0 || body.usdHkd === null) {
    return json({ error: 'Upstream error' }, 502)
  }
  return json(body)
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/hk-quotes') {
      return handleQuotes(request)
    }
    if (pathname === '/api/metals') {
      return handleMetals(request)
    }
    if (pathname === '/api/crypto') {
      return handleCrypto(request, env)
    }
    if (pathname.startsWith('/api/')) {
      return handleApi(request, env)
    }
    return env.ASSETS.fetch(request)
  },
}

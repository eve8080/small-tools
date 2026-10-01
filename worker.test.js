// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import worker, { handleApi, handleCrypto, handleMetals, handleQuotes } from './worker.js'

const env = {
  SUPABASE_URL: 'https://example.supabase.co/',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  ASSETS_PASSWORD: 'correct horse',
}

function apiRequest(path, { method = 'GET', password = 'correct horse' } = {}) {
  const headers = password ? { Authorization: `Bearer ${password}` } : {}
  return new Request(`https://small-tools.test${path}`, { method, headers })
}

function okFetch(body = [{ id: 1 }]) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
}

describe('handleApi', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('rejects %s with 405', async (method) => {
    const response = await handleApi(apiRequest('/api/asset_positions', { method }), env, okFetch())
    expect(response.status).toBe(405)
  })

  it('returns 500 when secrets are missing', async () => {
    const response = await handleApi(apiRequest('/api/asset_positions'), {}, okFetch())
    expect(response.status).toBe(500)
  })

  it('returns 401 without a password or with a wrong one', async () => {
    const fetchMock = okFetch()
    expect((await handleApi(apiRequest('/api/asset_positions', { password: '' }), env, fetchMock)).status).toBe(401)
    expect((await handleApi(apiRequest('/api/asset_positions', { password: 'correct hors' }), env, fetchMock)).status).toBe(401)
    expect((await handleApi(apiRequest('/api/asset_positions', { password: 'correct horse!' }), env, fetchMock)).status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 404 for tables outside the allow-list', async () => {
    const fetchMock = okFetch()
    const response = await handleApi(apiRequest('/api/users'), env, fetchMock)
    expect(response.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('proxies allowed params to Supabase with the service key and drops the rest', async () => {
    const fetchMock = okFetch([{ id: 1 }])
    const response = await handleApi(
      apiRequest('/api/asset_positions?select=*&order=name.asc&apikey=evil&id=eq.1'),
      env,
      fetchMock,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual([{ id: 1 }])

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.supabase.co/rest/v1/asset_positions?select=*&order=name.asc')
    expect(init.headers.apikey).toBe('service-key')
    expect(init.headers.Authorization).toBe('Bearer service-key')
  })

  it('hides upstream error details behind a 502', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"message":"secret detail"}', { status: 400 }))
    const response = await handleApi(apiRequest('/api/asset_positions'), env, fetchMock)
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain('secret detail')
  })
})

const TENCENT_BODY = [
  'v_r_hkHSI="100~name~HSI~24761.130~24834.120~24649.450~1~0~0~24761.130~0~0~0~0~0~0~0~0~0~24761.130~0~0~0~0~0~0~0~0~0~0.0~2026/09/24 16:08:39~-72.990~-0.29~24791.200~24648.290~24761.130~1~15955182.001";',
  'v_r_hk00001="100~name~00001~68.100~67.600~67.750~1~0~0~68.100~0~0~0~0~0~0~0~0~0~68.100~0~0~0~0~0~0~0~0~0~1.0~2026/09/24 16:08:39~0.500~0.74~68.200~67.250~68.100~1~261796070.950~0~22.03~~0~0~1.41~2608.2603";',
  'v_pv_none_match="1";',
].join('\n')

function quoteRequest(query, method = 'GET') {
  return new Request(`https://small-tools.test/api/hk-quotes${query}`, { method })
}

describe('handleQuotes', () => {
  it('parses index and stock quotes from the upstream feed', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(TENCENT_BODY, { status: 200 }))
    const response = await handleQuotes(quoteRequest('?codes=HSI,00001'), fetchMock)
    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith('https://qt.gtimg.cn/q=r_hkHSI,r_hk00001')
    expect(await response.json()).toEqual({
      quotes: {
        HSI: { price: 24761.13, previousClose: 24834.12, change: -72.99, changePercent: -0.29, high: 24791.2, low: 24648.29, turnover: 15955182.001, marketCap: null, time: '2026/09/24 16:08:39' },
        '00001': { price: 68.1, previousClose: 67.6, change: 0.5, changePercent: 0.74, high: 68.2, low: 67.25, turnover: 261796070.95, marketCap: 260826030000, time: '2026/09/24 16:08:39' },
      },
    })
  })

  it('accepts the other Hang Seng indices', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }))
    expect((await handleQuotes(quoteRequest('?codes=HSCEI,HSTECH,HSCCI'), fetchMock)).status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith('https://qt.gtimg.cn/q=r_hkHSCEI,r_hkHSTECH,r_hkHSCCI')
  })

  it.each(['', '?codes=', '?codes=HSI,1', '?codes=HSI,00001;x', '?codes=DJI', `?codes=${Array.from({ length: 101 }, (_, i) => String(i).padStart(5, '0')).join(',')}`])(
    'rejects invalid codes %s without calling upstream',
    async (query) => {
      const fetchMock = vi.fn()
      expect((await handleQuotes(quoteRequest(query), fetchMock)).status).toBe(400)
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it('rejects non-GET and reports upstream failures', async () => {
    expect((await handleQuotes(quoteRequest('?codes=HSI', 'POST'), vi.fn())).status).toBe(405)
    const failing = vi.fn().mockRejectedValue(new Error('down'))
    expect((await handleQuotes(quoteRequest('?codes=HSI'), failing)).status).toBe(502)
  })
})

function memoryCache() {
  const store = new Map()
  return {
    store,
    match: async (request) => store.get(request.url)?.clone(),
    put: async (request, response) => {
      store.set(request.url, response.clone())
    },
  }
}

const PAPRIKA_TICKERS = [
  { id: 'eth-ethereum', symbol: 'ETH', name: 'Ethereum', rank: 2, quotes: { USD: { price: 2600 }, HKD: { price: 20280, percent_change_24h: 4, market_cap: 2.4e12 } } },
  { id: 'btc-bitcoin', symbol: 'BTC', name: 'Bitcoin', rank: 1, quotes: { USD: { price: 84000 }, HKD: { price: 655200, percent_change_24h: -0.5, market_cap: 13e12 } } },
  { id: 'fake-btc', symbol: 'BTC', name: 'Fake', rank: 0, quotes: { USD: { price: 1 }, HKD: { price: 7.8 } } },
]

function paprikaFetch(tickers = PAPRIKA_TICKERS) {
  return vi.fn((url) =>
    Promise.resolve(
      new Response(
        JSON.stringify(
          url.endsWith('/global')
            ? { market_cap_usd: 3e12, market_cap_change_24h: -0.8, bitcoin_dominance_percentage: 56.3 }
            : tickers,
        ),
        { status: 200 },
      ),
    ),
  )
}

function coingeckoFetch(rates = { usd: { value: 84000 }, hkd: { value: 655200 } }) {
  return vi.fn((url) =>
    Promise.resolve(
      new Response(
        JSON.stringify(
          url.endsWith('/global')
            ? { data: { btc: 1 } }
            : url.endsWith('/exchange_rates')
              ? { rates }
              : [{ symbol: 'btc' }],
        ),
        { status: 200 },
      ),
    ),
  )
}

function cryptoRequest(query, method = 'GET') {
  return new Request(`https://small-tools.test/api/crypto${query}`, { method })
}

describe('handleCrypto', () => {
  it('uses CoinPaprika by default, reshaped to the CoinGecko fields, and caches it', async () => {
    const fetchMock = paprikaFetch()
    const cache = memoryCache()

    const body = await (await handleCrypto(cryptoRequest('?symbols=ETH,btc'), {}, fetchMock, cache)).json()
    expect(body.top.map((coin) => coin.symbol)).toEqual(['btc', 'eth'])
    expect(body.held.map((coin) => coin.id)).toEqual(['btc-bitcoin', 'eth-ethereum'])
    expect(body.held[1]).toMatchObject({
      name: 'Ethereum',
      market_cap_rank: 2,
      current_price: 20280,
      price_change_percentage_24h: 4,
      market_cap: 2.4e12,
      image: 'https://static.coinpaprika.com/coin/eth-ethereum/logo.png',
    })
    expect(body.held[1].price_change_24h).toBeCloseTo(780)
    expect(body.usd_hkd).toBeCloseTo(7.8)
    expect(body.global).toEqual({
      total_market_cap: { hkd: 3e12 * 7.8 },
      market_cap_change_percentage_24h_usd: -0.8,
      market_cap_percentage: { btc: 56.3 },
    })
    expect(fetchMock.mock.calls.map(([url]) => url)).toContain('https://api.coinpaprika.com/v1/tickers?quotes=USD,HKD&limit=500')

    await handleCrypto(cryptoRequest('?symbols=btc,eth'), {}, fetchMock, cache)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('uses CoinGecko when a demo API key is configured', async () => {
    const fetchMock = coingeckoFetch()
    const body = await (
      await handleCrypto(cryptoRequest('?symbols=btc'), { COINGECKO_API_KEY: 'demo' }, fetchMock, memoryCache())
    ).json()
    expect(body).toEqual({ top: [{ symbol: 'btc' }], held: [{ symbol: 'btc' }], global: { btc: 1 }, usd_hkd: 7.8 })
    expect(fetchMock.mock.calls.map(([url]) => url)).toContain(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=hkd&symbols=btc&include_tokens=top',
    )
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ 'x-cg-demo-api-key': 'demo', 'User-Agent': 'small-tools/1.0' })
  })

  it('still answers when CoinGecko exchange rates are unavailable', async () => {
    const base = coingeckoFetch()
    const fetchMock = vi.fn((url, init) =>
      url.endsWith('/exchange_rates') ? Promise.resolve(new Response('', { status: 500 })) : base(url, init),
    )
    const response = await handleCrypto(cryptoRequest('?symbols=btc'), { COINGECKO_API_KEY: 'demo' }, fetchMock, memoryCache())
    expect(response.status).toBe(200)
    expect((await response.json()).usd_hkd).toBeNull()
  })

  it.each([
    ['a missing USD quote', { HKD: { price: 655200, percent_change_24h: -0.5, market_cap: 13e12 } }],
    ['a zero USD price', { USD: { price: 0 }, HKD: { price: 655200, percent_change_24h: -0.5, market_cap: 13e12 } }],
    ['a zero HKD price', { USD: { price: 84000 }, HKD: { price: 0, percent_change_24h: -0.5, market_cap: 13e12 } }],
    ['a negative USD price', { USD: { price: -84000 }, HKD: { price: 655200, percent_change_24h: -0.5, market_cap: 13e12 } }],
    ['a non-numeric USD price', { USD: { price: '84000' }, HKD: { price: 655200, percent_change_24h: -0.5, market_cap: 13e12 } }],
  ])('keeps CoinPaprika market data with usd_hkd null for %s', async (_, btcQuotes) => {
    const tickers = PAPRIKA_TICKERS.map((ticker) => (ticker.id === 'btc-bitcoin' ? { ...ticker, quotes: btcQuotes } : ticker))
    const response = await handleCrypto(cryptoRequest('?symbols=eth'), {}, paprikaFetch(tickers), memoryCache())
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.usd_hkd).toBeNull()
    expect(body.top.map((coin) => coin.symbol)).toEqual(['btc', 'eth'])
    expect(body.held).toEqual([expect.objectContaining({ id: 'eth-ethereum', current_price: 20280 })])
    expect(body.global).toEqual({
      total_market_cap: { hkd: null },
      market_cap_change_percentage_24h_usd: -0.8,
      market_cap_percentage: { btc: 56.3 },
    })
  })

  it.each([
    ['a zero USD rate', { usd: { value: 0 }, hkd: { value: 655200 } }],
    ['a negative HKD rate', { usd: { value: 84000 }, hkd: { value: -655200 } }],
    ['a non-numeric USD rate', { usd: { value: '84000' }, hkd: { value: 655200 } }],
    ['missing rates', null],
  ])('keeps CoinGecko market data with usd_hkd null for %s', async (_, rates) => {
    const response = await handleCrypto(
      cryptoRequest('?symbols=btc'),
      { COINGECKO_API_KEY: 'demo' },
      coingeckoFetch(rates),
      memoryCache(),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ top: [{ symbol: 'btc' }], held: [{ symbol: 'btc' }], global: { btc: 1 }, usd_hkd: null })
  })

  it('serves stale data when the upstream fails, and 502 when there is none', async () => {
    const cache = memoryCache()
    await handleCrypto(cryptoRequest('?symbols=btc'), {}, paprikaFetch(), cache)
    const [key, stored] = [...cache.store.entries()][0]
    const headers = new Headers(stored.headers)
    headers.set('X-Fetched-At', String(Date.now() - 5 * 60 * 1000))
    cache.store.set(key, new Response(await stored.text(), { headers }))

    const limited = vi.fn().mockResolvedValue(new Response('', { status: 429 }))
    const stale = await handleCrypto(cryptoRequest('?symbols=btc'), {}, limited, cache)
    expect(stale.status).toBe(200)
    expect((await stale.json()).top[0].symbol).toBe('btc')

    const failed = await handleCrypto(cryptoRequest('?symbols=eth'), {}, limited, memoryCache())
    expect(failed.status).toBe(502)
    expect(await failed.json()).toEqual({ error: 'Upstream unavailable', detail: 'CoinPaprika 429' })
  })

  it.each(['?symbols=bt c', '?symbols=btc;eth', `?symbols=${'a'.repeat(16)}`])('rejects %s', async (query) => {
    const fetchMock = vi.fn()
    expect((await handleCrypto(cryptoRequest(query), {}, fetchMock, memoryCache())).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects non-GET', async () => {
    expect((await handleCrypto(cryptoRequest('', 'POST'), {}, vi.fn(), memoryCache())).status).toBe(405)
  })
})

const AWS_CRYPTO = 'https://d22qpfwiw6tc.cloudfront.net/api/crypto'
const AWS_BODY = {
  top: [{ id: 'btc-bitcoin', symbol: 'btc', current_price: 655200 }],
  held: [{ id: 'eth-ethereum', symbol: 'eth', current_price: 20280 }],
  global: {
    total_market_cap: { hkd: 23.4e12 },
    market_cap_change_percentage_24h_usd: -0.8,
    market_cap_percentage: { btc: 56.3 },
  },
  usd_hkd: 7.8,
}
const cloudflareEnv = { ASSETS: { fetch: vi.fn() } }
// Lambda gets process.env: the Worker secrets but no ASSETS binding.
const lambdaEnv = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-key', ASSETS_PASSWORD: 'pw' }

function jsonResponse(body, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }))
}

// CoinPaprika and CoinGecko refuse Cloudflare with 402; the AWS deployment answers with `fallback()`.
function blockedFetch(fallback = () => jsonResponse(AWS_BODY)) {
  return vi.fn((url) => (url.startsWith(AWS_CRYPTO) ? fallback() : Promise.resolve(new Response('', { status: 402 }))))
}

function fallbackCalls(fetchMock) {
  return fetchMock.mock.calls.filter(([url]) => url.startsWith(AWS_CRYPTO))
}

// Seed the cache from CoinPaprika, then age the entry past the fresh window.
async function staleCache(query) {
  const cache = memoryCache()
  await handleCrypto(cryptoRequest(query), {}, paprikaFetch(), cache)
  const [key, stored] = [...cache.store.entries()][0]
  const headers = new Headers(stored.headers)
  headers.set('X-Fetched-At', String(Date.now() - 5 * 60 * 1000))
  cache.store.set(key, new Response(await stored.text(), { headers }))
  return cache
}

describe('handleCrypto AWS fallback', () => {
  it.each([
    ['CoinPaprika', {}],
    ['CoinGecko', { COINGECKO_API_KEY: 'demo' }],
  ])('on Cloudflare, falls back to the AWS deployment when %s fails, and caches it', async (_, env) => {
    const fetchMock = blockedFetch(() => jsonResponse({ ...AWS_BODY, extra: 'dropped' }))
    const cache = memoryCache()

    const response = await handleCrypto(cryptoRequest('?symbols=ETH, btc,eth'), { ...cloudflareEnv, ...env }, fetchMock, cache)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(AWS_BODY)
    expect(fallbackCalls(fetchMock)).toEqual([
      [
        `${AWS_CRYPTO}?symbols=btc,eth`,
        { headers: { Accept: 'application/json', 'User-Agent': 'small-tools/1.0' }, signal: expect.any(AbortSignal) },
      ],
    ])
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1)

    const stored = cache.store.get('https://small-tools.cache/crypto?symbols=btc,eth')
    expect(stored.headers.get('Cache-Control')).toBe('max-age=3600')
    expect(Date.now() - Number(stored.headers.get('X-Fetched-At'))).toBeLessThan(1000)
    expect(await stored.clone().json()).toEqual(AWS_BODY)

    const calls = fetchMock.mock.calls.length
    const cached = await handleCrypto(cryptoRequest('?symbols=btc,eth'), { ...cloudflareEnv, ...env }, fetchMock, cache)
    expect(await cached.json()).toEqual(AWS_BODY)
    expect(fetchMock).toHaveBeenCalledTimes(calls)
  })

  it('asks the fallback for an empty symbol list as-is', async () => {
    const fetchMock = blockedFetch()
    expect((await handleCrypto(cryptoRequest('?symbols='), cloudflareEnv, fetchMock, memoryCache())).status).toBe(200)
    expect(fallbackCalls(fetchMock).map(([url]) => url)).toEqual([`${AWS_CRYPTO}?symbols=`])
  })

  it.each([
    ['an HTTP error', () => jsonResponse(AWS_BODY, 502)],
    ['a network error', () => Promise.reject(new Error('down'))],
    ['a non-JSON body', () => Promise.resolve(new Response('<html>', { status: 200 }))],
    ['an error body', () => jsonResponse({ error: 'Upstream unavailable' })],
    ['a non-array top', () => jsonResponse({ ...AWS_BODY, top: {} })],
    ['a non-object coin', () => jsonResponse({ ...AWS_BODY, held: ['btc'] })],
    ['a missing global', () => jsonResponse({ top: [], held: [], usd_hkd: null })],
    ['a zero usd_hkd', () => jsonResponse({ ...AWS_BODY, usd_hkd: 0 })],
    ['a string usd_hkd', () => jsonResponse({ ...AWS_BODY, usd_hkd: '7.8' })],
    ['an empty coin', () => jsonResponse({ ...AWS_BODY, top: [{}] })],
    ['a coin without an id', () => jsonResponse({ ...AWS_BODY, held: [{ symbol: 'eth', current_price: 20280 }] })],
    ['a coin with an empty symbol', () => jsonResponse({ ...AWS_BODY, top: [{ id: 'x', symbol: '', current_price: 1 }] })],
    ['a coin with a numeric symbol', () => jsonResponse({ ...AWS_BODY, top: [{ id: 'x', symbol: 1, current_price: 1 }] })],
    ['a coin without a price', () => jsonResponse({ ...AWS_BODY, top: [{ id: 'x', symbol: 'x' }] })],
    ['a string price', () => jsonResponse({ ...AWS_BODY, top: [{ id: 'x', symbol: 'x', current_price: '1' }] })],
    ['a zero price', () => jsonResponse({ ...AWS_BODY, top: [{ id: 'x', symbol: 'x', current_price: 0 }] })],
    ['a non-string name', () => jsonResponse({ ...AWS_BODY, top: [{ ...AWS_BODY.top[0], name: {} }] })],
    ['a string market cap', () => jsonResponse({ ...AWS_BODY, top: [{ ...AWS_BODY.top[0], market_cap: '1e12' }] })],
    ['a global without nested objects', () => jsonResponse({ ...AWS_BODY, global: {} })],
    ['a non-object total_market_cap', () => jsonResponse({ ...AWS_BODY, global: { ...AWS_BODY.global, total_market_cap: 1 } })],
    ['a string total_market_cap.hkd', () => jsonResponse({ ...AWS_BODY, global: { ...AWS_BODY.global, total_market_cap: { hkd: '1' } } })],
    ['a string 24h change', () => jsonResponse({ ...AWS_BODY, global: { ...AWS_BODY.global, market_cap_change_percentage_24h_usd: '-0.8' } })],
    ['an array market_cap_percentage', () => jsonResponse({ ...AWS_BODY, global: { ...AWS_BODY.global, market_cap_percentage: [56.3] } })],
    ['a string btc dominance', () => jsonResponse({ ...AWS_BODY, global: { ...AWS_BODY.global, market_cap_percentage: { btc: '56.3' } } })],
    ['an empty total_market_cap', () => jsonResponse({ ...AWS_BODY, global: { ...AWS_BODY.global, total_market_cap: {} } })],
    ['a null total_market_cap.hkd', () => jsonResponse({ ...AWS_BODY, global: { ...AWS_BODY.global, total_market_cap: { hkd: null } } })],
    ['an empty market_cap_percentage', () => jsonResponse({ ...AWS_BODY, global: { ...AWS_BODY.global, market_cap_percentage: {} } })],
    ['a null btc dominance', () => jsonResponse({ ...AWS_BODY, global: { ...AWS_BODY.global, market_cap_percentage: { btc: null } } })],
    [
      'a missing 24h change',
      () => jsonResponse({ ...AWS_BODY, global: { total_market_cap: { hkd: 23.4e12 }, market_cap_percentage: { btc: 56.3 } } }),
    ],
    ['a null 24h change', () => jsonResponse({ ...AWS_BODY, global: { ...AWS_BODY.global, market_cap_change_percentage_24h_usd: null } })],  ])('returns 502 without caching when the fallback gives %s', async (_, fallback) => {
    const fetchMock = blockedFetch(fallback)
    const cache = memoryCache()
    const response = await handleCrypto(cryptoRequest('?symbols=btc'), cloudflareEnv, fetchMock, cache)
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'Upstream unavailable', detail: 'CoinPaprika 402' })
    expect(fallbackCalls(fetchMock)).toHaveLength(1)
    expect(cache.store.size).toBe(0)
  })

  it('serves stale data when the fallback also fails', async () => {
    const cache = await staleCache('?symbols=btc')
    const fetchMock = blockedFetch(() => jsonResponse({}, 503))
    const response = await handleCrypto(cryptoRequest('?symbols=btc'), cloudflareEnv, fetchMock, cache)
    expect(response.status).toBe(200)
    expect((await response.json()).held[0]).toMatchObject({ id: 'btc-bitcoin', current_price: 655200 })
    expect(fallbackCalls(fetchMock)).toHaveLength(1)
  })

  it('keeps stale data when the fallback answers HTTP 200 with malformed coins', async () => {
    const cache = await staleCache('?symbols=btc')
    const before = await cache.store.get('https://small-tools.cache/crypto?symbols=btc').clone().text()
    const fetchMock = blockedFetch(() => jsonResponse({ ...AWS_BODY, top: [{}], held: [{ id: 'btc-bitcoin' }] }))
    const response = await handleCrypto(cryptoRequest('?symbols=btc'), cloudflareEnv, fetchMock, cache)
    expect(response.status).toBe(200)
    expect((await response.json()).held[0]).toMatchObject({ id: 'btc-bitcoin', current_price: 655200 })
    expect(await cache.store.get('https://small-tools.cache/crypto?symbols=btc').clone().text()).toBe(before)
  })

  it.each([
    ['a string', 'true'],
    ['an empty object', {}],
    ['a non-function fetch', { fetch: 'https://example.com' }],
  ])('treats ASSETS as %s as not Cloudflare and never calls the fallback', async (_, ASSETS) => {
    const fetchMock = blockedFetch()
    const response = await handleCrypto(cryptoRequest('?symbols=btc'), { ...lambdaEnv, ASSETS }, fetchMock, memoryCache())
    expect(response.status).toBe(502)
    expect(fetchMock).toHaveBeenCalled()
    expect(fallbackCalls(fetchMock)).toHaveLength(0)
  })

  describe('timeout', () => {
    // The stalled fallbacks below never answer on their own, only rejecting once their signal aborts.
    it('aborts a stalled fallback after 5 seconds and serves stale data', async () => {
      const cache = await staleCache('?symbols=btc')
      vi.useFakeTimers()
      try {
        let signal
        const fetchMock = blockedFetch(
          () =>
            new Promise((_, reject) => {
              signal = fallbackCalls(fetchMock)[0][1].signal
              signal.addEventListener('abort', () => reject(signal.reason))
            }),
        )
        const pending = handleCrypto(cryptoRequest('?symbols=btc'), cloudflareEnv, fetchMock, cache)
        await vi.advanceTimersByTimeAsync(4999)
        expect(signal.aborted).toBe(false)
        await vi.advanceTimersByTimeAsync(1)
        expect(signal.aborted).toBe(true)
        const response = await pending
        expect(response.status).toBe(200)
        expect((await response.json()).held[0].id).toBe('btc-bitcoin')
        expect(vi.getTimerCount()).toBe(0)
      } finally {
        vi.useRealTimers()
      }
    })

    it('returns 502 when a stalled fallback is aborted and there is no stale data', async () => {
      vi.useFakeTimers()
      try {
        const fetchMock = blockedFetch(
          () =>
            new Promise((_, reject) => {
              const { signal } = fallbackCalls(fetchMock)[0][1]
              signal.addEventListener('abort', () => reject(signal.reason))
            }),
        )
        const cache = memoryCache()
        const pending = handleCrypto(cryptoRequest('?symbols=btc'), cloudflareEnv, fetchMock, cache)
        await vi.advanceTimersByTimeAsync(5000)
        const response = await pending
        expect(response.status).toBe(502)
        expect(await response.json()).toEqual({ error: 'Upstream unavailable', detail: 'CoinPaprika 402' })
        expect(cache.store.size).toBe(0)
        expect(vi.getTimerCount()).toBe(0)
      } finally {
        vi.useRealTimers()
      }
    })

    it('clears the timer after a successful fallback without aborting it', async () => {
      vi.useFakeTimers()
      try {
        const fetchMock = blockedFetch()
        const response = await handleCrypto(cryptoRequest('?symbols=btc'), cloudflareEnv, fetchMock, memoryCache())
        expect(await response.json()).toEqual(AWS_BODY)
        expect(vi.getTimerCount()).toBe(0)
        expect(fallbackCalls(fetchMock)[0][1].signal.aborted).toBe(false)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  it('prefers a successful fallback over stale data and refreshes the cache', async () => {
    const cache = await staleCache('?symbols=btc')
    const fetchMock = blockedFetch()
    const response = await handleCrypto(cryptoRequest('?symbols=btc'), cloudflareEnv, fetchMock, cache)
    expect(await response.json()).toEqual(AWS_BODY)
    const stored = cache.store.get('https://small-tools.cache/crypto?symbols=btc')
    expect(Date.now() - Number(stored.headers.get('X-Fetched-At'))).toBeLessThan(1000)
    expect(await stored.clone().json()).toEqual(AWS_BODY)
  })

  it('does not call the primary or the fallback while the cache is fresh', async () => {
    const cache = memoryCache()
    await handleCrypto(cryptoRequest('?symbols=btc'), {}, paprikaFetch(), cache)
    const fetchMock = blockedFetch()
    expect((await handleCrypto(cryptoRequest('?symbols=btc'), cloudflareEnv, fetchMock, cache)).status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['CoinPaprika', lambdaEnv],
    ['CoinGecko', { ...lambdaEnv, COINGECKO_API_KEY: 'demo' }],
  ])('never calls itself without the ASSETS binding when %s fails (AWS Lambda)', async (_, env) => {
    const fetchMock = blockedFetch()
    const failed = await handleCrypto(cryptoRequest('?symbols=btc'), env, fetchMock, memoryCache())
    expect(failed.status).toBe(502)

    const stale = await handleCrypto(cryptoRequest('?symbols=btc'), env, fetchMock, await staleCache('?symbols=btc'))
    expect(stale.status).toBe(200)
    expect((await stale.json()).held[0].id).toBe('btc-bitcoin')

    expect(fetchMock).toHaveBeenCalled()
    expect(fallbackCalls(fetchMock)).toHaveLength(0)
  })

  it('routes /api/crypto through the fallback only for the Cloudflare env', async () => {
    const fetchMock = blockedFetch()
    vi.stubGlobal('fetch', fetchMock)
    try {
      const lambda = await worker.fetch(cryptoRequest('?symbols=btc'), lambdaEnv)
      expect(lambda.status).toBe(502)
      expect(fallbackCalls(fetchMock)).toHaveLength(0)

      const cloudflare = await worker.fetch(cryptoRequest('?symbols=btc'), cloudflareEnv)
      expect(cloudflare.status).toBe(200)
      expect(await cloudflare.json()).toEqual(AWS_BODY)
      expect(fallbackCalls(fetchMock)).toHaveLength(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

const TENCENT_METALS = [
  'v_hf_XAU="4254.12,-0.77,4254.12,4254.47,4303.09,4244.26,22:58:00,4287.28,4290.90,0,0,0,2026-09-24,name";',
  'v_hf_XAG="63.24,-1.83,63.24,63.28,64.53,63.20,22:58:00,64.42,64.39,0,0,0,2026-09-24,name";',
  'v_whUSDHKD="310~name~USDHKD~7.8426~0~20260924225921~7.8430";',
].join('\n')

describe('handleMetals', () => {
  it('parses spot metals and the USD/HKD rate', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(TENCENT_METALS, { status: 200 }))
    const response = await handleMetals(new Request('https://small-tools.test/api/metals'), fetchMock)
    expect(fetchMock).toHaveBeenCalledWith('https://qt.gtimg.cn/q=hf_XAU,hf_XAG,hf_XPT,hf_XPD,whUSDHKD')
    expect(await response.json()).toEqual({
      metals: {
        XAU: { priceUsd: 4254.12, previousCloseUsd: 4287.28, changePercent: -0.77, time: '2026-09-24 22:58:00' },
        XAG: { priceUsd: 63.24, previousCloseUsd: 64.42, changePercent: -1.83, time: '2026-09-24 22:58:00' },
      },
      usdHkd: 7.8426,
    })
  })

  it('fails when the feed is down or returns nothing usable', async () => {
    const request = new Request('https://small-tools.test/api/metals')
    expect((await handleMetals(request, vi.fn().mockRejectedValue(new Error('x')))).status).toBe(502)
    expect((await handleMetals(request, vi.fn().mockResolvedValue(new Response('v_pv_none_match="1";')))).status).toBe(502)
    expect((await handleMetals(new Request(request, { method: 'POST' }), vi.fn())).status).toBe(405)
  })
})

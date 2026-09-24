// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { handleApi, handleQuotes } from './worker.js'

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
  'v_r_hkHSI="100~name~HSI~24761.130~24834.120~24649.450~1~0~0~24761.130~0~0~0~0~0~0~0~0~0~24761.130~0~0~0~0~0~0~0~0~0~0.0~2026/09/24 16:08:39~-72.990~-0.29~24791.200";',
  'v_r_hk00001="100~name~00001~68.100~67.600~67.750~1~0~0~68.100~0~0~0~0~0~0~0~0~0~68.100~0~0~0~0~0~0~0~0~0~1.0~2026/09/24 16:08:39~0.500~0.74~68.200";',
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
        HSI: { price: 24761.13, previousClose: 24834.12, change: -72.99, changePercent: -0.29, time: '2026/09/24 16:08:39' },
        '00001': { price: 68.1, previousClose: 67.6, change: 0.5, changePercent: 0.74, time: '2026/09/24 16:08:39' },
      },
    })
  })

  it.each(['', '?codes=', '?codes=HSI,1', '?codes=HSI,00001;x', `?codes=${Array.from({ length: 61 }, (_, i) => String(i).padStart(5, '0')).join(',')}`])(
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

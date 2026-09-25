// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryCache, handler, toRequest, toResult } from './lambda.js'

function urlEvent({ method = 'GET', path = '/api/metals', query = '', headers = {}, body, isBase64Encoded = false } = {}) {
  return {
    version: '2.0',
    rawPath: path,
    rawQueryString: query,
    headers: { host: 'abc.lambda-url.ap-southeast-1.on.aws', ...headers },
    requestContext: { domainName: 'abc.lambda-url.ap-southeast-1.on.aws', http: { method, path } },
    body,
    isBase64Encoded,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('toRequest', () => {
  it('rebuilds the URL, method and headers from a Function URL event', () => {
    const request = toRequest(
      urlEvent({ path: '/api/asset_positions', query: 'select=*&limit=5', headers: { authorization: 'Bearer pw' } }),
    )
    expect(request.url).toBe('https://abc.lambda-url.ap-southeast-1.on.aws/api/asset_positions?select=*&limit=5')
    expect(request.method).toBe('GET')
    expect(request.headers.get('authorization')).toBe('Bearer pw')
  })

  it('prefers the viewer host that CloudFront forwards', () => {
    const request = toRequest(urlEvent({ headers: { 'x-forwarded-host': 'd22qpfwiw6tc.cloudfront.net' } }))
    expect(new URL(request.url).host).toBe('d22qpfwiw6tc.cloudfront.net')
  })

  it('decodes base64 bodies', async () => {
    const request = toRequest(
      urlEvent({ method: 'POST', body: Buffer.from('hello').toString('base64'), isBase64Encoded: true }),
    )
    expect(await request.text()).toBe('hello')
  })
})

describe('toResult', () => {
  it('returns status, headers and a base64 body', async () => {
    const result = await toResult(
      new Response('{"ok":true}', { status: 201, headers: { 'Content-Type': 'application/json' } }),
    )
    expect(result.statusCode).toBe(201)
    expect(result.headers['content-type']).toBe('application/json')
    expect(result.isBase64Encoded).toBe(true)
    expect(Buffer.from(result.body, 'base64').toString()).toBe('{"ok":true}')
  })
})

describe('createMemoryCache', () => {
  it('returns a fresh copy of a stored response each time', async () => {
    const cache = createMemoryCache()
    const key = new Request('https://small-tools.cache/crypto?symbols=btc')
    expect(await cache.match(key)).toBeUndefined()
    await cache.put(key, new Response('cached'))
    expect(await (await cache.match(key)).text()).toBe('cached')
    expect(await (await cache.match(key)).text()).toBe('cached')
  })
})

describe('handler', () => {
  it('routes /api/* through the Worker with process.env as its env', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key')
    vi.stubEnv('ASSETS_PASSWORD', 'correct horse')
    const fetchMock = vi.fn().mockResolvedValue(new Response('[{"id":1}]', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await handler(
      urlEvent({ path: '/api/asset_positions', query: 'select=*', headers: { authorization: 'Bearer correct horse' } }),
    )

    expect(result.statusCode).toBe(200)
    expect(Buffer.from(result.body, 'base64').toString()).toBe('[{"id":1}]')
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://example.supabase.co/rest/v1/asset_positions?select=*')
  })

  it('rejects a wrong password', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key')
    vi.stubEnv('ASSETS_PASSWORD', 'correct horse')
    const result = await handler(urlEvent({ path: '/api/asset_positions', headers: { authorization: 'Bearer nope' } }))
    expect(result.statusCode).toBe(401)
  })
})

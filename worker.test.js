// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { handleApi } from './worker.js'

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

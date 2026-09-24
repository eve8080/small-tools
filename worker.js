// Cloudflare Worker: serves the SPA from static assets and exposes a read-only,
// password-protected proxy to Supabase at /api/<table>.
//
// Required secrets (set with `wrangler secret put <NAME>`; never commit them):
//   SUPABASE_URL               e.g. https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  server-side only; bypasses row-level security
//   ASSETS_PASSWORD            clients must send `Authorization: Bearer <password>`

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

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    if (pathname.startsWith('/api/')) {
      return handleApi(request, env)
    }
    return env.ASSETS.fetch(request)
  },
}

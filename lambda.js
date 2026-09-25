// AWS Lambda adapter: runs the Worker's /api/* routes behind a Lambda Function URL, which
// CloudFront routes /api/* to. The static SPA is served from S3, so env.ASSETS is not needed.
//
// Environment variables (same names as the Worker secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ASSETS_PASSWORD, optional COINGECKO_API_KEY

import worker from './worker.js'

// Lambda has no Cache API, so /api/crypto gets a per-container in-memory stand-in.
export function createMemoryCache() {
  const entries = new Map()
  return {
    async match(request) {
      return entries.get(request.url)?.clone()
    },
    async put(request, response) {
      entries.set(request.url, response.clone())
    },
  }
}

// Function URL events use the API Gateway HTTP API payload format 2.0.
export function toRequest(event) {
  const { http } = event.requestContext
  const headers = new Headers()
  for (const [name, value] of Object.entries(event.headers ?? {})) headers.set(name, value)
  if (event.cookies?.length) headers.set('cookie', event.cookies.join('; '))

  const host = event.headers?.['x-forwarded-host'] ?? event.requestContext.domainName
  const query = event.rawQueryString ? `?${event.rawQueryString}` : ''
  const init = { method: http.method, headers }
  if (event.body && http.method !== 'GET' && http.method !== 'HEAD') {
    init.body = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body
  }
  return new Request(`https://${host}${event.rawPath}${query}`, init)
}

export async function toResult(response) {
  const headers = {}
  response.headers.forEach((value, name) => {
    headers[name] = value
  })
  return {
    statusCode: response.status,
    headers,
    body: Buffer.from(await response.arrayBuffer()).toString('base64'),
    isBase64Encoded: true,
  }
}

if (!globalThis.caches) globalThis.caches = { default: createMemoryCache() }

export async function handler(event) {
  const response = await worker.fetch(toRequest(event), process.env)
  return toResult(response)
}

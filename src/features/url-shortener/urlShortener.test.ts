import { describe, expect, it, vi } from 'vitest'
import { isValidHttpUrl, shortenUrl } from './urlShortener'

describe('isValidHttpUrl', () => {
  it('accepts a valid https URL', () => {
    expect(isValidHttpUrl('https://example.com/path?a=1')).toBe(true)
  })

  it('accepts a valid http URL', () => {
    expect(isValidHttpUrl('http://example.com')).toBe(true)
  })

  it('rejects an empty string', () => {
    expect(isValidHttpUrl('')).toBe(false)
  })

  it('rejects a whitespace-only string', () => {
    expect(isValidHttpUrl('   ')).toBe(false)
  })

  it('rejects a URL without a protocol', () => {
    expect(isValidHttpUrl('example.com')).toBe(false)
  })

  it('rejects a non-http protocol', () => {
    expect(isValidHttpUrl('javascript:alert(1)')).toBe(false)
  })

  it('rejects a malformed string', () => {
    expect(isValidHttpUrl('not a url at all')).toBe(false)
  })
})

describe('shortenUrl', () => {
  it('returns the shortened URL on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ shorturl: 'https://is.gd/abc123' }),
    })

    const result = await shortenUrl('https://example.com/a/very/long/path', fetchMock)

    expect(result).toEqual({ ok: true, shortUrl: 'https://is.gd/abc123' })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://is.gd/create.php?format=json&url=https%3A%2F%2Fexample.com%2Fa%2Fvery%2Flong%2Fpath',
    )
  })

  it('returns an error message when the API responds with an error payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({ errorcode: 1, errormessage: 'Please enter a valid URL to shorten' }),
    })

    const result = await shortenUrl('https://example.com', fetchMock)

    expect(result).toEqual({ ok: false, error: 'Please enter a valid URL to shorten' })
  })

  it('returns a generic error message when the network request fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))

    const result = await shortenUrl('https://example.com', fetchMock)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/連線|連接/)
    }
  })
})

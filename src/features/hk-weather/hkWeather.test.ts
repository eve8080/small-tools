import { describe, expect, it, vi } from 'vitest'
import { describeWeatherIcon, fetchHongKongWeather, formatHongKongClock } from './hkWeather'

function jsonResponse(body: unknown) {
  return { ok: true, json: () => Promise.resolve(body) }
}

describe('formatHongKongClock', () => {
  it('formats the time in Hong Kong time zone regardless of the input offset', () => {
    // 2026-09-24 13:05:09 UTC = 21:05:09 in Hong Kong
    const { time, date } = formatHongKongClock(new Date('2026-09-24T13:05:09Z'))
    expect(time).toBe('21:05:09')
    expect(date).toContain('2026')
    expect(date).toContain('24')
  })
})

describe('describeWeatherIcon', () => {
  it('maps a known HKO icon code', () => {
    expect(describeWeatherIcon(50)).toEqual({ emoji: '☀️', label: '陽光充沛' })
  })

  it('falls back for unknown or missing codes', () => {
    expect(describeWeatherIcon(999).label).toBe('天氣資料')
    expect(describeWeatherIcon(undefined).label).toBe('天氣資料')
  })
})

describe('fetchHongKongWeather', () => {
  it('combines the current report and local forecast', async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        url.endsWith('rhrread')
          ? jsonResponse({
              temperature: {
                data: [
                  { place: '京士柏', value: 27 },
                  { place: '香港天文台', value: 29 },
                ],
              },
              humidity: { data: [{ place: '香港天文台', value: 76 }] },
              icon: [60],
              warningMessage: ['雷暴警告'],
              updateTime: '2026-09-24T21:02:00+08:00',
            })
          : jsonResponse({ forecastDesc: '大致天晴。', outlook: '週末酷熱。' }),
      ),
    )

    const result = await fetchHongKongWeather(fetchMock as unknown as typeof fetch)

    expect(result).toEqual({
      ok: true,
      weather: {
        temperature: 29,
        humidity: 76,
        icon: { emoji: '☁️', label: '多雲' },
        warnings: ['雷暴警告'],
        forecast: '大致天晴。',
        outlook: '週末酷熱。',
        updateTime: '2026-09-24T21:02:00+08:00',
      },
    })
  })

  it('treats an empty warning string as no warnings', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ warningMessage: '' })))
    const result = await fetchHongKongWeather(fetchMock as unknown as typeof fetch)
    expect(result.ok && result.weather.warnings).toEqual([])
    expect(result.ok && result.weather.temperature).toBeNull()
  })

  it('returns an error when the request fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await fetchHongKongWeather(fetchMock)
    expect(result.ok).toBe(false)
  })

  it('returns an error on a non-OK HTTP response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) })
    const result = await fetchHongKongWeather(fetchMock)
    expect(result.ok).toBe(false)
  })
})

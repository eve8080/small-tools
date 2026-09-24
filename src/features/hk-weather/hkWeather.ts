export const HK_TIME_ZONE = 'Asia/Hong_Kong'

export function formatHongKongClock(date: Date): { time: string; date: string } {
  const time = new Intl.DateTimeFormat('zh-HK', {
    timeZone: HK_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(date)

  const dateText = new Intl.DateTimeFormat('zh-HK', {
    timeZone: HK_TIME_ZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date)

  return { time, date: dateText }
}

// 香港天文台天氣圖示編號：https://www.hko.gov.hk/textonly/v2/explain/wxicon_c.htm
const ICONS: Record<number, { emoji: string; label: string }> = {
  50: { emoji: '☀️', label: '陽光充沛' },
  51: { emoji: '🌤️', label: '間有陽光' },
  52: { emoji: '⛅', label: '短暫陽光' },
  53: { emoji: '🌦️', label: '間有陽光，幾陣驟雨' },
  54: { emoji: '🌦️', label: '短暫陽光，有驟雨' },
  60: { emoji: '☁️', label: '多雲' },
  61: { emoji: '☁️', label: '密雲' },
  62: { emoji: '🌧️', label: '微雨' },
  63: { emoji: '🌧️', label: '雨' },
  64: { emoji: '🌧️', label: '大雨' },
  65: { emoji: '⛈️', label: '雷暴' },
  70: { emoji: '🌙', label: '天色良好' },
  71: { emoji: '🌙', label: '天色良好' },
  72: { emoji: '🌙', label: '天色良好' },
  73: { emoji: '🌙', label: '天色良好' },
  74: { emoji: '🌙', label: '天色良好' },
  75: { emoji: '🌙', label: '天色良好' },
  76: { emoji: '☁️', label: '大致多雲' },
  77: { emoji: '🌙', label: '天色大致良好' },
  80: { emoji: '💨', label: '大風' },
  81: { emoji: '🏜️', label: '乾燥' },
  82: { emoji: '💧', label: '潮濕' },
  83: { emoji: '🌫️', label: '霧' },
  84: { emoji: '🌫️', label: '薄霧' },
  85: { emoji: '🌫️', label: '煙霞' },
  90: { emoji: '🥵', label: '熱' },
  91: { emoji: '🌡️', label: '暖' },
  92: { emoji: '🍃', label: '涼' },
  93: { emoji: '🥶', label: '冷' },
}

export function describeWeatherIcon(code: number | undefined): { emoji: string; label: string } {
  return (code !== undefined && ICONS[code]) || { emoji: '🌡️', label: '天氣資料' }
}

export interface HongKongWeather {
  temperature: number | null
  humidity: number | null
  icon: { emoji: string; label: string }
  warnings: string[]
  forecast: string
  outlook: string
  updateTime: string
}

export type WeatherResult = { ok: true; weather: HongKongWeather } | { ok: false; error: string }

const HKO_ENDPOINT = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?lang=tc&dataType='
const MAIN_STATION = '香港天文台'
const NETWORK_ERROR = '無法取得天氣資料，請檢查網絡連線後再試一次。'

interface StationReading {
  place: string
  value: number
}

interface CurrentReport {
  temperature?: { data?: StationReading[] }
  humidity?: { data?: StationReading[] }
  icon?: number[]
  warningMessage?: string | string[]
  updateTime?: string
}

interface LocalForecast {
  forecastDesc?: string
  outlook?: string
}

function readingAt(readings: StationReading[] | undefined): number | null {
  if (!readings?.length) return null
  const reading = readings.find((item) => item.place === MAIN_STATION) ?? readings[0]
  return typeof reading.value === 'number' ? reading.value : null
}

export async function fetchHongKongWeather(fetchFn: typeof fetch = fetch): Promise<WeatherResult> {
  try {
    const [currentResponse, forecastResponse] = await Promise.all([
      fetchFn(HKO_ENDPOINT + 'rhrread'),
      fetchFn(HKO_ENDPOINT + 'flw'),
    ])
    if (!currentResponse.ok || !forecastResponse.ok) {
      return { ok: false, error: NETWORK_ERROR }
    }

    const current = (await currentResponse.json()) as CurrentReport
    const forecast = (await forecastResponse.json()) as LocalForecast

    const warnings = Array.isArray(current.warningMessage)
      ? current.warningMessage.filter(Boolean)
      : current.warningMessage
        ? [current.warningMessage]
        : []

    return {
      ok: true,
      weather: {
        temperature: readingAt(current.temperature?.data),
        humidity: readingAt(current.humidity?.data),
        icon: describeWeatherIcon(current.icon?.[0]),
        warnings,
        forecast: forecast.forecastDesc ?? '',
        outlook: forecast.outlook ?? '',
        updateTime: current.updateTime ?? '',
      },
    }
  } catch {
    return { ok: false, error: NETWORK_ERROR }
  }
}

import { formatHongKongClock } from './hkWeather'
import { useHongKongWeather, useNow } from './useHkWeather'

export default function HkWeatherCardPreview() {
  const now = useNow()
  const { result } = useHongKongWeather()
  const weather = result?.ok ? result.weather : null

  let weatherText = '載入天氣中…'
  if (weather) {
    const temperature = weather.temperature !== null ? `${weather.temperature}°C` : '—'
    weatherText = `${weather.icon.emoji} ${temperature} · ${weather.icon.label}`
  } else if (result && !result.ok) {
    weatherText = '天氣暫時無法載入'
  }

  return (
    <span className="hk-card-preview">
      <span className="hk-card-time">{formatHongKongClock(now).time}</span>
      <span className="tool-card-desc">{weatherText}</span>
      {weather && weather.warnings.length > 0 && (
        <span className="hk-card-warning">⚠️ {weather.warnings.join('、')}</span>
      )}
    </span>
  )
}

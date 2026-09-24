import { useCallback, useEffect, useState } from 'react'
import ToolPageHeader from '../../components/ToolPageHeader'
import { findToolByPath } from '../../app/tools'
import { fetchHongKongWeather, formatHongKongClock, type WeatherResult } from './hkWeather'

const REFRESH_INTERVAL_MS = 10 * 60 * 1000
const tool = findToolByPath('/tools/hk-weather')!

function formatUpdateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return formatHongKongClock(date).time.slice(0, 5)
}

export default function HkWeatherTool() {
  const [now, setNow] = useState(() => new Date())
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<WeatherResult | null>(null)

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  const receiveWeather = useCallback((next: WeatherResult) => {
    setResult(next)
    setLoading(false)
  }, [])

  function loadWeather() {
    setLoading(true)
    void fetchHongKongWeather().then(receiveWeather)
  }

  useEffect(() => {
    let active = true
    const refresh = () =>
      fetchHongKongWeather().then((next) => {
        if (active) receiveWeather(next)
      })

    void refresh()
    const intervalId = window.setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [receiveWeather])

  const clock = formatHongKongClock(now)
  const weather = result?.ok ? result.weather : null

  return (
    <>
      <ToolPageHeader title={tool.name} description={tool.shortDescription} />
      <div className="panel hk-weather">
        <div className="hk-clock">
          <p className="hk-clock-time">{clock.time}</p>
          <p className="hk-clock-date">{clock.date}</p>
        </div>

        {weather && (
          <div className="hk-weather-now">
            <span className="hk-weather-icon" aria-hidden="true">
              {weather.icon.emoji}
            </span>
            <div>
              <p className="hk-weather-temp">
                {weather.temperature !== null ? `${weather.temperature}°C` : '—'}
              </p>
              <p className="hk-weather-meta">
                {weather.icon.label}
                {weather.humidity !== null && ` · 濕度 ${weather.humidity}%`}
              </p>
            </div>
          </div>
        )}

        {weather && weather.warnings.length > 0 && (
          <ul className="status-message status-message--error hk-weather-warnings" role="alert">
            {weather.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}

        {weather?.forecast && (
          <div className="hk-weather-forecast">
            <p>{weather.forecast}</p>
            {weather.outlook && <p className="hk-weather-meta">展望：{weather.outlook}</p>}
          </div>
        )}

        {result && !result.ok && (
          <p className="status-message status-message--error" role="alert">
            {result.error}
          </p>
        )}

        {loading && !result && <p className="status-message status-message--loading">載入天氣資料中…</p>}

        <div className="hk-weather-footer">
          <p className="field-hint">
            資料來源：香港天文台
            {weather?.updateTime && `（更新於 ${formatUpdateTime(weather.updateTime)}）`}
          </p>
          <button type="button" className="btn btn-secondary" onClick={loadWeather} disabled={loading}>
            {loading ? '更新中…' : '重新整理'}
          </button>
        </div>
      </div>
    </>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { fetchHongKongWeather, type WeatherResult } from './hkWeather'

const REFRESH_INTERVAL_MS = 10 * 60 * 1000

export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  return now
}

export function useHongKongWeather(): {
  result: WeatherResult | null
  loading: boolean
  refresh: () => void
} {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<WeatherResult | null>(null)

  const receiveWeather = useCallback((next: WeatherResult) => {
    setResult(next)
    setLoading(false)
  }, [])

  const refresh = useCallback(() => {
    setLoading(true)
    void fetchHongKongWeather().then(receiveWeather)
  }, [receiveWeather])

  useEffect(() => {
    let active = true
    const load = () =>
      fetchHongKongWeather().then((next) => {
        if (active) receiveWeather(next)
      })

    void load()
    const intervalId = window.setInterval(load, REFRESH_INTERVAL_MS)
    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [receiveWeather])

  return { result, loading, refresh }
}

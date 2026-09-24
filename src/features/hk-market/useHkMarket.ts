import { useCallback, useEffect, useState } from 'react'
import { fetchHkQuotes, type QuotesResult } from '../hk-stocks/hkStocks'
import { MARKET_CODES, buildSnapshot } from './hkMarket'

const REFRESH_INTERVAL_MS = 60 * 1000

export function useHkMarket() {
  const [result, setResult] = useState<QuotesResult | null>(null)
  const [loading, setLoading] = useState(true)

  const receive = useCallback((next: QuotesResult) => {
    setResult(next)
    setLoading(false)
  }, [])

  useEffect(() => {
    let active = true
    const load = () =>
      fetchHkQuotes(MARKET_CODES).then((next) => {
        if (active) receive(next)
      })
    void load()
    const intervalId = window.setInterval(load, REFRESH_INTERVAL_MS)
    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [receive])

  const refresh = useCallback(() => {
    setLoading(true)
    void fetchHkQuotes(MARKET_CODES).then(receive)
  }, [receive])

  const quotes = result?.ok ? result.quotes : null
  return {
    quotes,
    snapshot: quotes ? buildSnapshot(quotes) : null,
    error: result && !result.ok ? result.error : null,
    loading,
    refresh,
  }
}

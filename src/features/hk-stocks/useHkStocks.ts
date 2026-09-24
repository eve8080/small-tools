import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAssets } from '../assets/useAssets'
import { HSI_CODE, fetchHkQuotes, hkStockPositions, normalizeHkCode, summarizeHoldings, type QuotesResult } from './hkStocks'

const REFRESH_INTERVAL_MS = 60 * 1000

export function useHkStocks() {
  const assets = useAssets()
  const positions = assets.result?.ok ? assets.result.positions : null

  // Always quote the index; add the held stocks once positions are unlocked.
  const codesKey = useMemo(() => {
    const codes = new Set([HSI_CODE])
    for (const position of hkStockPositions(positions ?? [])) {
      const code = normalizeHkCode(position.symbol)
      if (code) codes.add(code)
    }
    return [...codes].join(',')
  }, [positions])

  const [quotes, setQuotes] = useState<QuotesResult | null>(null)
  const [quotesLoading, setQuotesLoading] = useState(true)

  const loadQuotes = useCallback(
    () =>
      fetchHkQuotes(codesKey.split(',')).then((next) => {
        setQuotes(next)
        setQuotesLoading(false)
      }),
    [codesKey],
  )

  useEffect(() => {
    let active = true
    const load = () =>
      fetchHkQuotes(codesKey.split(',')).then((next) => {
        if (!active) return
        setQuotes(next)
        setQuotesLoading(false)
      })
    void load()
    const intervalId = window.setInterval(load, REFRESH_INTERVAL_MS)
    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [codesKey])

  const liveQuotes = quotes?.ok ? quotes.quotes : {}
  const summary = positions ? summarizeHoldings(positions, liveQuotes) : null

  const refresh = useCallback(() => {
    setQuotesLoading(true)
    void loadQuotes()
    assets.refresh()
  }, [assets, loadQuotes])

  return {
    hsi: liveQuotes[HSI_CODE] ?? null,
    quotesError: quotes && !quotes.ok ? quotes.error : null,
    quotesLoading,
    summary,
    assets,
    refresh,
  }
}

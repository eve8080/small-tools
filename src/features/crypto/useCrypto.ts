import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAssets } from '../assets/useAssets'
import {
  cryptoPositions,
  fetchCryptoMarket,
  normalizeCryptoSymbol,
  summarizeCryptoHoldings,
  type CryptoMarketResult,
} from './crypto'

// The Worker caches CoinGecko data for a minute; polling faster wouldn't show anything newer.
const REFRESH_INTERVAL_MS = 2 * 60 * 1000

export function useCrypto() {
  const assets = useAssets()
  const positions = assets.result?.ok ? assets.result.positions : null

  const symbolsKey = useMemo(() => {
    const symbols = new Set<string>()
    for (const position of cryptoPositions(positions ?? [])) {
      const symbol = normalizeCryptoSymbol(position.symbol)
      if (symbol) symbols.add(symbol)
    }
    return [...symbols].sort().join(',')
  }, [positions])

  const [market, setMarket] = useState<CryptoMarketResult | null>(null)
  const [marketLoading, setMarketLoading] = useState(true)

  const load = useCallback(() => fetchCryptoMarket(symbolsKey ? symbolsKey.split(',') : []), [symbolsKey])

  useEffect(() => {
    let active = true
    const run = () =>
      load().then((next) => {
        if (!active) return
        setMarket(next)
        setMarketLoading(false)
      })
    void run()
    const intervalId = window.setInterval(run, REFRESH_INTERVAL_MS)
    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [load])

  const data = market?.ok ? market.data : null
  const summary = positions ? summarizeCryptoHoldings(positions, data?.held ?? {}) : null

  const refresh = useCallback(() => {
    setMarketLoading(true)
    void load().then((next) => {
      setMarket(next)
      setMarketLoading(false)
    })
    assets.refresh()
  }, [assets, load])

  return {
    market: data,
    marketError: market && !market.ok ? market.error : null,
    marketLoading,
    summary,
    assets,
    refresh,
  }
}

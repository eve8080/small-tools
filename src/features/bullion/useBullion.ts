import { useCallback, useEffect, useState } from 'react'
import { useAssets } from '../assets/useAssets'
import { fetchMetals, summarizeBullion, type MetalsResult } from './bullion'

const REFRESH_INTERVAL_MS = 60 * 1000

export function useBullion() {
  const assets = useAssets()
  const positions = assets.result?.ok ? assets.result.positions : null
  const [metals, setMetals] = useState<MetalsResult | null>(null)
  const [metalsLoading, setMetalsLoading] = useState(true)

  useEffect(() => {
    let active = true
    const load = () =>
      fetchMetals().then((next) => {
        if (!active) return
        setMetals(next)
        setMetalsLoading(false)
      })
    void load()
    const intervalId = window.setInterval(load, REFRESH_INTERVAL_MS)
    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [])

  const data = metals?.ok ? metals.data : null
  const summary = positions ? summarizeBullion(positions, data) : null

  const refresh = useCallback(() => {
    setMetalsLoading(true)
    void fetchMetals().then((next) => {
      setMetals(next)
      setMetalsLoading(false)
    })
    assets.refresh()
  }, [assets])

  return {
    market: data,
    marketError: metals && !metals.ok ? metals.error : null,
    marketLoading: metalsLoading,
    summary,
    assets,
    refresh,
  }
}

import { useCallback, useEffect, useState } from 'react'
import {
  clearStoredPassword,
  fetchAssetPositions,
  loadStoredPassword,
  storePassword,
  type AssetsResult,
} from './assetsClient'

export function useAssets(): {
  hasPassword: boolean
  loading: boolean
  result: AssetsResult | null
  unlock: (password: string) => void
  lock: () => void
  refresh: () => void
} {
  const [password, setPassword] = useState(loadStoredPassword)
  const [loading, setLoading] = useState(() => password !== '')
  const [result, setResult] = useState<AssetsResult | null>(null)

  const receive = useCallback((usedPassword: string, next: AssetsResult) => {
    if (next.ok) {
      storePassword(usedPassword)
    } else if (next.unauthorized) {
      clearStoredPassword()
      setPassword('')
    }
    setResult(next)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!password) return
    let active = true
    void fetchAssetPositions(password).then((next) => {
      if (active) receive(password, next)
    })
    return () => {
      active = false
    }
  }, [password, receive])

  const unlock = useCallback((nextPassword: string) => {
    setLoading(true)
    setPassword(nextPassword)
  }, [])

  const lock = useCallback(() => {
    clearStoredPassword()
    setPassword('')
    setResult(null)
    setLoading(false)
  }, [])

  const refresh = useCallback(() => {
    if (!password) return
    setLoading(true)
    void fetchAssetPositions(password).then((next) => receive(password, next))
  }, [password, receive])

  return { hasPassword: password !== '', loading, result, unlock, lock, refresh }
}

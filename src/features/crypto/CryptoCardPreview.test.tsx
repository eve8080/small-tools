import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import CryptoCardPreview from './CryptoCardPreview'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

it('falls back to the Supabase BTC price when live market data is unavailable', async () => {
  localStorage.setItem('small-tools:assets-password', 'pw')
  const positions = [
    { name: 'Bitcoin', symbol: 'BTC', asset_class: '加密貨幣', quantity: 0.5, market_value_hkd: 330000, price_date: '2026-09-23' },
  ]
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(
        url.startsWith('/api/asset_positions')
          ? { ok: true, status: 200, json: () => Promise.resolve(positions) }
          : { ok: false, status: 502, json: () => Promise.resolve({}) },
      ),
    ),
  )
  render(<CryptoCardPreview />)

  expect(await screen.findByText('HK$660,000')).toBeInTheDocument()
  expect(screen.getByText('Supabase · 2026-09-23')).toBeInTheDocument()
  expect(screen.getByText('HK$330,000')).toBeInTheDocument()
})

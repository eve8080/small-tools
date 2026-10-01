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

it('shows the live BTC price in USD', async () => {
  const btc = { id: 'btc-bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 655200, price_change_percentage_24h: -0.5 }
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(
        url.startsWith('/api/crypto')
          ? { ok: true, status: 200, json: () => Promise.resolve({ top: [btc], held: [], usd_hkd: 7.8 }) }
          : { ok: false, status: 401, json: () => Promise.resolve({}) },
      ),
    ),
  )
  render(<CryptoCardPreview />)

  expect(await screen.findByText('US$84,000')).toBeInTheDocument()
})

it('falls back to HKD when the USD rate is missing', async () => {
  const btc = { id: 'btc-bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 655200, price_change_percentage_24h: -0.5 }
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ top: [btc], held: [] }) })),
  )
  render(<CryptoCardPreview />)

  expect(await screen.findByText('HK$655,200')).toBeInTheDocument()
})

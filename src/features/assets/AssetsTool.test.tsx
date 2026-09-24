import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AssetsTool from './AssetsTool'

function renderAssetsTool() {
  return render(
    <MemoryRouter>
      <AssetsTool />
    </MemoryRouter>,
  )
}

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('AssetsTool', () => {
  it('asks for a password first and does not fetch without one', () => {
    const fetchMock = stubFetch(200, [])
    renderAssetsTool()

    expect(screen.getByRole('heading', { level: 1, name: '資產總覽' })).toBeInTheDocument()
    expect(screen.getByLabelText('密碼')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows the total and positions after unlocking, and remembers the password', async () => {
    stubFetch(200, [
      { name: '港股', symbol: '0700.HK', market_value_hkd: 30000, currency_code: 'HKD' },
      { name: '美元存款', symbol: null, market_value_hkd: 7800, currency_code: 'USD' },
    ])
    renderAssetsTool()

    fireEvent.change(screen.getByLabelText('密碼'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: '顯示資產' }))

    expect(await screen.findByRole('status')).toHaveTextContent('共 2 項持倉')
    expect(screen.getByText(/37,800/, { selector: '.assets-total' })).toBeInTheDocument()
    expect(screen.getByText('0700.HK')).toBeInTheDocument()
    expect(localStorage.getItem('small-tools:assets-password')).toBe('pw')
  })

  it('returns to the password form with an error when the password is wrong', async () => {
    stubFetch(401, { error: 'Unauthorized' })
    renderAssetsTool()

    fireEvent.change(screen.getByLabelText('密碼'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: '顯示資產' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('密碼不正確')
    expect(screen.getByLabelText('密碼')).toBeInTheDocument()
    expect(localStorage.getItem('small-tools:assets-password')).toBeNull()
  })
})

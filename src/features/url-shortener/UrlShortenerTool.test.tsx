import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UrlShortenerTool from './UrlShortenerTool'

const { shortenUrlMock } = vi.hoisted(() => ({
  shortenUrlMock: vi.fn(),
}))

vi.mock('./urlShortener', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./urlShortener')>()
  return {
    ...actual,
    shortenUrl: shortenUrlMock,
  }
})

function renderUrlShortenerTool() {
  return render(
    <MemoryRouter>
      <UrlShortenerTool />
    </MemoryRouter>,
  )
}

function setupUser() {
  const user = userEvent.setup()
  vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
  return user
}

beforeEach(() => {
  shortenUrlMock.mockReset()
})

describe('UrlShortenerTool', () => {
  it('shows a validation error and does not call the API for an invalid URL', async () => {
    const user = setupUser()
    renderUrlShortenerTool()

    await user.type(screen.getByLabelText('長網址'), 'not a url')
    await user.click(screen.getByRole('button', { name: '縮短網址' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/有效的|http/)
    expect(shortenUrlMock).not.toHaveBeenCalled()
  })

  it('shows the shortened link and lets the user copy it', async () => {
    shortenUrlMock.mockResolvedValue({ ok: true, shortUrl: 'https://is.gd/abc123' })
    const user = setupUser()
    renderUrlShortenerTool()

    await user.type(screen.getByLabelText('長網址'), 'https://example.com/a/long/path')
    await user.click(screen.getByRole('button', { name: '縮短網址' }))

    const link = await screen.findByRole('link', { name: 'https://is.gd/abc123' })
    expect(link).toHaveAttribute('href', 'https://is.gd/abc123')

    await user.click(screen.getByRole('button', { name: '複製連結' }))

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://is.gd/abc123')
    expect(await screen.findByText(/已複製/)).toBeInTheDocument()
  })

  it('shows an error message when the API call fails', async () => {
    shortenUrlMock.mockResolvedValue({ ok: false, error: '無法連接伺服器,請檢查網絡連線後再試一次。' })
    const user = setupUser()
    renderUrlShortenerTool()

    await user.type(screen.getByLabelText('長網址'), 'https://example.com')
    await user.click(screen.getByRole('button', { name: '縮短網址' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('無法連接伺服器,請檢查網絡連線後再試一次。')
  })

  it('trims whitespace before sending the URL to the shortening API', async () => {
    shortenUrlMock.mockResolvedValue({ ok: true, shortUrl: 'https://is.gd/abc123' })
    const user = setupUser()
    renderUrlShortenerTool()

    await user.type(screen.getByLabelText('長網址'), '  https://example.com/a/long/path  ')
    await user.click(screen.getByRole('button', { name: '縮短網址' }))

    await screen.findByRole('link', { name: 'https://is.gd/abc123' })
    expect(shortenUrlMock).toHaveBeenCalledWith('https://example.com/a/long/path')
  })

  it('shows an accessible error when clipboard copy fails, while keeping the short link visible', async () => {
    shortenUrlMock.mockResolvedValue({ ok: true, shortUrl: 'https://is.gd/abc123' })
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'))
    renderUrlShortenerTool()

    await user.type(screen.getByLabelText('長網址'), 'https://example.com/a/long/path')
    await user.click(screen.getByRole('button', { name: '縮短網址' }))
    await screen.findByRole('link', { name: 'https://is.gd/abc123' })

    await user.click(screen.getByRole('button', { name: '複製連結' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('複製失敗')
    expect(screen.getByRole('link', { name: 'https://is.gd/abc123' })).toBeInTheDocument()
  })
})

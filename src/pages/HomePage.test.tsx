import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HomePage from './HomePage'
import { tools } from '../app/tools'

function stubWeatherFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            url.endsWith('rhrread')
              ? {
                  temperature: { data: [{ place: '香港天文台', value: 29 }] },
                  icon: [60],
                  warningMessage: '',
                }
              : {},
          ),
      }),
    ),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('HomePage', () => {
  it('renders a compact hero heading', () => {
    stubWeatherFetch()
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: /Small Tools/ })).toBeInTheDocument()
  })

  it('renders a card for every registered tool, linking to its path', () => {
    stubWeatherFetch()
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    for (const tool of tools) {
      const link = screen.getByRole('link', { name: new RegExp(tool.name) })
      expect(link).toHaveAttribute('href', tool.path)
    }
  })

  it('shows live Hong Kong weather on the clock and weather card', async () => {
    stubWeatherFetch()
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('☁️ 29°C · 多雲')).toBeInTheDocument()
    expect(screen.getByText(/^\d{2}:\d{2}:\d{2}$/)).toBeInTheDocument()
  })
})

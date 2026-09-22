import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import HomePage from './HomePage'
import { tools } from '../app/tools'

describe('HomePage', () => {
  it('renders a compact hero heading', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: /Small Tools/ })).toBeInTheDocument()
  })

  it('renders a card for every registered tool, linking to its path', () => {
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
})

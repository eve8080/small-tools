import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { tools } from './app/tools'

function renderAt(path: string) {
  window.history.pushState({}, '', path)
  return render(<App />)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
})

afterEach(() => {
  window.history.pushState({}, '', '/')
  vi.unstubAllGlobals()
})

describe('App routing', () => {
  it.each(tools)(
    'renders the $name tool page with a heading, description, and back-to-home link',
    (tool) => {
      renderAt(tool.path)

      expect(screen.getByRole('heading', { level: 1, name: tool.name })).toBeInTheDocument()
      expect(screen.getByText(tool.shortDescription)).toBeInTheDocument()

      const backLink = screen.getByRole('link', { name: /返回/ })
      expect(backLink).toHaveAttribute('href', '/')
    },
  )
})

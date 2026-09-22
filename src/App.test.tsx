import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { tools } from './app/tools'

function renderAt(path: string) {
  window.history.pushState({}, '', path)
  return render(<App />)
}

afterEach(() => {
  window.history.pushState({}, '', '/')
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

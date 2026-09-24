import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ToolCard from './ToolCard'

const tool = {
  id: 'demo',
  path: '/tools/demo',
  name: '示範工具',
  shortDescription: '這是一個示範描述',
  icon: '🔧',
}

describe('ToolCard', () => {
  it('renders the tool name, description, and links to the tool path', () => {
    render(
      <MemoryRouter>
        <ToolCard tool={tool} />
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: /示範工具/ })
    expect(link).toHaveAttribute('href', '/tools/demo')
    expect(screen.getByText('這是一個示範描述')).toBeInTheDocument()
  })

  it('renders live preview content in place of the description when provided', () => {
    render(
      <MemoryRouter>
        <ToolCard tool={tool} preview={<span>即時內容</span>} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /即時內容/ })).toHaveAttribute('href', '/tools/demo')
    expect(screen.queryByText('這是一個示範描述')).not.toBeInTheDocument()
  })
})

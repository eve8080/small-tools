import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ToolPageHeader from './ToolPageHeader'

describe('ToolPageHeader', () => {
  it('renders the title, description, and a link back to the home page', () => {
    render(
      <MemoryRouter>
        <ToolPageHeader title="番茄鐘" description="專注與休息計時器" />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '番茄鐘' })).toBeInTheDocument()
    expect(screen.getByText('專注與休息計時器')).toBeInTheDocument()

    const backLink = screen.getByRole('link', { name: /返回/ })
    expect(backLink).toHaveAttribute('href', '/')
  })
})

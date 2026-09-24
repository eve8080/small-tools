import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { ToolDefinition } from '../app/tools'

interface ToolCardProps {
  tool: ToolDefinition
  /** Live content shown in place of the description, so the card is useful without opening the tool. */
  preview?: ReactNode
}

export default function ToolCard({ tool, preview }: ToolCardProps) {
  return (
    <Link to={tool.path} className="tool-card">
      <span className="tool-card-icon" aria-hidden="true">
        {tool.icon}
      </span>
      <span className="tool-card-name">{tool.name}</span>
      {preview ?? <span className="tool-card-desc">{tool.shortDescription}</span>}
    </Link>
  )
}

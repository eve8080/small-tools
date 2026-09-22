import { Link } from 'react-router-dom'
import type { ToolDefinition } from '../app/tools'

interface ToolCardProps {
  tool: ToolDefinition
}

export default function ToolCard({ tool }: ToolCardProps) {
  return (
    <Link to={tool.path} className="tool-card">
      <span className="tool-card-icon" aria-hidden="true">
        {tool.icon}
      </span>
      <span className="tool-card-name">{tool.name}</span>
      <span className="tool-card-desc">{tool.shortDescription}</span>
    </Link>
  )
}

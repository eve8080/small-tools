import { Link } from 'react-router-dom'

interface ToolPageHeaderProps {
  title: string
  description: string
}

export default function ToolPageHeader({ title, description }: ToolPageHeaderProps) {
  return (
    <div className="tool-page-header">
      <Link to="/" className="back-link">
        <span aria-hidden="true">←</span> 返回主頁
      </Link>
      <h1>{title}</h1>
      <p className="tool-page-description">{description}</p>
    </div>
  )
}

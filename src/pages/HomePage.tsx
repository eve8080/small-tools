import ToolCard from '../components/ToolCard'
import { tools } from '../app/tools'

export default function HomePage() {
  return (
    <div className="home">
      <section className="hero hero--compact">
        <h1>Small Tools 工具箱</h1>
        <p>日常好用的網頁小工具,一鍵開啟即用,持續加入更多工具。</p>
      </section>
      <section aria-label="工具列表" className="tool-grid">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </section>
    </div>
  )
}

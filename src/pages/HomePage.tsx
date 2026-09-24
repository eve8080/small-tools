import type { ComponentType } from 'react'
import ToolCard from '../components/ToolCard'
import { tools } from '../app/tools'
import HkWeatherCardPreview from '../features/hk-weather/HkWeatherCardPreview'
import AssetsCardPreview from '../features/assets/AssetsCardPreview'
import HkStocksCardPreview from '../features/hk-stocks/HkStocksCardPreview'
import CryptoCardPreview from '../features/crypto/CryptoCardPreview'

const cardPreviews: Record<string, ComponentType> = {
  'hk-weather': HkWeatherCardPreview,
  assets: AssetsCardPreview,
  'hk-stocks': HkStocksCardPreview,
  crypto: CryptoCardPreview,
}

export default function HomePage() {
  return (
    <div className="home">
      <section className="hero hero--compact">
        <h1>Small Tools 工具箱</h1>
        <p>日常好用的網頁小工具,一鍵開啟即用,持續加入更多工具。</p>
      </section>
      <section aria-label="工具列表" className="tool-grid">
        {tools.map((tool) => {
          const Preview = cardPreviews[tool.id]
          return <ToolCard key={tool.id} tool={tool} preview={Preview && <Preview />} />
        })}
      </section>
    </div>
  )
}

import { useHkMarket } from '../hk-market/useHkMarket'
import HeatTreemap from './HeatTreemap'

export default function HkHeatmapCardPreview() {
  const { snapshot, error } = useHkMarket()

  if (!snapshot || snapshot.stocks.length === 0) {
    return <span className="tool-card-desc">{error ? '熱圖暫時無法載入' : '載入熱圖中…'}</span>
  }

  return (
    <span className="heatmap-card">
      <HeatTreemap stocks={snapshot.stocks} height={120} labels={false} />
      <span className="tool-card-desc">
        <span data-change="up">升 {snapshot.breadth.up}</span> · <span data-change="down">跌 {snapshot.breadth.down}</span>
      </span>
    </span>
  )
}

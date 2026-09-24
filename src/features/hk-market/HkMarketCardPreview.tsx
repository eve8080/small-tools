import { changeDirection, formatIndex, formatPercent, formatSigned } from '../hk-stocks/hkStocks'
import { BreadthBar } from './HkMarketTool'
import { useHkMarket } from './useHkMarket'

export default function HkMarketCardPreview() {
  const { quotes, snapshot, error } = useHkMarket()
  const hsi = quotes?.HSI

  if (!quotes || !snapshot) {
    return <span className="tool-card-desc">{error ? '市況暫時無法載入' : '載入市況中…'}</span>
  }

  const topGainer = snapshot.gainers[0]
  const topLoser = snapshot.losers[0]
  return (
    <span className="hk-stocks-card">
      {hsi && (
        <span className="hk-stocks-card-figure">
          <span className="hk-stocks-card-value">{formatIndex(hsi.price)}</span>
          <span className="hk-stocks-card-change" data-change={changeDirection(hsi.change)}>
            {formatSigned(hsi.change)} ({formatPercent(hsi.changePercent)})
          </span>
        </span>
      )}
      <BreadthBar breadth={snapshot.breadth} />
      <span className="tool-card-desc">
        {topGainer && (
          <>
            領漲 {topGainer.name} <span data-change="up">{formatPercent(topGainer.changePercent)}</span>
          </>
        )}
        {topGainer && topLoser && ' · '}
        {topLoser && (
          <>
            領跌 {topLoser.name} <span data-change="down">{formatPercent(topLoser.changePercent)}</span>
          </>
        )}
      </span>
    </span>
  )
}

import { formatHkd } from '../assets/assetsClient'
import { changeDirection, formatIndex, formatPercent, formatSigned, formatSignedHkd } from './hkStocks'
import { useHkStocks } from './useHkStocks'

export default function HkStocksCardPreview() {
  const { hsi, quotesError, summary, assets } = useHkStocks()

  return (
    <span className="hk-stocks-card">
      <span className="hk-stocks-card-row">
        <span className="tool-card-desc">恒指</span>
        {hsi ? (
          <span className="hk-stocks-card-figure">
            <span className="hk-stocks-card-value">{formatIndex(hsi.price)}</span>
            <span className="hk-stocks-card-change" data-change={changeDirection(hsi.change)}>
              {formatSigned(hsi.change)} ({formatPercent(hsi.changePercent)})
            </span>
          </span>
        ) : (
          <span className="tool-card-desc">{quotesError ? '暫時無法載入' : '載入中…'}</span>
        )}
      </span>
      <span className="hk-stocks-card-row">
        <span className="tool-card-desc">港股持倉</span>
        {summary ? (
          <span className="hk-stocks-card-figure">
            <span className="hk-stocks-card-value">{formatHkd(summary.totalHkd)}</span>
            <span className="hk-stocks-card-change" data-change={changeDirection(summary.dayGainHkd)}>
              今日 {formatSignedHkd(summary.dayGainHkd)}
            </span>
          </span>
        ) : (
          <span className="tool-card-desc">
            {!assets.hasPassword ? '🔒 輸入密碼以顯示' : assets.loading ? '載入中…' : '暫時無法載入'}
          </span>
        )}
      </span>
    </span>
  )
}

import { formatHkd } from '../assets/assetsClient'
import { changeDirection, formatPercent, formatSignedHkd } from '../hk-stocks/hkStocks'
import { formatUsd } from './bullion'
import { useBullion } from './useBullion'

export default function BullionCardPreview() {
  const { market, marketError, summary, assets } = useBullion()
  const gold = market?.metals.XAU

  return (
    <span className="hk-stocks-card">
      <span className="hk-stocks-card-row">
        <span className="tool-card-desc">現貨金價（美元／盎司）</span>
        {gold ? (
          <span className="hk-stocks-card-figure">
            <span className="hk-stocks-card-value">{formatUsd(gold.priceUsd)}</span>
            <span className="hk-stocks-card-change" data-change={changeDirection(gold.changePercent)}>
              {formatPercent(gold.changePercent)}
            </span>
          </span>
        ) : (
          <span className="tool-card-desc">{marketError ? '暫時無法載入' : '載入中…'}</span>
        )}
      </span>
      <span className="hk-stocks-card-row">
        <span className="tool-card-desc">貴金屬持倉</span>
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

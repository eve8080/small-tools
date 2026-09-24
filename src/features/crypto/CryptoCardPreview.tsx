import { formatHkd } from '../assets/assetsClient'
import { changeDirection, formatPercent, formatSignedHkd } from '../hk-stocks/hkStocks'
import { formatCoinPrice } from './crypto'
import { useCrypto } from './useCrypto'

export default function CryptoCardPreview() {
  const { market, marketError, summary, assets } = useCrypto()
  const btc = market?.top.find((coin) => coin.symbol === 'btc') ?? null

  return (
    <span className="hk-stocks-card">
      <span className="hk-stocks-card-row">
        <span className="tool-card-desc">比特幣 BTC</span>
        {btc ? (
          <span className="hk-stocks-card-figure">
            <span className="hk-stocks-card-value">{formatCoinPrice(btc.priceHkd)}</span>
            <span className="hk-stocks-card-change" data-change={changeDirection(btc.change24hPercent)}>
              24h {formatPercent(btc.change24hPercent)}
            </span>
          </span>
        ) : (
          <span className="tool-card-desc">{marketError ? '暫時無法載入' : '載入中…'}</span>
        )}
      </span>
      <span className="hk-stocks-card-row">
        <span className="tool-card-desc">加密貨幣持倉</span>
        {summary ? (
          <span className="hk-stocks-card-figure">
            <span className="hk-stocks-card-value">{formatHkd(summary.totalHkd)}</span>
            <span className="hk-stocks-card-change" data-change={changeDirection(summary.change24hHkd)}>
              24h {formatSignedHkd(summary.change24hHkd)}
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

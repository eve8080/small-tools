import ToolPageHeader from '../../components/ToolPageHeader'
import { findToolByPath } from '../../app/tools'
import { formatHkd } from '../assets/assetsClient'
import PasswordForm from '../assets/PasswordForm'
import { changeDirection, formatPercent, formatSignedHkd } from '../hk-stocks/hkStocks'
import { formatCoinPrice, formatCompactHkd, type CoinMarket, type CryptoHoldingRow } from './crypto'
import { useCrypto } from './useCrypto'

const tool = findToolByPath('/tools/crypto')!

const quantityFormat = new Intl.NumberFormat('zh-HK', { maximumFractionDigits: 8 })

function HoldingsTable({ rows }: { rows: CryptoHoldingRow[] }) {
  return (
    <div className="assets-table-wrap">
      <table className="assets-table">
        <thead>
          <tr>
            <th scope="col">名稱</th>
            <th scope="col">代號</th>
            <th scope="col" data-numeric="true">數量</th>
            <th scope="col" data-numeric="true">現價</th>
            <th scope="col" data-numeric="true">24 小時</th>
            <th scope="col" data-numeric="true">市值（港元）</th>
            <th scope="col" data-numeric="true">24 小時盈虧</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.symbol}>
              <td data-label="名稱">{row.name}</td>
              <td data-label="代號">{row.symbol}</td>
              <td data-label="數量" data-numeric="true">
                {row.quantity === null ? '—' : quantityFormat.format(row.quantity)}
              </td>
              <td data-label="現價" data-numeric="true">
                {row.coin ? formatCoinPrice(row.coin.priceHkd) : '—'}
              </td>
              <td data-label="24 小時" data-numeric="true" data-change={changeDirection(row.coin?.change24hPercent ?? null)}>
                {row.coin ? formatPercent(row.coin.change24hPercent) || '—' : '—'}
              </td>
              <td data-label="市值（港元）" data-numeric="true">
                {formatHkd(row.valueHkd)}
              </td>
              <td data-label="24 小時盈虧" data-numeric="true" data-change={changeDirection(row.change24hHkd)}>
                {row.change24hHkd === null ? '—' : formatSignedHkd(row.change24hHkd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MarketTable({ coins }: { coins: CoinMarket[] }) {
  return (
    <div className="assets-table-wrap">
      <table className="assets-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">名稱</th>
            <th scope="col" data-numeric="true">價格</th>
            <th scope="col" data-numeric="true">24 小時</th>
            <th scope="col" data-numeric="true">市值</th>
          </tr>
        </thead>
        <tbody>
          {coins.map((coin) => (
            <tr key={coin.id}>
              <td data-label="排名">{coin.rank ?? '—'}</td>
              <td data-label="名稱">
                <span className="crypto-coin">
                  {coin.image && <img src={coin.image} alt="" width={20} height={20} loading="lazy" />}
                  {coin.name} <span className="field-hint">{coin.symbol.toUpperCase()}</span>
                </span>
              </td>
              <td data-label="價格" data-numeric="true">
                {formatCoinPrice(coin.priceHkd)}
              </td>
              <td data-label="24 小時" data-numeric="true" data-change={changeDirection(coin.change24hPercent)}>
                {formatPercent(coin.change24hPercent) || '—'}
              </td>
              <td data-label="市值" data-numeric="true">
                {coin.marketCapHkd === null ? '—' : formatCompactHkd(coin.marketCapHkd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function CryptoTool() {
  const { market, marketError, marketLoading, summary, assets, refresh } = useCrypto()
  const loading = marketLoading || assets.loading
  const global = market?.global

  return (
    <>
      <ToolPageHeader title={tool.name} description={tool.shortDescription} />
      <div className="panel assets">
        <section className="hk-stocks-stats" aria-label="市場及持倉摘要">
          <div className="hk-stat">
            <p className="field-hint">加密貨幣總市值</p>
            {global?.marketCapHkd != null ? (
              <>
                <p className="hk-stat-value">{formatCompactHkd(global.marketCapHkd)}</p>
                <p className="hk-stat-change" data-change={changeDirection(global.marketCapChange24hPercent)}>
                  24 小時 {formatPercent(global.marketCapChange24hPercent)}
                </p>
                {global.btcDominance !== null && (
                  <p className="field-hint">BTC 佔比 {global.btcDominance.toFixed(1)}%</p>
                )}
              </>
            ) : (
              <p className="hk-stat-change">{marketLoading ? '載入中…' : '—'}</p>
            )}
          </div>

          {summary && (
            <div className="hk-stat">
              <p className="field-hint">加密貨幣持倉總值</p>
              <p className="hk-stat-value">{formatHkd(summary.totalHkd)}</p>
              <p className="hk-stat-change" data-change={changeDirection(summary.change24hHkd)}>
                24 小時 {formatSignedHkd(summary.change24hHkd)}
                {summary.change24hPercent !== null && ` (${formatPercent(summary.change24hPercent)})`}
              </p>
              <p className="field-hint" role="status">
                共 {summary.rows.length} 種加密貨幣{!summary.complete && ' · 部分未有即時報價'}
              </p>
            </div>
          )}
        </section>

        {marketError && (
          <p className="status-message status-message--error" role="alert">
            {marketError}
          </p>
        )}

        {!assets.hasPassword ? (
          <PasswordForm
            id="crypto-password"
            submitLabel="顯示加密貨幣持倉"
            onUnlock={assets.unlock}
            error={assets.result && !assets.result.ok ? assets.result.error : undefined}
          />
        ) : (
          <>
            {assets.loading && !summary && <p className="status-message status-message--loading">載入持倉中…</p>}
            {assets.result && !assets.result.ok && (
              <p className="status-message status-message--error" role="alert">
                {assets.result.error}
              </p>
            )}
            {summary && summary.rows.length === 0 && (
              <p className="status-message status-message--loading">未有加密貨幣持倉。</p>
            )}
            {summary && summary.rows.length > 0 && (
              <section aria-labelledby="crypto-holdings-heading" className="crypto-section">
                <h2 id="crypto-holdings-heading" className="crypto-heading">
                  我的持倉
                </h2>
                <HoldingsTable rows={summary.rows} />
              </section>
            )}
          </>
        )}

        {market && market.top.length > 0 && (
          <section aria-labelledby="crypto-market-heading" className="crypto-section">
            <h2 id="crypto-market-heading" className="crypto-heading">
              市值前 10 名
            </h2>
            <MarketTable coins={market.top} />
          </section>
        )}

        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={refresh} disabled={loading}>
            {loading ? '更新中…' : '重新整理'}
          </button>
          {assets.hasPassword && (
            <button type="button" className="btn btn-secondary" onClick={assets.lock}>
              鎖定
            </button>
          )}
        </div>
        <p className="field-hint">市場數據來自 CoinPaprika，每 2 分鐘自動更新；變動以過去 24 小時計算。</p>
      </div>
    </>
  )
}

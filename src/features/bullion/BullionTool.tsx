import ToolPageHeader from '../../components/ToolPageHeader'
import { findToolByPath } from '../../app/tools'
import { formatHkd } from '../assets/assetsClient'
import PasswordForm from '../assets/PasswordForm'
import { changeDirection, formatPercent, formatSignedHkd } from '../hk-stocks/hkStocks'
import { METAL_CODES, METAL_NAMES, formatUsd, hkdPerTael, type BullionRow, type MetalsData } from './bullion'
import { useBullion } from './useBullion'

const tool = findToolByPath('/tools/bullion')!

function MarketTable({ market }: { market: MetalsData }) {
  return (
    <div className="assets-table-wrap">
      <table className="assets-table">
        <thead>
          <tr>
            <th scope="col">金屬</th>
            <th scope="col" data-numeric="true">美元／盎司</th>
            <th scope="col" data-numeric="true">港元／両</th>
            <th scope="col" data-numeric="true">今日</th>
          </tr>
        </thead>
        <tbody>
          {METAL_CODES.map((code) => {
            const quote = market.metals[code]
            if (!quote) return null
            return (
              <tr key={code}>
                <td data-label="金屬">
                  {METAL_NAMES[code]} <span className="field-hint">{code}</span>
                </td>
                <td data-label="美元／盎司" data-numeric="true">
                  {formatUsd(quote.priceUsd)}
                </td>
                <td data-label="港元／両" data-numeric="true">
                  {formatHkd(hkdPerTael(quote, market.usdHkd))}
                </td>
                <td data-label="今日" data-numeric="true" data-change={changeDirection(quote.changePercent)}>
                  {formatPercent(quote.changePercent) || '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function HoldingsTable({ rows }: { rows: BullionRow[] }) {
  return (
    <div className="assets-table-wrap">
      <table className="assets-table">
        <thead>
          <tr>
            <th scope="col">金屬</th>
            <th scope="col" data-numeric="true">數量</th>
            <th scope="col" data-numeric="true">今日</th>
            <th scope="col" data-numeric="true">市值（港元）</th>
            <th scope="col" data-numeric="true">今日盈虧</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.metal ?? row.name}>
              <td data-label="金屬">{row.name}</td>
              <td data-label="數量" data-numeric="true">
                {row.quantityLabel}
              </td>
              <td data-label="今日" data-numeric="true" data-change={changeDirection(row.quote?.changePercent ?? null)}>
                {row.quote ? formatPercent(row.quote.changePercent) || '—' : '—'}
              </td>
              <td data-label="市值（港元）" data-numeric="true">
                {formatHkd(row.valueHkd)}
              </td>
              <td data-label="今日盈虧" data-numeric="true" data-change={changeDirection(row.dayGainHkd)}>
                {row.dayGainHkd === null ? '—' : formatSignedHkd(row.dayGainHkd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function BullionTool() {
  const { market, marketError, marketLoading, summary, assets, refresh } = useBullion()
  const loading = marketLoading || assets.loading
  const gold = market?.metals.XAU

  return (
    <>
      <ToolPageHeader title={tool.name} description={tool.shortDescription} />
      <div className="panel assets">
        <section className="hk-stocks-stats" aria-label="市場及持倉摘要">
          <div className="hk-stat">
            <p className="field-hint">現貨金價（美元／盎司）</p>
            {gold && market ? (
              <>
                <p className="hk-stat-value">{formatUsd(gold.priceUsd)}</p>
                <p className="hk-stat-change" data-change={changeDirection(gold.changePercent)}>
                  今日 {formatPercent(gold.changePercent)}
                </p>
                <p className="field-hint">約 {formatHkd(hkdPerTael(gold, market.usdHkd))}／両</p>
              </>
            ) : (
              <p className="hk-stat-change">{marketLoading ? '載入中…' : '—'}</p>
            )}
          </div>

          {summary && (
            <div className="hk-stat">
              <p className="field-hint">貴金屬持倉總值</p>
              <p className="hk-stat-value">{formatHkd(summary.totalHkd)}</p>
              <p className="hk-stat-change" data-change={changeDirection(summary.dayGainHkd)}>
                今日 {formatSignedHkd(summary.dayGainHkd)}
                {summary.dayGainPercent !== null && ` (${formatPercent(summary.dayGainPercent)})`}
              </p>
              <p className="field-hint" role="status">
                共 {summary.rows.length} 種貴金屬{!summary.complete && ' · 部分未能按現貨價計算'}
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
            id="bullion-password"
            submitLabel="顯示貴金屬持倉"
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
              <p className="status-message status-message--loading">未有貴金屬持倉。</p>
            )}
            {summary && summary.rows.length > 0 && (
              <section aria-labelledby="bullion-holdings-heading" className="crypto-section">
                <h2 id="bullion-holdings-heading" className="crypto-heading">
                  我的持倉
                </h2>
                <HoldingsTable rows={summary.rows} />
              </section>
            )}
          </>
        )}

        {market && (
          <section aria-labelledby="bullion-market-heading" className="crypto-section">
            <h2 id="bullion-market-heading" className="crypto-heading">
              現貨價格
            </h2>
            <MarketTable market={market} />
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
        <p className="field-hint">
          持倉按國際現貨價估算（1 両 = 37.429 克），未計銀行買賣差價；報價每分鐘自動更新。
        </p>
      </div>
    </>
  )
}

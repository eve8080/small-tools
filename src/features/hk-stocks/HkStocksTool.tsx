import ToolPageHeader from '../../components/ToolPageHeader'
import { findToolByPath } from '../../app/tools'
import { formatHkd } from '../assets/assetsClient'
import PasswordForm from '../assets/PasswordForm'
import {
  changeDirection,
  formatIndex,
  formatPercent,
  formatSigned,
  formatSignedHkd,
  type HoldingRow,
} from './hkStocks'
import { useHkStocks } from './useHkStocks'

const tool = findToolByPath('/tools/hk-stocks')!

const quantityFormat = new Intl.NumberFormat('zh-HK', { maximumFractionDigits: 4 })
const priceFormat = new Intl.NumberFormat('zh-HK', { minimumFractionDigits: 2, maximumFractionDigits: 3 })

function HoldingsTable({ rows }: { rows: HoldingRow[] }) {
  return (
    <div className="assets-table-wrap">
      <table className="assets-table">
        <thead>
          <tr>
            <th scope="col">名稱</th>
            <th scope="col">代號</th>
            <th scope="col" data-numeric="true">數量</th>
            <th scope="col" data-numeric="true">現價</th>
            <th scope="col" data-numeric="true">今日變動</th>
            <th scope="col" data-numeric="true">市值（港元）</th>
            <th scope="col" data-numeric="true">今日盈虧</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.code}-${index}`}>
              <td data-label="名稱">{row.name}</td>
              <td data-label="代號">{row.code}</td>
              <td data-label="數量" data-numeric="true">
                {row.quantity === null ? '—' : quantityFormat.format(row.quantity)}
              </td>
              <td data-label="現價" data-numeric="true">
                {row.quote ? priceFormat.format(row.quote.price) : '—'}
              </td>
              <td
                data-label="今日變動"
                data-numeric="true"
                data-change={changeDirection(row.quote?.change ?? null)}
              >
                {row.quote ? `${formatSigned(row.quote.change, 3)} (${formatPercent(row.quote.changePercent)})` : '—'}
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

export default function HkStocksTool() {
  const { hsi, quotesError, quotesLoading, summary, assets, refresh } = useHkStocks()
  const loading = quotesLoading || assets.loading

  return (
    <>
      <ToolPageHeader title={tool.name} description={tool.shortDescription} />
      <div className="panel assets hk-stocks">
        <section className="hk-stocks-stats" aria-label="市場及持倉摘要">
          <div className="hk-stat">
            <p className="field-hint">恒生指數</p>
            {hsi ? (
              <>
                <p className="hk-stat-value">{formatIndex(hsi.price)}</p>
                <p className="hk-stat-change" data-change={changeDirection(hsi.change)}>
                  {formatSigned(hsi.change)} ({formatPercent(hsi.changePercent)})
                </p>
                {hsi.time && <p className="field-hint">更新於 {hsi.time}</p>}
              </>
            ) : (
              <p className="hk-stat-change">{quotesLoading ? '載入中…' : '—'}</p>
            )}
          </div>

          {summary && (
            <div className="hk-stat">
              <p className="field-hint">港股持倉總值</p>
              <p className="hk-stat-value">{formatHkd(summary.totalHkd)}</p>
              <p className="hk-stat-change" data-change={changeDirection(summary.dayGainHkd)}>
                今日 {formatSignedHkd(summary.dayGainHkd)}
                {summary.dayGainPercent !== null && ` (${formatPercent(summary.dayGainPercent)})`}
              </p>
              <p className="field-hint" role="status">
                共 {summary.rows.length} 隻港股{!summary.complete && ' · 部分未有即時報價'}
              </p>
            </div>
          )}
        </section>

        {quotesError && (
          <p className="status-message status-message--error" role="alert">
            {quotesError}
          </p>
        )}

        {!assets.hasPassword ? (
          <PasswordForm
            id="hk-stocks-password"
            submitLabel="顯示港股持倉"
            onUnlock={assets.unlock}
            error={assets.result && !assets.result.ok ? assets.result.error : undefined}
          />
        ) : (
          <>
            {assets.loading && !summary && (
              <p className="status-message status-message--loading">載入持倉中…</p>
            )}
            {assets.result && !assets.result.ok && (
              <p className="status-message status-message--error" role="alert">
                {assets.result.error}
              </p>
            )}
            {summary && summary.rows.length === 0 && (
              <p className="status-message status-message--loading">未有港股持倉。</p>
            )}
            {summary && summary.rows.length > 0 && <HoldingsTable rows={summary.rows} />}
          </>
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
        <p className="field-hint">報價每分鐘自動更新，可能有延遲。</p>
      </div>
    </>
  )
}

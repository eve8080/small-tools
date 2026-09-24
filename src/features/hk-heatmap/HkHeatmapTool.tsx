import { useState } from 'react'
import ToolPageHeader from '../../components/ToolPageHeader'
import { findToolByPath } from '../../app/tools'
import { formatTurnover, heatColor } from '../hk-market/hkMarket'
import { useHkMarket } from '../hk-market/useHkMarket'
import { changeDirection, formatPercent, formatSigned } from '../hk-stocks/hkStocks'
import HeatTreemap, { type SizeBy } from './HeatTreemap'

const tool = findToolByPath('/tools/hk-heatmap')!

const SIZE_OPTIONS: { value: SizeBy; label: string }[] = [
  { value: 'marketCap', label: '按市值' },
  { value: 'turnover', label: '按成交額' },
]

const LEGEND = [-3, -2, -1, 0, 1, 2, 3]

const priceFormat = new Intl.NumberFormat('zh-HK', { minimumFractionDigits: 2, maximumFractionDigits: 3 })

export default function HkHeatmapTool() {
  const { quotes, snapshot, error, loading, refresh } = useHkMarket()
  const [sizeBy, setSizeBy] = useState<SizeBy>('marketCap')
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const selected = snapshot?.stocks.find((stock) => stock.code === selectedCode) ?? null
  const updated = quotes?.HSI?.time

  return (
    <>
      <ToolPageHeader title={tool.name} description={tool.shortDescription} />
      <div className="panel assets heatmap-page">
        <div className="heatmap-toolbar">
          <div className="pomodoro-mode-tabs" role="group" aria-label="方塊大小">
            {SIZE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className="btn pomodoro-mode-tab"
                data-active={sizeBy === option.value}
                aria-pressed={sizeBy === option.value}
                onClick={() => setSizeBy(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="heatmap-legend" aria-label="顏色：綠升紅跌">
            {LEGEND.map((value) => (
              <span key={value} style={{ background: heatColor(value, 65) }}>
                {value > 0 ? `+${value}` : value}%
              </span>
            ))}
          </div>
        </div>

        {error && (
          <p className="status-message status-message--error" role="alert">
            {error}
          </p>
        )}
        {!snapshot && loading && <p className="status-message status-message--loading">載入熱圖中…</p>}

        {snapshot && snapshot.stocks.length > 0 && (
          <HeatTreemap
            stocks={snapshot.stocks}
            sizeBy={sizeBy}
            selected={selectedCode}
            onSelect={(code) => setSelectedCode((current) => (current === code ? null : code))}
          />
        )}

        <div className="heatmap-detail" aria-live="polite">
          {selected ? (
            <>
              <div>
                <p className="heatmap-detail-name">
                  {selected.name} <span className="field-hint">{selected.code} · {selected.sector}</span>
                </p>
                <p className="hk-stat-change" data-change={changeDirection(selected.changePercent)}>
                  {priceFormat.format(selected.quote.price)} {formatSigned(selected.quote.change, 3)} (
                  {formatPercent(selected.changePercent)})
                </p>
              </div>
              <dl className="heatmap-detail-stats">
                <div>
                  <dt>市值</dt>
                  <dd>{selected.quote.marketCap ? formatTurnover(selected.quote.marketCap) : '—'}</dd>
                </div>
                <div>
                  <dt>成交額</dt>
                  <dd>{formatTurnover(selected.turnover)}</dd>
                </div>
                <div>
                  <dt>今日波幅</dt>
                  <dd>
                    {selected.quote.low != null && selected.quote.high != null
                      ? `${priceFormat.format(selected.quote.low)} – ${priceFormat.format(selected.quote.high)}`
                      : '—'}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="field-hint">點選方塊查看股份詳情。</p>
          )}
        </div>

        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={refresh} disabled={loading}>
            {loading ? '更新中…' : '重新整理'}
          </button>
        </div>
        <p className="field-hint">
          {updated && `更新於 ${updated} · `}
          {snapshot?.stocks.length ?? 84} 隻主要藍籌，按板塊分組；方塊面積按{sizeBy === 'marketCap' ? '港股市值' : '成交額'}
          ，顏色按今日升跌（綠升紅跌）。報價每分鐘自動更新。
        </p>
      </div>
    </>
  )
}

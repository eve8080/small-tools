import ToolPageHeader from '../../components/ToolPageHeader'
import { findToolByPath } from '../../app/tools'
import { changeDirection, formatIndex, formatPercent, formatSigned, type Quote } from '../hk-stocks/hkStocks'
import { INDICES, formatTurnover, heatColor, rangePosition, type MarketSnapshot, type SectorMove, type StockMove } from './hkMarket'
import { useHkMarket } from './useHkMarket'

const tool = findToolByPath('/tools/hk-market')!

function IndexTile({ name, quote }: { name: string; quote: Quote }) {
  const position = rangePosition(quote.price, quote.low, quote.high)
  const previous = rangePosition(quote.previousClose, quote.low, quote.high)
  return (
    <div className="hk-stat market-index">
      <p className="field-hint">{name}</p>
      <p className="market-index-value">{formatIndex(quote.price)}</p>
      <p className="hk-stat-change" data-change={changeDirection(quote.change)}>
        {formatSigned(quote.change)} ({formatPercent(quote.changePercent)})
      </p>
      {position !== null && (
        <div className="market-range" aria-label={`今日波幅 ${formatIndex(quote.low!)} 至 ${formatIndex(quote.high!)}`}>
          <div className="market-range-track">
            {previous !== null && <span className="market-range-prev" style={{ left: `${previous * 100}%` }} title="昨收" />}
            <span
              className="market-range-dot"
              data-change={changeDirection(quote.change)}
              style={{ left: `${position * 100}%` }}
            />
          </div>
          <div className="market-range-labels">
            <span>低 {formatIndex(quote.low!)}</span>
            <span>高 {formatIndex(quote.high!)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export function BreadthBar({ breadth }: { breadth: MarketSnapshot['breadth'] }) {
  const total = breadth.up + breadth.down + breadth.flat || 1
  return (
    <div className="market-breadth">
      <div className="market-breadth-bar" role="img" aria-label={`上升 ${breadth.up} 隻，下跌 ${breadth.down} 隻，不變 ${breadth.flat} 隻`}>
        <span data-change="up" style={{ width: `${(breadth.up / total) * 100}%` }} />
        <span data-change="flat" style={{ width: `${(breadth.flat / total) * 100}%` }} />
        <span data-change="down" style={{ width: `${(breadth.down / total) * 100}%` }} />
      </div>
      <div className="market-breadth-labels">
        <span data-change="up">▲ 升 {breadth.up}</span>
        <span>平 {breadth.flat}</span>
        <span data-change="down">▼ 跌 {breadth.down}</span>
      </div>
    </div>
  )
}

function SectorChart({ sectors }: { sectors: SectorMove[] }) {
  const scale = Math.max(1, ...sectors.map((sector) => Math.abs(sector.changePercent)))
  return (
    <ul className="market-sectors">
      {sectors.map((sector) => {
        const width = (Math.abs(sector.changePercent) / scale) * 50
        return (
          <li key={sector.sector} className="market-sector">
            <span className="market-sector-name">{sector.sector}</span>
            <span className="market-diverging">
              <span
                className="market-diverging-bar"
                data-change={changeDirection(sector.changePercent)}
                style={
                  sector.changePercent >= 0
                    ? { left: '50%', width: `${width}%` }
                    : { left: `${50 - width}%`, width: `${width}%` }
                }
              />
            </span>
            <span className="market-sector-value" data-change={changeDirection(sector.changePercent)}>
              {formatPercent(sector.changePercent)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function HeatMap({ sectors }: { sectors: SectorMove[] }) {
  return (
    <div className="market-heatmap">
      {sectors.map((sector) => (
        <div key={sector.sector} className="market-heat-group">
          <p className="market-heat-title">{sector.sector}</p>
          <div className="market-heat-tiles">
            {sector.stocks.map((stock) => (
              <span
                key={stock.code}
                className="market-heat-tile"
                style={{ background: heatColor(stock.changePercent) }}
                title={`${stock.name} ${stock.code} · ${formatTurnover(stock.turnover)}`}
              >
                <span className="market-heat-name">{stock.name}</span>
                <span className="market-heat-change">{formatPercent(stock.changePercent)}</span>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function MoverList({ title, stocks, value }: { title: string; stocks: StockMove[]; value: 'change' | 'turnover' }) {
  const max = Math.max(
    ...stocks.map((stock) => (value === 'change' ? Math.abs(stock.changePercent) : stock.turnover)),
    Number.EPSILON,
  )
  return (
    <section className="market-movers" aria-label={title}>
      <h2 className="crypto-heading">{title}</h2>
      {stocks.length === 0 ? (
        <p className="field-hint">—</p>
      ) : (
        <ol>
          {stocks.map((stock) => {
            const amount = value === 'change' ? Math.abs(stock.changePercent) : stock.turnover
            return (
              <li key={stock.code} className="market-mover">
                <span className="market-mover-label">
                  <span>{stock.name}</span>
                  <span data-change={value === 'change' ? changeDirection(stock.changePercent) : undefined}>
                    {value === 'change' ? formatPercent(stock.changePercent) : formatTurnover(stock.turnover)}
                  </span>
                </span>
                <span className="market-mover-track">
                  <span
                    className="market-mover-bar"
                    data-change={value === 'change' ? changeDirection(stock.changePercent) : 'flat'}
                    style={{ width: `${(amount / max) * 100}%` }}
                  />
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

export default function HkMarketTool() {
  const { quotes, snapshot, error, loading, refresh } = useHkMarket()
  const updated = quotes?.HSI?.time

  return (
    <>
      <ToolPageHeader title={tool.name} description={tool.shortDescription} />
      <div className="panel assets market">
        {error && (
          <p className="status-message status-message--error" role="alert">
            {error}
          </p>
        )}
        {!quotes && loading && <p className="status-message status-message--loading">載入市況中…</p>}

        {quotes && (
          <section className="market-indices" aria-label="主要指數">
            {INDICES.map((index) =>
              quotes[index.code] ? <IndexTile key={index.code} name={index.name} quote={quotes[index.code]} /> : null,
            )}
          </section>
        )}

        {snapshot && snapshot.stocks.length > 0 && (
          <>
            <section className="market-card" aria-labelledby="market-breadth-heading">
              <div className="market-card-head">
                <h2 id="market-breadth-heading" className="crypto-heading">
                  藍籌升跌分佈
                </h2>
                <span className="field-hint">成交額 {formatTurnover(snapshot.turnover)}</span>
              </div>
              <BreadthBar breadth={snapshot.breadth} />
            </section>

            <section className="market-card" aria-labelledby="market-sector-heading">
              <h2 id="market-sector-heading" className="crypto-heading">
                板塊表現
              </h2>
              <SectorChart sectors={snapshot.sectors} />
            </section>

            <section className="market-card" aria-labelledby="market-heat-heading">
              <h2 id="market-heat-heading" className="crypto-heading">
                藍籌熱圖
              </h2>
              <HeatMap sectors={snapshot.sectors} />
            </section>

            <div className="market-columns">
              <MoverList title="領漲" stocks={snapshot.gainers} value="change" />
              <MoverList title="領跌" stocks={snapshot.losers} value="change" />
              <MoverList title="成交最活躍" stocks={snapshot.mostActive} value="turnover" />
            </div>
          </>
        )}

        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={refresh} disabled={loading}>
            {loading ? '更新中…' : '重新整理'}
          </button>
        </div>
        <p className="field-hint">
          {updated && `更新於 ${updated} · `}
          升跌、板塊及熱圖以 {snapshot?.stocks.length ?? 84} 隻主要藍籌計算，板塊變動按成交額加權；報價每分鐘自動更新，可能有延遲。
        </p>
      </div>
    </>
  )
}

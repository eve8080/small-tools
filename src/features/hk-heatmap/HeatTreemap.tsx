import { useLayoutEffect, useRef, useState } from 'react'
import { SECTORS } from '../hk-market/blueChips'
import { heatColor, type StockMove } from '../hk-market/hkMarket'
import { formatPercent } from '../hk-stocks/hkStocks'
import { squarify, type Rect } from './treemap'

export type SizeBy = 'marketCap' | 'turnover'

const SECTOR_HEADER = 18
const GAP = 1
// Keep tiles readable with dark text in both themes.
const MAX_STRENGTH = 65

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    setWidth(element.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

interface HeatTreemapProps {
  stocks: StockMove[]
  sizeBy?: SizeBy
  /** Fixed height in px; by default the height follows the width (wider maps are flatter). */
  height?: number
  labels?: boolean
  selected?: string | null
  onSelect?: (code: string) => void
}

export default function HeatTreemap({
  stocks,
  sizeBy = 'marketCap',
  height,
  labels = true,
  selected = null,
  onSelect,
}: HeatTreemapProps) {
  const [ref, measured] = useElementWidth<HTMLDivElement>()
  // jsdom has no layout; fall back to a nominal width so the map still renders in tests.
  const width = measured || 800
  const mapHeight = height ?? Math.round(width >= 700 ? width * 0.6 : width * 1.5)

  const sizeOf = (stock: StockMove) => (sizeBy === 'marketCap' ? (stock.quote.marketCap ?? 0) : stock.turnover)
  const sectors = SECTORS.map((sector) => {
    const members = stocks.filter((stock) => stock.sector === sector && sizeOf(stock) > 0)
    return { sector, members, value: members.reduce((sum, stock) => sum + sizeOf(stock), 0) }
  })

  const sectorRects = squarify(sectors, { x: 0, y: 0, width, height: mapHeight })

  return (
    <div
      ref={ref}
      className="treemap"
      style={{ height: mapHeight }}
      role={onSelect ? 'group' : 'img'}
      aria-label="港股熱圖"
    >
      {sectorRects.map((sector) => {
        const showHeader = labels && sector.width >= 70 && sector.height >= 60
        const inner: Rect = {
          x: sector.x + GAP,
          y: sector.y + GAP + (showHeader ? SECTOR_HEADER : 0),
          width: sector.width - GAP * 2,
          height: sector.height - GAP * 2 - (showHeader ? SECTOR_HEADER : 0),
        }
        const tiles = squarify(
          sector.members.map((stock) => ({ stock, value: sizeOf(stock) })),
          inner,
        )
        return (
          <div key={sector.sector}>
            {showHeader && (
              <span
                className="treemap-sector"
                style={{ left: sector.x + GAP, top: sector.y + GAP, width: sector.width - GAP * 2 }}
              >
                {sector.sector}
              </span>
            )}
            {tiles.map(({ stock, x, y, width: w, height: h }) => {
              const big = labels && w >= 64 && h >= 34
              const small = labels && !big && w >= 38 && h >= 18
              const fontSize = Math.max(10, Math.min(18, Math.sqrt(w * h) / 7))
              // Plain spans when not selectable: the home card puts the map inside a link.
              const Tile = onSelect ? 'button' : 'span'
              return (
                <Tile
                  key={stock.code}
                  type={onSelect ? 'button' : undefined}
                  className="treemap-tile"
                  data-selected={selected === stock.code}
                  style={{
                    left: x + GAP / 2,
                    top: y + GAP / 2,
                    width: Math.max(0, w - GAP),
                    height: Math.max(0, h - GAP),
                    background: heatColor(stock.changePercent, MAX_STRENGTH),
                    fontSize,
                  }}
                  title={`${stock.name} ${stock.code} ${formatPercent(stock.changePercent)}`}
                  aria-label={onSelect ? `${stock.name} ${formatPercent(stock.changePercent)}` : undefined}
                  onClick={onSelect ? () => onSelect(stock.code) : undefined}
                >
                  {big && <span className="treemap-name">{stock.name}</span>}
                  {(big || small) && <span className="treemap-change">{formatPercent(stock.changePercent)}</span>}
                </Tile>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

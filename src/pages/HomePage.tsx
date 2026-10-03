import { useEffect, useId, useRef, useState } from 'react'
import type { ComponentType, DragEvent, MouseEvent } from 'react'
import ToolCard from '../components/ToolCard'
import { tools } from '../app/tools'
import type { ToolDefinition } from '../app/tools'
import { defaultWidgetPrefs, loadWidgetPrefs, saveWidgetPrefs } from './homeWidgetPrefs'
import type { WidgetPrefs } from './homeWidgetPrefs'
import HkWeatherCardPreview from '../features/hk-weather/HkWeatherCardPreview'
import AssetsCardPreview from '../features/assets/AssetsCardPreview'
import HkStocksCardPreview from '../features/hk-stocks/HkStocksCardPreview'
import HkMarketCardPreview from '../features/hk-market/HkMarketCardPreview'
import HkHeatmapCardPreview from '../features/hk-heatmap/HkHeatmapCardPreview'
import CryptoCardPreview from '../features/crypto/CryptoCardPreview'
import BullionCardPreview from '../features/bullion/BullionCardPreview'

const cardPreviews: Record<string, ComponentType> = {
  'hk-weather': HkWeatherCardPreview,
  assets: AssetsCardPreview,
  'hk-stocks': HkStocksCardPreview,
  'hk-market': HkMarketCardPreview,
  'hk-heatmap': HkHeatmapCardPreview,
  crypto: CryptoCardPreview,
  bullion: BullionCardPreview,
}

const toolIds = tools.map((tool) => tool.id)
const toolsById = new Map(tools.map((tool) => [tool.id, tool]))

type MoveDirection = 'up' | 'down'

/** How long card clicks stay blocked after a drag, covering a click some browsers fire on release. */
const DRAG_CLICK_GUARD_MS = 300

function moveTo(order: string[], id: string, index: number): string[] {
  const next = order.filter((candidate) => candidate !== id)
  next.splice(index, 0, id)
  return next
}

function orderedTools(order: string[]): ToolDefinition[] {
  return order.flatMap((id) => {
    const tool = toolsById.get(id)
    return tool ? [tool] : []
  })
}

export default function HomePage() {
  const [prefs, setPrefs] = useState<WidgetPrefs>(() => loadWidgetPrefs(toolIds))
  const [customizing, setCustomizing] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const draggingRef = useRef<string | null>(null)
  const clickGuardTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const focusPanelOnOpen = useRef(false)
  const pendingMoveFocus = useRef<{ id: string; direction: MoveDirection } | null>(null)
  const panelId = useId()

  const hidden = new Set(prefs.hidden)
  const allTools = orderedTools(prefs.order)
  const visibleTools = allTools.filter((tool) => !hidden.has(tool.id))

  // Dropping a dragged link outside a card would make the browser navigate to it.
  useEffect(() => {
    if (!customizing) return
    const preventLinkDrop = (event: globalThis.DragEvent) => {
      if (draggingRef.current) event.preventDefault()
    }
    document.addEventListener('dragover', preventLinkDrop)
    document.addEventListener('drop', preventLinkDrop)
    return () => {
      document.removeEventListener('dragover', preventLinkDrop)
      document.removeEventListener('drop', preventLinkDrop)
    }
  }, [customizing])

  useEffect(() => clearClickGuard, [])

  useEffect(() => {
    if (customizing && focusPanelOnOpen.current) {
      focusPanelOnOpen.current = false
      panelRef.current?.focus()
    }
  }, [customizing])

  // Keep keyboard focus on the moved tool's buttons, even when one becomes disabled at an end.
  useEffect(() => {
    const pending = pendingMoveFocus.current
    if (!pending || !panelRef.current) return
    pendingMoveFocus.current = null
    const buttonFor = (direction: MoveDirection) =>
      panelRef.current?.querySelector<HTMLButtonElement>(
        `[data-tool-id="${pending.id}"][data-move="${direction}"]`,
      )
    const preferred = buttonFor(pending.direction)
    const fallback = buttonFor(pending.direction === 'up' ? 'down' : 'up')
    ;(preferred && !preferred.disabled ? preferred : fallback)?.focus()
  }, [prefs])

  function updatePrefs(next: WidgetPrefs, message: string) {
    setPrefs(next)
    saveWidgetPrefs(next)
    setAnnouncement(message)
  }

  function moveTool(tool: ToolDefinition, index: number) {
    const order = moveTo(prefs.order, tool.id, index)
    updatePrefs({ ...prefs, order }, `已將「${tool.name}」移到第 ${order.indexOf(tool.id) + 1} 位`)
  }

  function moveByButton(tool: ToolDefinition, direction: MoveDirection) {
    pendingMoveFocus.current = { id: tool.id, direction }
    moveTool(tool, prefs.order.indexOf(tool.id) + (direction === 'up' ? -1 : 1))
  }

  function toggleVisible(tool: ToolDefinition) {
    if (hidden.has(tool.id)) {
      updatePrefs({ ...prefs, hidden: prefs.hidden.filter((id) => id !== tool.id) }, `已顯示「${tool.name}」`)
    } else {
      updatePrefs({ ...prefs, hidden: [...prefs.hidden, tool.id] }, `已隱藏「${tool.name}」`)
    }
  }

  function openCustomize(focusPanel: boolean) {
    focusPanelOnOpen.current = focusPanel
    setCustomizing(true)
  }

  function closeCustomize() {
    clearClickGuard()
    resetDrag()
    setCustomizing(false)
    toggleRef.current?.focus()
  }

  function clearClickGuard() {
    if (clickGuardTimer.current) clearTimeout(clickGuardTimer.current)
    clickGuardTimer.current = null
  }

  function resetDrag() {
    draggingRef.current = null
    setDraggingId(null)
    setDropTargetId(null)
  }

  function endDrag() {
    if (draggingRef.current) {
      clearClickGuard()
      clickGuardTimer.current = setTimeout(() => {
        clickGuardTimer.current = null
      }, DRAG_CLICK_GUARD_MS)
    }
    resetDrag()
  }

  function handleDragStart(event: DragEvent, tool: ToolDefinition) {
    if (!customizing) return
    draggingRef.current = tool.id
    setDraggingId(tool.id)
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(event: DragEvent, tool: ToolDefinition) {
    if (!draggingRef.current) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    setDropTargetId(tool.id)
  }

  function handleDrop(event: DragEvent, tool: ToolDefinition) {
    const draggedTool = draggingRef.current && toolsById.get(draggingRef.current)
    if (!draggedTool) return
    event.preventDefault()
    if (draggedTool.id !== tool.id) moveTool(draggedTool, prefs.order.indexOf(tool.id))
    endDrag()
  }

  function handleCardClick(event: MouseEvent) {
    if (customizing && (draggingRef.current || clickGuardTimer.current)) event.preventDefault()
  }

  return (
    <div className="home">
      <section className="hero hero--compact">
        <h1>Small Tools 工具箱</h1>
        <p>日常好用的網頁小工具,一鍵開啟即用,持續加入更多工具。</p>
        <button
          ref={toggleRef}
          type="button"
          className="btn btn-secondary home-customize-toggle"
          aria-expanded={customizing}
          aria-controls={customizing ? panelId : undefined}
          onClick={() => (customizing ? closeCustomize() : openCustomize(false))}
        >
          <span aria-hidden="true">⚙️</span>
          自訂工具
        </button>
      </section>

      {customizing && (
        <section
          ref={panelRef}
          id={panelId}
          tabIndex={-1}
          className="widget-panel"
          aria-labelledby={`${panelId}-title`}
        >
          <h2 id={`${panelId}-title`}>自訂首頁工具</h2>
          <p className="widget-panel-hint">
            勾選要顯示的工具，用箭咀按鈕或直接拖曳下方卡片調整次序。設定即時生效，只儲存在此瀏覽器。
          </p>
          <ol className="widget-list">
            {allTools.map((tool, index) => (
              <li key={tool.id} className="widget-row">
                <label className="widget-row-label">
                  <input
                    type="checkbox"
                    className="widget-row-checkbox"
                    aria-label={`顯示 ${tool.name}`}
                    checked={!hidden.has(tool.id)}
                    onChange={() => toggleVisible(tool)}
                  />
                  <span aria-hidden="true">{tool.icon}</span>
                  <span>{tool.name}</span>
                </label>
                <span className="widget-row-moves">
                  <button
                    type="button"
                    className="widget-move-btn"
                    aria-label={`上移 ${tool.name}`}
                    data-tool-id={tool.id}
                    data-move="up"
                    disabled={index === 0}
                    onClick={() => moveByButton(tool, 'up')}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="widget-move-btn"
                    aria-label={`下移 ${tool.name}`}
                    data-tool-id={tool.id}
                    data-move="down"
                    disabled={index === allTools.length - 1}
                    onClick={() => moveByButton(tool, 'down')}
                  >
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ol>
          <div className="btn-row widget-panel-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => updatePrefs(defaultWidgetPrefs(toolIds), '已重設為預設排列')}
            >
              重設預設
            </button>
            <button type="button" className="btn btn-primary" onClick={closeCustomize}>
              完成
            </button>
          </div>
        </section>
      )}

      <p className="visually-hidden" role="status">
        {announcement}
      </p>

      <section
        aria-label="工具列表"
        className={customizing ? 'tool-grid tool-grid--customizing' : 'tool-grid'}
      >
        {visibleTools.map((tool) => {
          const Preview = cardPreviews[tool.id]
          const classNames = ['tool-grid-item']
          if (tool.id === draggingId) classNames.push('tool-grid-item--dragging')
          if (tool.id === dropTargetId && tool.id !== draggingId) classNames.push('tool-grid-item--drop-target')
          return (
            <div
              key={tool.id}
              className={classNames.join(' ')}
              onDragStart={(event) => handleDragStart(event, tool)}
              onDragOver={(event) => handleDragOver(event, tool)}
              onDrop={(event) => handleDrop(event, tool)}
              onDragEnd={endDrag}
              onClickCapture={handleCardClick}
            >
              <ToolCard tool={tool} preview={Preview && <Preview />} />
            </div>
          )
        })}
      </section>

      {visibleTools.length === 0 && (
        <div className="home-empty">
          <p>所有工具都已隱藏。</p>
          {!customizing && (
            <button type="button" className="btn btn-primary" onClick={() => openCustomize(true)}>
              選擇要顯示的工具
            </button>
          )}
        </div>
      )}
    </div>
  )
}

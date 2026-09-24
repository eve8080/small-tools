import { useEffect, useState } from 'react'

type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitFullscreenEnabled?: boolean
  webkitExitFullscreen?: () => Promise<void> | void
}

type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

function getFullscreenElement(): Element | null {
  const doc = document as WebkitDocument
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null
}

function isFullscreenSupported(): boolean {
  const doc = document as WebkitDocument
  return Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled)
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true
}

export default function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(() => getFullscreenElement() !== null)
  const [available] = useState(() => isFullscreenSupported() && !isStandalone())

  useEffect(() => {
    const onChange = () => setIsFullscreen(getFullscreenElement() !== null)
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])

  if (!available) return null

  const toggle = async () => {
    const doc = document as WebkitDocument
    const root = document.documentElement as WebkitElement
    try {
      if (getFullscreenElement()) {
        await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.())
      } else {
        await (root.requestFullscreen?.() ?? root.webkitRequestFullscreen?.())
      }
    } catch {
      // Ignore: the browser refused (e.g. not triggered by a user gesture).
    }
  }

  return (
    <button
      type="button"
      className="btn btn-secondary fullscreen-btn"
      onClick={toggle}
      aria-pressed={isFullscreen}
    >
      <span aria-hidden="true">{isFullscreen ? '⤡' : '⤢'}</span>
      <span>{isFullscreen ? '退出全螢幕' : '全螢幕'}</span>
    </button>
  )
}

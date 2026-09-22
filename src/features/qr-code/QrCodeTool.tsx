import { useEffect, useState } from 'react'
import ToolPageHeader from '../../components/ToolPageHeader'
import { findToolByPath } from '../../app/tools'
import { generateQrDataUrl } from './qrCode'

const tool = findToolByPath('/tools/qr-code')!

interface Result {
  text: string
  dataUrl: string
}

interface ErrorResult {
  text: string
  message: string
}

export default function QrCodeTool() {
  const [text, setText] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<ErrorResult | null>(null)
  const trimmed = text.trim()

  useEffect(() => {
    if (!trimmed) return

    let cancelled = false

    generateQrDataUrl(trimmed)
      .then((dataUrl) => {
        if (cancelled) return
        setResult({ text: trimmed, dataUrl })
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setResult(null)
        setError({
          text: trimmed,
          message: err instanceof Error ? err.message : '產生 QR Code 失敗,請稍後再試。',
        })
      })

    return () => {
      cancelled = true
    }
  }, [trimmed])

  const isLoading = trimmed !== '' && result?.text !== trimmed && error?.text !== trimmed
  const activeResult = result?.text === trimmed ? result : null
  const activeError = error?.text === trimmed ? error : null

  function handleDownload() {
    if (!activeResult) return
    const link = document.createElement('a')
    link.href = activeResult.dataUrl
    link.download = 'qrcode.png'
    link.click()
  }

  return (
    <>
      <ToolPageHeader title={tool.name} description={tool.shortDescription} />
      <div className="panel">
        <div className="field">
          <label htmlFor="qr-text" className="field-label">
            文字或網址
          </label>
          <input
            id="qr-text"
            name="qr-text"
            type="text"
            className="field-input"
            placeholder="輸入文字或網址,即時產生 QR Code"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <p className="field-hint">輸入內容後會自動即時產生。</p>
        </div>

        {activeError && (
          <p className="status-message status-message--error" role="alert">
            {activeError.message}
          </p>
        )}

        <div className="qr-preview">
          {!trimmed && <p className="qr-placeholder">請輸入文字或網址以產生 QR Code</p>}
          {trimmed && isLoading && <p className="qr-placeholder">產生中…</p>}
          {activeResult && <img src={activeResult.dataUrl} alt="產生的 QR Code" />}
        </div>

        {activeResult && (
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={handleDownload}>
              下載 PNG
            </button>
          </div>
        )}
      </div>
    </>
  )
}

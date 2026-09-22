import { useState, type FormEvent } from 'react'
import ToolPageHeader from '../../components/ToolPageHeader'
import { findToolByPath } from '../../app/tools'
import { isValidHttpUrl, shortenUrl } from './urlShortener'

type Status = 'idle' | 'loading' | 'success' | 'error'

const VALIDATION_MESSAGE = '請輸入有效的網址,並以 http:// 或 https:// 開頭。'
const tool = findToolByPath('/tools/url-shortener')!

export default function UrlShortenerTool() {
  const [longUrl, setLongUrl] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [shortUrl, setShortUrl] = useState('')
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCopied(false)
    setCopyError('')

    const trimmedUrl = longUrl.trim()

    if (!isValidHttpUrl(trimmedUrl)) {
      setStatus('error')
      setMessage(VALIDATION_MESSAGE)
      return
    }

    setStatus('loading')
    setMessage('')

    const result = await shortenUrl(trimmedUrl)
    if (result.ok) {
      setShortUrl(result.shortUrl)
      setStatus('success')
    } else {
      setMessage(result.error)
      setStatus('error')
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shortUrl)
      setCopied(true)
      setCopyError('')
    } catch {
      setCopied(false)
      setCopyError('複製失敗,請手動選取連結複製。')
    }
  }

  return (
    <>
      <ToolPageHeader title={tool.name} description={tool.shortDescription} />
      <div className="panel">
        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="long-url" className="field-label">
              長網址
            </label>
            <input
              id="long-url"
              name="long-url"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="https://example.com/very/long/path"
              className="field-input"
              value={longUrl}
              onChange={(event) => setLongUrl(event.target.value)}
            />
            <p className="field-hint">支援 http:// 或 https:// 開頭的網址。</p>
          </div>
          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={status === 'loading'}>
              {status === 'loading' ? '縮短中…' : '縮短網址'}
            </button>
          </div>
        </form>

        {status === 'error' && (
          <p className="status-message status-message--error" role="alert">
            {message}
          </p>
        )}

        {status === 'success' && (
          <div className="result-row">
            <a href={shortUrl} target="_blank" rel="noreferrer" className="result-link">
              {shortUrl}
            </a>
            <button type="button" className="btn btn-secondary" onClick={handleCopy}>
              {copied ? '已複製 ✓' : '複製連結'}
            </button>
          </div>
        )}

        {copyError && (
          <p className="status-message status-message--error" role="alert">
            {copyError}
          </p>
        )}
      </div>
    </>
  )
}

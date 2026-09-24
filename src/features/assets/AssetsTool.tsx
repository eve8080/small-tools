import { useState, type FormEvent } from 'react'
import ToolPageHeader from '../../components/ToolPageHeader'
import { findToolByPath } from '../../app/tools'
import { formatHkd, totalValueHkd, type AssetPosition } from './assetsClient'
import { useAssets } from './useAssets'

const tool = findToolByPath('/tools/assets')!

const numberFormat = new Intl.NumberFormat('zh-HK', { maximumFractionDigits: 4 })

const COLUMNS: { key: keyof AssetPosition; label: string; numeric?: boolean }[] = [
  { key: 'name', label: '名稱' },
  { key: 'symbol', label: '代號' },
  { key: 'asset_class', label: '類別' },
  { key: 'account', label: '帳戶' },
  { key: 'quantity', label: '數量', numeric: true },
  { key: 'current_price', label: '現價', numeric: true },
  { key: 'currency_code', label: '貨幣' },
  { key: 'market_value_hkd', label: '市值（港元）', numeric: true },
  { key: 'price_date', label: '價格日期' },
]

function formatCell(position: AssetPosition, key: keyof AssetPosition): string {
  const value = position[key]
  if (value === null || value === undefined || value === '') return '—'
  if (key === 'market_value_hkd' && typeof value === 'number') return formatHkd(value)
  if (typeof value === 'number') return numberFormat.format(value)
  return String(value)
}

function PasswordForm({ onUnlock, error }: { onUnlock: (password: string) => void; error?: string }) {
  const [password, setPassword] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password) onUnlock(password)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="assets-password" className="field-label">
          密碼
        </label>
        <input
          id="assets-password"
          type="password"
          autoComplete="current-password"
          className="field-input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p className="field-hint">密碼只會儲存在此裝置的瀏覽器中。</p>
      </div>
      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={!password}>
          顯示資產
        </button>
      </div>
      {error && (
        <p className="status-message status-message--error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

export default function AssetsTool() {
  const { hasPassword, loading, result, unlock, lock, refresh } = useAssets()
  const positions = result?.ok ? result.positions : null

  return (
    <>
      <ToolPageHeader title={tool.name} description={tool.shortDescription} />
      <div className="panel assets">
        {!hasPassword ? (
          <PasswordForm onUnlock={unlock} error={result && !result.ok ? result.error : undefined} />
        ) : (
          <>
            {positions && (
              <div className="assets-summary">
                <p className="field-hint">總資產（港元）</p>
                <p className="assets-total">{formatHkd(totalValueHkd(positions))}</p>
                <p className="field-hint" role="status">
                  共 {positions.length} 項持倉
                </p>
              </div>
            )}

            {loading && !positions && <p className="status-message status-message--loading">載入資產中…</p>}

            {result && !result.ok && (
              <p className="status-message status-message--error" role="alert">
                {result.error}
              </p>
            )}

            {positions && positions.length > 0 && (
              <div className="assets-table-wrap">
                <table className="assets-table">
                  <thead>
                    <tr>
                      {COLUMNS.map((column) => (
                        <th key={column.key} scope="col" data-numeric={column.numeric}>
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((position, index) => (
                      <tr key={`${position.account}-${position.symbol}-${position.name}-${index}`}>
                        {COLUMNS.map((column) => (
                          <td key={column.key} data-label={column.label} data-numeric={column.numeric}>
                            {formatCell(position, column.key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="btn-row">
              <button type="button" className="btn btn-primary" onClick={refresh} disabled={loading}>
                {loading ? '更新中…' : '重新整理'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={lock}>
                鎖定
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

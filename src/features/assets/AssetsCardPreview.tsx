import { formatHkd, latestPriceDate, totalValueHkd } from './assetsClient'
import { useAssets } from './useAssets'

export default function AssetsCardPreview() {
  const { hasPassword, loading, result } = useAssets()

  if (!hasPassword) {
    return <span className="tool-card-desc">🔒 輸入密碼以顯示總資產</span>
  }

  if (result?.ok) {
    const priceDate = latestPriceDate(result.positions)
    return (
      <span className="assets-card-preview">
        <span className="assets-card-total">{formatHkd(totalValueHkd(result.positions))}</span>
        <span className="tool-card-desc">
          {result.positions.length} 項持倉{priceDate && ` · 價格日期 ${priceDate}`}
        </span>
      </span>
    )
  }

  return (
    <span className="tool-card-desc">{loading || !result ? '載入資產中…' : '資產暫時無法載入'}</span>
  )
}

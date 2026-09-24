import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AppShell from './app/AppShell'
import './app/app.css'
import HomePage from './pages/HomePage'
import UrlShortenerTool from './features/url-shortener/UrlShortenerTool'
import PomodoroTool from './features/pomodoro/PomodoroTool'
import QrCodeTool from './features/qr-code/QrCodeTool'
import HkWeatherTool from './features/hk-weather/HkWeatherTool'
import AssetsTool from './features/assets/AssetsTool'
import HkStocksTool from './features/hk-stocks/HkStocksTool'
import HkMarketTool from './features/hk-market/HkMarketTool'
import CryptoTool from './features/crypto/CryptoTool'
import BullionTool from './features/bullion/BullionTool'

function NotFoundPage() {
  return (
    <div className="panel">
      <h1>找不到頁面</h1>
      <p>您要尋找的頁面不存在,請返回主頁重新選擇工具。</p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/tools/url-shortener" element={<UrlShortenerTool />} />
          <Route path="/tools/pomodoro" element={<PomodoroTool />} />
          <Route path="/tools/qr-code" element={<QrCodeTool />} />
          <Route path="/tools/hk-weather" element={<HkWeatherTool />} />
          <Route path="/tools/assets" element={<AssetsTool />} />
          <Route path="/tools/hk-stocks" element={<HkStocksTool />} />
          <Route path="/tools/hk-market" element={<HkMarketTool />} />
          <Route path="/tools/crypto" element={<CryptoTool />} />
          <Route path="/tools/bullion" element={<BullionTool />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

# Small Tools

一站式小工具儀表板，內含四個獨立小工具，全部用 React + TypeScript 打造，支援 PWA 離線安裝。

## 工具一覽

- **短網址產生器**（`/tools/url-shortener`）— 將冗長網址縮短成方便分享的連結，透過 [is.gd](https://is.gd) 公開 API 產生短網址。
- **番茄鐘**（`/tools/pomodoro`）— 專注 25 分鐘、休息 5 分鐘的計時器，幫助保持工作節奏。
- **QR Code 產生器**（`/tools/qr-code`）— 將文字或網址即時轉成可下載的 QR Code 圖片。
- **香港時鐘與天氣**（`/tools/hk-weather`）— 顯示香港時間，並透過[香港天文台開放數據 API](https://data.weather.gov.hk/weatherAPI/doc/files/HKO_Open_Data_API_Documentation_tc.pdf) 顯示目前氣溫、濕度、天氣警告及本港天氣預測（每 10 分鐘自動更新）。

## 技術棧

- React 19 + TypeScript
- Vite 8（建置工具）+ vite-plugin-pwa（PWA 支援）
- React Router 7（路由）
- qrcode（QR Code 產生）
- Vitest + Testing Library（測試）
- oxlint（Lint）

## 常用指令

```bash
npm install       # 安裝相依套件
npm run dev        # 啟動開發伺服器
npm run test        # 執行測試（一次性）
npm run test:watch  # 執行測試（監看模式）
npm run lint        # 執行 lint 檢查
npm run typecheck   # 執行 TypeScript 型別檢查
npm run build        # 建置正式版本
npm run preview      # 預覽建置後的成果
```

## 專案架構

```
src/
├── app/               # App 外殼與工具清單設定（AppShell、tools.ts）
├── components/        # 共用元件（ToolCard、ToolPageHeader）
├── features/          # 各工具的獨立功能模組
│   ├── hk-weather/
│   ├── pomodoro/
│   ├── qr-code/
│   └── url-shortener/
├── pages/             # 頁面層級元件（HomePage）
├── test/              # 測試設定（setup.ts）
├── App.tsx            # 路由設定
└── main.tsx           # 應用程式進入點
```

每個 `features/` 子目錄都包含該工具的 UI 元件與核心邏輯（及對應測試），彼此互不依賴，方便獨立開發與測試。

## 關於 is.gd 外部 API 與網絡需求

短網址產生器透過 `https://is.gd/create.php` 這個公開 API 產生短網址，**此功能必須連接互聯網才能使用**；PWA 的 Service Worker 已將此 API 設定為 `NetworkOnly`，即無網絡時該請求不會被快取或離線代答，會直接失敗。香港時鐘與天氣的天氣部分同樣透過 `https://data.weather.gov.hk/weatherAPI/` 取得資料，Service Worker 亦設定為 `NetworkOnly`；離線時時鐘仍可運作，但天氣資料無法載入。番茄鐘與 QR Code 產生器則完全在本機運算，無需網絡連線。

## PWA 安裝與離線行為

本專案已設定為 PWA（`vite-plugin-pwa`，`registerType: 'autoUpdate'`），可在支援的瀏覽器中「加入主畫面」或安裝為獨立應用程式。安裝後：

- 靜態資源（JS、CSS、HTML、圖示、字型等）會被 Service Worker 預先快取，因此**番茄鐘與 QR Code 產生器可離線使用**。
- 未匹配路由會透過 `navigateFallback` 回退至 `index.html`，離線時重新整理頁面仍可正常運作。
- **短網址產生器需要網絡連線**（見上一節），離線時無法產生新的短網址。
- **香港天氣需要網絡連線**，離線時只會顯示時鐘。

## 關於密鑰

本專案**不需要任何 API 金鑰或密鑰**（`.env` 或其他機密設定），所有功能開箱即用。

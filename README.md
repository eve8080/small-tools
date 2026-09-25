# Small Tools

一站式小工具儀表板，內含十個獨立小工具，全部用 React + TypeScript 打造，支援 PWA 離線安裝。

## 工具一覽

- **短網址產生器**（`/tools/url-shortener`）— 將冗長網址縮短成方便分享的連結，透過 [is.gd](https://is.gd) 公開 API 產生短網址。
- **番茄鐘**（`/tools/pomodoro`）— 專注 25 分鐘、休息 5 分鐘的計時器，幫助保持工作節奏。
- **QR Code 產生器**（`/tools/qr-code`）— 將文字或網址即時轉成可下載的 QR Code 圖片。
- **香港時鐘與天氣**（`/tools/hk-weather`）— 顯示香港時間，並透過[香港天文台開放數據 API](https://data.weather.gov.hk/weatherAPI/doc/files/HKO_Open_Data_API_Documentation_tc.pdf) 顯示目前氣溫、濕度、天氣警告及本港天氣預測（每 10 分鐘自動更新）。
- **資產總覽**（`/tools/assets`）— 讀取並顯示 Supabase 的持倉數據，需輸入密碼。
- **恒指與港股**（`/tools/hk-stocks`）— 恒生指數及港股持倉的即時市值與今日盈虧。
- **港股市況**（`/tools/hk-market`）— 今日港股主要指數、升跌分佈、板塊表現及藍籌熱圖。
- **港股熱圖**（`/tools/hk-heatmap`）— 今日港股藍籌熱圖：面積按市值，顏色按升跌。
- **加密貨幣**（`/tools/crypto`）— 加密貨幣持倉市值、24 小時盈虧及市場數據。
- **貴金屬**（`/tools/bullion`）— 金銀等貴金屬持倉市值、今日盈虧及現貨價格。

後六個工具需透過後端 API（`/api/*`，見「後端 API」一節）取得數據。

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
npm run deploy       # 建置並部署至 Cloudflare Workers
npm run deploy:aws   # 建置並部署至 AWS（S3 + CloudFront + Lambda）
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
worker.js              # 後端 API（Cloudflare Worker，亦供 Lambda 使用）
lambda.js              # AWS Lambda 轉接層：將 Function URL 請求交給 worker.js 處理
deploy-aws.sh          # AWS 部署腳本（由 npm run deploy:aws 呼叫）
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

## 後端 API

`worker.js` 提供以下唯讀 API，前端一律以同源路徑 `/api/*` 呼叫：

- `/api/asset_positions` 等 — 經密碼保護（`Authorization: Bearer <密碼>`）的 Supabase 代理。
- `/api/hk-quotes` — 恒指及港股報價（騰訊行情）。
- `/api/metals` — 貴金屬現貨價及美元兌港元匯率（騰訊行情）。
- `/api/crypto` — 加密貨幣市場數據（CoinPaprika，或設定金鑰後改用 CoinGecko），快取一分鐘。

## 部署

本專案同時部署於兩個平台，兩者互不影響：

### Cloudflare Workers（`npm run deploy`）

Worker 同時提供靜態網站與 `/api/*`，設定見 `wrangler.jsonc`。

### AWS（`npm run deploy:aws`）

網址：<https://d22qpfwiw6tc.cloudfront.net>（ap-southeast-1，AWS profile `agent-dev`）

- **S3**（`agent-dev-public-site-10130a94`）— 存放 `dist/` 靜態檔案。帶雜湊的 `assets/` 快取一年，其餘檔案設為 `no-cache`。
- **CloudFront**（`E2HP2M446HG91I`）— 提供 HTTPS。`/api/*` 轉發至 Lambda（不快取，轉發查詢字串及 `Authorization`）；其餘路徑來自 S3。CloudFront Function `small-tools-spa-rewrite` 會把沒有副檔名的路徑（如 `/tools/pomodoro`）改寫為 `/index.html`。
- **Lambda**（`small-tools-api`，Node 22）— 經 `lambda.js` 執行未經修改的 `worker.js`。Lambda 沒有 Cache API，`/api/crypto` 的快取只存在於單一執行個體的記憶體中。

`deploy-aws.sh` 會上傳網站、更新 Lambda 程式碼，並清除 CloudFront 快取。

## 關於密鑰

前端不含任何密鑰。後端 API 需要以下密鑰，**切勿提交至版本庫**：

| 名稱 | 用途 |
| --- | --- |
| `SUPABASE_URL` | Supabase 專案網址 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role 金鑰（僅限伺服器端） |
| `ASSETS_PASSWORD` | 資產總覽的存取密碼 |
| `COINGECKO_API_KEY`（選用） | 設定後改用 CoinGecko |

- **Cloudflare**：以 `wrangler secret put <名稱>` 設定。
- **AWS**：設為 Lambda 環境變數。`aws lambda update-function-configuration --environment` 會**整組取代**所有變數，更新時須一併提供全部變數。

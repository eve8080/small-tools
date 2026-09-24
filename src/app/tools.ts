export interface ToolDefinition {
  id: string
  path: string
  name: string
  shortDescription: string
  icon: string
}

export const tools: ToolDefinition[] = [
  {
    id: 'url-shortener',
    path: '/tools/url-shortener',
    name: '短網址產生器',
    shortDescription: '將冗長網址縮短成方便分享的連結',
    icon: '🔗',
  },
  {
    id: 'pomodoro',
    path: '/tools/pomodoro',
    name: '番茄鐘',
    shortDescription: '專注 25 分鐘,休息 5 分鐘,保持節奏',
    icon: '⏱️',
  },
  {
    id: 'qr-code',
    path: '/tools/qr-code',
    name: 'QR Code 產生器',
    shortDescription: '將文字或網址即時轉成可下載的 QR Code',
    icon: '⬛',
  },
  {
    id: 'hk-weather',
    path: '/tools/hk-weather',
    name: '香港時鐘與天氣',
    shortDescription: '顯示香港時間及天文台最新天氣',
    icon: '🌤️',
  },
  {
    id: 'assets',
    path: '/tools/assets',
    name: '資產總覽',
    shortDescription: '讀取並顯示 Supabase 的持倉數據',
    icon: '📊',
  },
  {
    id: 'hk-stocks',
    path: '/tools/hk-stocks',
    name: '恒指與港股',
    shortDescription: '恒生指數及港股持倉的即時市值與今日盈虧',
    icon: '📈',
  },
]

export function findToolByPath(path: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.path === path)
}

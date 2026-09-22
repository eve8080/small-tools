import QRCode from 'qrcode'

export async function generateQrDataUrl(text: string): Promise<string> {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('請輸入文字或網址')
  }

  return QRCode.toDataURL(trimmed, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
  })
}

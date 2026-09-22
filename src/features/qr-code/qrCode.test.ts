import { describe, expect, it, vi } from 'vitest'
import { generateQrDataUrl } from './qrCode'

const { toDataURLMock } = vi.hoisted(() => ({
  toDataURLMock: vi.fn<(text: string, options?: Record<string, unknown>) => Promise<string>>(),
}))

vi.mock('qrcode', () => ({
  default: {
    toDataURL: toDataURLMock,
  },
}))

describe('generateQrDataUrl', () => {
  it('rejects empty input without calling the QR library', async () => {
    await expect(generateQrDataUrl('')).rejects.toThrow('請輸入文字或網址')
    expect(toDataURLMock).not.toHaveBeenCalled()
  })

  it('rejects whitespace-only input without calling the QR library', async () => {
    await expect(generateQrDataUrl('   ')).rejects.toThrow('請輸入文字或網址')
    expect(toDataURLMock).not.toHaveBeenCalled()
  })

  it('trims input and returns the generated data URL', async () => {
    toDataURLMock.mockResolvedValue('data:image/png;base64,abc123')

    const result = await generateQrDataUrl('  https://example.com  ')

    expect(toDataURLMock).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ errorCorrectionLevel: 'M' }),
    )
    expect(result).toBe('data:image/png;base64,abc123')
  })
})

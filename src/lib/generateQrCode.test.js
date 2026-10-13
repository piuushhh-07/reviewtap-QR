import { describe, expect, it } from 'vitest'
import { generateQrCode } from './generateQrCode'

describe('generateQrCode', () => {
  it('resolves to a PNG data URL for a valid link', async () => {
    const dataUrl = await generateQrCode('https://g.page/r/CYourPlaceId/review')
    expect(dataUrl).toMatch(/^data:image\/png;base64,/)
    expect(dataUrl.length).toBeGreaterThan(100)
  })

  it('produces different output for different URLs', async () => {
    const a = await generateQrCode('https://example.com/review-a')
    const b = await generateQrCode('https://example.com/review-b')
    expect(a).not.toBe(b)
  })

  it('rejects an empty string', async () => {
    await expect(generateQrCode('')).rejects.toThrow()
  })

  it('rejects a non-string value', async () => {
    await expect(generateQrCode(undefined)).rejects.toThrow()
  })
})

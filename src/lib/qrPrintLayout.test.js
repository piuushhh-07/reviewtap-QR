import { describe, expect, it } from 'vitest'
import { createLabeledQrSvg } from './qrPrintLayout'

const sampleQrSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><path d="M0 0h10v10H0z"/></svg>'

describe('createLabeledQrSvg', () => {
  it('includes the QR, business label, ID, and review instruction', () => {
    const result = createLabeledQrSvg(sampleQrSvg, {
      qrId: 'rt-123',
      businessName: 'Bluebird Cafe',
    })

    expect(result).toContain('<svg x="80" y="24"')
    expect(result).toContain('Bluebird Cafe')
    expect(result).toContain('rt-123')
    expect(result).toContain('Scan to leave a review')
  })

  it('escapes label text before inserting it into SVG markup', () => {
    const result = createLabeledQrSvg(sampleQrSvg, {
      qrId: 'rt-123',
      businessName: '<script>alert("x")</script> & Co',
    })

    expect(result).toContain('&lt;script&gt;')
    expect(result).toContain('&amp; Co')
    expect(result).not.toContain('<script>')
  })

  it('requires a QR SVG and ID', () => {
    expect(() => createLabeledQrSvg('not svg', { qrId: 'rt-123' })).toThrow(/valid QR SVG/i)
    expect(() => createLabeledQrSvg(sampleQrSvg, {})).toThrow(/QR ID/i)
  })
})

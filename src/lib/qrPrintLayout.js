function escapeXml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[character])
}

/**
 * Wraps a generated QR SVG in a print-ready label with the business name and QR ID.
 * The QR modules remain unchanged and retain a generous white quiet zone.
 */
export function createLabeledQrSvg(qrSvg, { qrId, businessName = 'Unassigned' } = {}) {
  if (typeof qrSvg !== 'string' || !qrSvg.trim().startsWith('<svg')) {
    throw new Error('A valid QR SVG is required.')
  }
  if (!qrId || typeof qrId !== 'string') {
    throw new Error('A QR ID is required.')
  }

  const label = String(businessName || 'Unassigned')
  const businessText = escapeXml(label)
  const fitLabel = label.length > 24 ? ' textLength="680" lengthAdjust="spacingAndGlyphs"' : ''
  const innerSvg = qrSvg
    .replace(/^<svg\b[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')

  if (innerSvg === qrSvg) {
    throw new Error('The QR SVG could not be read.')
  }

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="820" viewBox="0 0 800 820">',
    '<rect width="800" height="820" fill="#ffffff"/>',
    '<svg x="80" y="24" width="640" height="640" viewBox="0 0 640 640">',
    innerSvg,
    '</svg>',
    `<text x="400" y="710" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="#111827"${fitLabel}>`,
    businessText,
    '</text>',
    '<text x="400" y="760" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#374151">',
    escapeXml(qrId),
    '</text>',
    '<text x="400" y="795" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#4b5563">Scan to leave a review</text>',
    '</svg>',
  ].join('')
}

export function svgToPngDataUrl(svg, { width = 800, height = 820 } = {}) {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return Promise.reject(new Error('PNG export is only available in a browser.'))
  }

  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas is unavailable in this browser.')
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, width, height)
        context.drawImage(image, 0, 0, width, height)
        resolve(canvas.toDataURL('image/png'))
      } catch (error) {
        reject(error)
      }
    }
    image.onerror = () => reject(new Error('Could not render the labeled QR image.'))
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

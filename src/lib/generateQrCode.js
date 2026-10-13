import QRCode from 'qrcode'

/**
 * Generates a QR code PNG for the given URL and returns it as a data URL,
 * entirely in the caller's environment (browser or Node) — the URL never
 * leaves the device.
 *
 * Settings are chosen for scan reliability over decoration: high error
 * correction, a generous quiet margin, and pure black-on-white modules.
 *
 * @param {string} url - the exact link to encode
 * @returns {Promise<string>} a `data:image/png;base64,...` string
 */
export async function generateQrCode(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('generateQrCode requires a non-empty URL string.')
  }

  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    margin: 4,
    width: 640,
    color: {
      dark: '#000000ff',
      light: '#ffffffff',
    },
  })
}

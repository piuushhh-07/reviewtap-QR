import vercelHandler from '../../server/vercelHandler.js'

export default function redirectHandler(request, response) {
  const url = new URL(request.url, `https://${request.headers.host ?? 'localhost'}`)
  const qrId = request.query?.qrId
  const id = Array.isArray(qrId) ? qrId[0] : qrId
  request.url = `/r/${encodeURIComponent(String(id ?? ''))}${url.search}`
  return vercelHandler(request, response)
}

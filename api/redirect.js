import vercelHandler from '../server/vercelHandler.js'

export function rewriteRedirectRequest(request) {
  const url = new URL(request.url, `https://${request.headers.host ?? 'localhost'}`)
  const qrId = request.query?.qrId
  const id = Array.isArray(qrId) ? qrId[0] : qrId
  request.url = `/r/${encodeURIComponent(String(id ?? ''))}${url.search}`
}

export default function redirectHandler(request, response) {
  rewriteRedirectRequest(request)
  return vercelHandler(request, response)
}

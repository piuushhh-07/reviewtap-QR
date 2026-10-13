import vercelHandler from '../server/vercelHandler.js'

export default function apiHandler(request, response) {
  const url = new URL(request.url, `https://${request.headers.host ?? 'localhost'}`)
  const parts = request.query?.parts
  const apiPath = Array.isArray(parts) ? parts.join('/') : String(parts ?? '')
  request.url = `/api/${apiPath}${url.search}`
  return vercelHandler(request, response)
}

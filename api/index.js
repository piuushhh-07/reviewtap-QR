import vercelHandler from '../server/vercelHandler.js'

export function rewriteApiRequest(request) {
  const url = new URL(request.url, `https://${request.headers.host ?? 'localhost'}`)
  const route = request.query?.path
  const apiPath = Array.isArray(route) ? route.join('/') : String(route ?? '')
  url.searchParams.delete('path')
  request.url = `/api/${apiPath}${url.search}`
}

export default function apiHandler(request, response) {
  rewriteApiRequest(request)
  return vercelHandler(request, response)
}

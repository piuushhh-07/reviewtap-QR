import { openPostgresDatabase } from './database.js'
import { createAppHandler } from './index.js'

let handlerPromise

function initializeHandler() {
  if (handlerPromise) return handlerPromise

  handlerPromise = (async () => {
    const databaseUrl = process.env.DATABASE_URL
    const adminPassword = process.env.ADMIN_PASSWORD
    const sessionSecret = process.env.ADMIN_SESSION_SECRET
    const publicBaseUrl = process.env.PUBLIC_BASE_URL

    if (typeof adminPassword !== 'string' || adminPassword.length < 12) {
      throw new Error('Set ADMIN_PASSWORD to a password with at least 12 characters.')
    }
    if (typeof sessionSecret !== 'string' || sessionSecret.length < 32) {
      throw new Error('Set ADMIN_SESSION_SECRET to a random secret with at least 32 characters.')
    }
    if (typeof publicBaseUrl !== 'string' || !publicBaseUrl) {
      throw new Error('Set PUBLIC_BASE_URL to your deployed HTTPS domain.')
    }

    const database = await openPostgresDatabase(databaseUrl)
    const handler = createAppHandler({
      store: database.store,
      adminPassword,
      sessionSecret,
      publicBaseUrl,
      secureCookies: true,
    })
    return { handler, close: database.close }
  })()
  return handlerPromise
}

export default async function vercelHandler(request, response) {
  try {
    const app = await initializeHandler()
    return await app.handler(request, response)
  } catch (error) {
    console.error('Vercel request failed:', error)
    if (!response.headersSent) {
      response.writeHead(500, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      response.end(JSON.stringify({ error: 'The server could not complete this request.' }))
    } else {
      response.end()
    }
  }
}

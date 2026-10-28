import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDataStore, openDatabase } from './database.js'
import { validateBusinessName, validateGoogleReviewUrl } from '../src/lib/validateReviewUrl.js'
import { getReviewCategories, isValidBusinessCategory } from '../src/lib/reviewSuggestions.js'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sessionLifetimeMs = 12 * 60 * 60 * 1000
const loginWindowMs = 15 * 60 * 1000
const loginAttemptLimit = 5
const maximumBodyBytes = 32 * 1024
const cookieName = 'reviewtap_admin'
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function parsePublicBaseUrl(value) {
  const url = new URL(value)
  const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
  if (
    (!localHttp && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    (url.pathname !== '/' && url.pathname !== '') ||
    url.search ||
    url.hash
  ) {
    throw new Error('PUBLIC_BASE_URL must be an HTTPS origin (HTTP is allowed for localhost only).')
  }
  return url.origin
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map((part) => {
      const separator = part.indexOf('=')
      if (separator < 0) return ['', '']
      return [part.slice(0, separator).trim(), part.slice(separator + 1).trim()]
    }),
  )
}

export function getClientAddress(request) {
  if (request.socket?.remoteAddress) return request.socket.remoteAddress
  const forwardedFor = request.headers['x-forwarded-for']
  if (typeof forwardedFor !== 'string') return 'unknown'
  return forwardedFor.split(',').map((address) => address.trim()).find(Boolean) ?? 'unknown'
}

async function readJson(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (Buffer.byteLength(body) > maximumBodyBytes) {
      throw new HttpError(413, 'Request body is too large.')
    }
  }
  try {
    const parsed = JSON.parse(body || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Expected a JSON object.')
    }
    return parsed
  } catch {
    throw new HttpError(400, 'Send a valid JSON object.')
  }
}

function sendJson(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  })
  response.end(JSON.stringify(payload))
}

const generalBusinessCategoryId = 'other-general-business'
const legacyCategoryIds = {
  cafe: 'cafe-restaurant',
  dental: 'dental-clinic',
  pharmacy: 'pharmacy',
  salon: 'salon-barber',
  retail: 'retail-store',
  hotel: 'hotel-accommodation',
  clinic: generalBusinessCategoryId,
  other: generalBusinessCategoryId,
}
const legacyCategoryById = {
  'cafe-restaurant': 'cafe',
  'dental-clinic': 'dental',
  pharmacy: 'pharmacy',
  'salon-barber': 'salon',
  'retail-store': 'retail',
  'hotel-accommodation': 'hotel',
  'gaming-cafe': 'other',
  'gym-fitness': 'other',
  'electronics-computer-store': 'other',
  [generalBusinessCategoryId]: 'other',
}

function validateBusinessCategory(value) {
  if (!isValidBusinessCategory(value)) {
    throw new HttpError(400, 'Choose a valid business category.')
  }
  return value
}

function resolveBusinessCategory(body, fallbackCategoryId = generalBusinessCategoryId) {
  if (Object.hasOwn(body, 'category_id')) {
    return validateBusinessCategory(body.category_id)
  }
  if (Object.hasOwn(body, 'category')) {
    const categoryId = isValidBusinessCategory(body.category)
      ? body.category
      : legacyCategoryIds[body.category]
    return validateBusinessCategory(categoryId)
  }
  return isValidBusinessCategory(fallbackCategoryId)
    ? fallbackCategoryId
    : generalBusinessCategoryId
}

function categoryLabel(categoryId) {
  return getReviewCategories().find((category) => category.id === categoryId)?.label ??
    getReviewCategories().find((category) => category.id === generalBusinessCategoryId).label
}

function validateBusiness(name, reviewUrl) {
  const nameResult = validateBusinessName(name)
  if (!nameResult.valid) throw new HttpError(400, nameResult.message)
  const urlResult = validateGoogleReviewUrl(reviewUrl)
  if (!urlResult.valid) throw new HttpError(400, urlResult.message)
  return { name: nameResult.normalizedName, reviewUrl: urlResult.normalizedUrl }
}

async function logAction(store, action, { qrId = null, businessId = null, details = {} } = {}) {
  await store.run(`
    INSERT INTO audit_logs (qr_id, business_id, action, actor, details_json, created_at)
    VALUES (?, ?, ?, 'admin', ?, ?)
  `, [qrId, businessId, action, JSON.stringify(details), new Date().toISOString()])
}

function sendStaticFile(response, filePath) {
  const contentType = mimeTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
  response.writeHead(200, {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
  })
  createReadStream(filePath).pipe(response)
}

export function createAppHandler({
  store,
  adminPassword = process.env.ADMIN_PASSWORD,
  sessionSecret = process.env.ADMIN_SESSION_SECRET ?? adminPassword,
  publicBaseUrl = process.env.PUBLIC_BASE_URL ??
    (process.env.npm_lifecycle_event === 'dev:server' || process.env.NODE_ENV === 'test'
      ? 'http://localhost:5173'
      : ''),
  secureCookies,
  distDirectory = join(projectRoot, 'dist'),
} = {}) {
  if (typeof adminPassword !== 'string' || adminPassword.length < 12) {
    throw new Error('Set ADMIN_PASSWORD to a password with at least 12 characters.')
  }

  if (!publicBaseUrl) throw new Error('Set PUBLIC_BASE_URL to the public HTTPS origin for this installation.')
  if (typeof sessionSecret !== 'string' || sessionSecret.length < 12) {
    throw new Error('Set ADMIN_SESSION_SECRET to a secret with at least 12 characters.')
  }
  const publicOrigin = parsePublicBaseUrl(publicBaseUrl)
  const useSecureCookies = secureCookies ?? new URL(publicOrigin).protocol === 'https:'
  if (!store) throw new Error('Provide a database store to createAppHandler.')
  const dataStore = store
  const passwordSalt = randomBytes(16)
  const passwordDigest = scryptSync(adminPassword, passwordSalt, 32)
  const loginAttempts = new Map()

  function sessionTokenFromRequest(request) {
    const value = parseCookies(request.headers.cookie)[cookieName] ?? ''
    const [token, signature] = value.split('.')
    if (
      !/^[A-Za-z0-9_-]{43}$/.test(token ?? '') ||
      !/^[a-f0-9]{64}$/.test(signature ?? '')
    ) {
      return null
    }
    const expected = createHmac('sha256', sessionSecret).update(token).digest()
    const actual = Buffer.from(signature, 'hex')
    return timingSafeEqual(expected, actual) ? token : null
  }

  async function isAuthorized(request) {
    const token = sessionTokenFromRequest(request)
    if (!token) return false
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const timestamp = new Date().toISOString()
    const result = await dataStore.run(`
      UPDATE admin_sessions SET expires_at = ?
      WHERE token_hash = ? AND expires_at > ?
    `, [new Date(Date.now() + sessionLifetimeMs).toISOString(), tokenHash, timestamp])
    if (!result.changes) {
      await dataStore.run('DELETE FROM admin_sessions WHERE token_hash = ?', [tokenHash])
      return false
    }
    return true
  }

  function checkRequestOrigin(request) {
    const origin = request.headers.origin
    if (origin) {
      try {
        if (new URL(origin).host !== request.headers.host) {
          throw new HttpError(403, 'Cross-origin requests are not allowed.')
        }
      } catch (error) {
        if (error instanceof HttpError) throw error
        throw new HttpError(403, 'Cross-origin requests are not allowed.')
      }
    }
  }

  function qrRecord(row) {
    return {
      ...row,
      dynamic_url: `${publicOrigin}/r/${encodeURIComponent(row.id)}`,
    }
  }

  async function handleApi(request, response, url) {
    const pathname = url.pathname

    if (pathname === '/api/auth/session' && request.method === 'GET') {
      sendJson(response, 200, { authenticated: await isAuthorized(request) })
      return
    }

    if (pathname === '/api/auth/login' && request.method === 'POST') {
      checkRequestOrigin(request)
      const body = await readJson(request)
      if (typeof body.password !== 'string' || body.password.length > 1024) {
        throw new HttpError(400, 'Enter a valid admin password.')
      }
      const address = getClientAddress(request)
      const attempts = loginAttempts.get(address) ?? { count: 0, startedAt: Date.now() }
      if (Date.now() - attempts.startedAt > loginWindowMs) {
        attempts.count = 0
        attempts.startedAt = Date.now()
      }
      if (attempts.count >= loginAttemptLimit) {
        throw new HttpError(429, 'Too many login attempts. Try again in 15 minutes.')
      }
      attempts.count += 1
      loginAttempts.set(address, attempts)

      const candidate = scryptSync(body.password, passwordSalt, 32)
      if (!timingSafeEqual(candidate, passwordDigest)) {
        throw new HttpError(401, 'Incorrect admin password.')
      }
      loginAttempts.delete(address)
      const token = randomBytes(32).toString('base64url')
      const now = Date.now()
      await dataStore.run('DELETE FROM admin_sessions WHERE expires_at <= ?', [
        new Date(now).toISOString(),
      ])
      await dataStore.run(`
        INSERT INTO admin_sessions (token_hash, expires_at, created_at) VALUES (?, ?, ?)
      `, [
        createHash('sha256').update(token).digest('hex'),
        new Date(now + sessionLifetimeMs).toISOString(),
        new Date(now).toISOString(),
      ])
      const flags = ['Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${sessionLifetimeMs / 1000}`]
      if (useSecureCookies) flags.push('Secure')
      const signature = createHmac('sha256', sessionSecret).update(token).digest('hex')
      sendJson(response, 200, { authenticated: true }, {
        'Set-Cookie': `${cookieName}=${token}.${signature}; ${flags.join('; ')}`,
      })
      return
    }

    if (pathname === '/api/auth/logout' && request.method === 'POST') {
      checkRequestOrigin(request)
      const token = sessionTokenFromRequest(request)
      if (token) {
        await dataStore.run('DELETE FROM admin_sessions WHERE token_hash = ?', [
          createHash('sha256').update(token).digest('hex'),
        ])
      }
      sendJson(response, 200, { authenticated: false }, {
        'Set-Cookie': `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${useSecureCookies ? '; Secure' : ''}`,
      })
      return
    }

    if (pathname.startsWith('/api/public/qrs/') && request.method === 'GET') {
      const publicQrMatch = pathname.match(
        /^\/api\/public\/qrs\/(rt-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i,
      )
      if (!publicQrMatch) throw new HttpError(400, 'Enter a valid QR code ID.')
      const qr = await dataStore.get(`
        SELECT q.status, b.name AS business_name, b.category_id,
               b.review_url AS destination_url
        FROM qr_codes q
        LEFT JOIN businesses b ON b.id = q.business_id
        WHERE q.id = ?
      `, [publicQrMatch[1]])
      if (!qr) throw new HttpError(404, 'QR code not found.')
      if (qr.status === 'disabled') throw new HttpError(410, 'This QR code has been disabled.')
      if (qr.status !== 'assigned' || !qr.destination_url) {
        throw new HttpError(409, 'This QR code has not been programmed yet.')
      }
      const destination = validateGoogleReviewUrl(qr.destination_url)
      if (!destination.valid) throw new HttpError(500, 'The saved review destination is invalid.')
      const categoryId = isValidBusinessCategory(qr.category_id)
        ? qr.category_id
        : generalBusinessCategoryId
      sendJson(response, 200, {
        business_name: qr.business_name,
        category_id: categoryId,
        category_label: categoryLabel(categoryId),
        destination_url: destination.normalizedUrl,
      })
      return
    }

    if (!await isAuthorized(request)) throw new HttpError(401, 'Sign in to manage QR codes.')
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) checkRequestOrigin(request)

    if (pathname === '/api/qrs' && request.method === 'GET') {
      const status = url.searchParams.get('status') ?? ''
      if (status && !['unassigned', 'assigned', 'disabled'].includes(status)) {
        throw new HttpError(400, 'Choose a valid QR status filter.')
      }
      const search = (url.searchParams.get('search') ?? '').trim().slice(0, 100)
      const businessId = url.searchParams.get('business_id') ?? ''
      const limitValue = Number(url.searchParams.get('limit') ?? 25)
      const offsetValue = Number(url.searchParams.get('offset') ?? 0)
      const limit = Number.isInteger(limitValue) ? Math.min(100, Math.max(1, limitValue)) : 25
      const offset = Number.isInteger(offsetValue) ? Math.max(0, offsetValue) : 0
      const filters = `
        WHERE (? = '' OR q.status = ?)
          AND (? = '' OR q.business_id = ?)
          AND (? = '' OR lower(q.id) LIKE lower(?) OR lower(b.name) LIKE lower(?) OR lower(b.review_url) LIKE lower(?))
      `
      const countRow = await dataStore.get(`
        SELECT COUNT(*) AS count
        FROM qr_codes q
        LEFT JOIN businesses b ON b.id = q.business_id
        ${filters}
      `, [status, status, businessId, businessId, search, `%${search}%`, `%${search}%`, `%${search}%`])
      const count = Number(countRow.count)
      const summaryRows = await dataStore.all(`
        SELECT status, COUNT(*) AS count FROM qr_codes GROUP BY status
      `)
      const summary = { unassigned: 0, assigned: 0, disabled: 0 }
      for (const row of summaryRows) summary[row.status] = Number(row.count)
      const rows = await dataStore.all(`
        SELECT q.id, q.status, q.created_at, q.assigned_at, q.business_id,
               b.name AS business_name, b.review_url AS destination_url
        FROM qr_codes q
        LEFT JOIN businesses b ON b.id = q.business_id
        ${filters}
        ORDER BY q.created_at DESC
        LIMIT ? OFFSET ?
      `, [status, status, businessId, businessId, search, `%${search}%`, `%${search}%`, `%${search}%`, limit, offset])
      sendJson(response, 200, { qrs: rows.map(qrRecord), total: count, summary })
      return
    }

    if (pathname === '/api/qrs' && request.method === 'POST') {
      const body = await readJson(request)
      const count = body.count === undefined ? 1 : body.count
      if (!Number.isInteger(count) || count < 1 || count > 500) {
        throw new HttpError(400, 'Generate between 1 and 500 QR codes at a time.')
      }
      const createdAt = new Date().toISOString()
      const qrs = await dataStore.transaction(async (transactionStore) => {
        const rows = Array.from({ length: count }, () => {
          const id = `rt-${randomUUID()}`
          return { id, status: 'unassigned', created_at: createdAt }
        })
        const values = rows.map(() => '(?, ?, ?)').join(', ')
        await transactionStore.run(
          `INSERT INTO qr_codes (id, status, created_at) VALUES ${values}`,
          rows.flatMap((row) => [row.id, row.status, row.created_at]),
        )
        await logAction(transactionStore, 'generate', { details: { count, ids: rows.map((row) => row.id) } })
        return rows
      })
      sendJson(response, 201, { qrs: qrs.map(qrRecord) })
      return
    }

    if (pathname === '/api/businesses' && request.method === 'GET') {
      const businesses = await dataStore.all(`
        SELECT b.id, b.name, b.category, b.category_id, b.review_url, b.created_at, b.updated_at,
               COUNT(q.id) AS qr_count
        FROM businesses b
        LEFT JOIN qr_codes q ON q.business_id = b.id
        GROUP BY b.id
        ORDER BY lower(b.name)
      `)
      sendJson(response, 200, {
        businesses: businesses.map((business) => {
          const categoryId = isValidBusinessCategory(business.category_id)
            ? business.category_id
            : generalBusinessCategoryId
          return {
            ...business,
            category_id: categoryId,
            category_label: categoryLabel(categoryId),
          }
        }),
      })
      return
    }

    if (pathname === '/api/businesses' && request.method === 'POST') {
      const body = await readJson(request)
      const business = validateBusiness(body.name, body.review_url)
      const categoryId = resolveBusinessCategory(body)
      const legacyCategory = legacyCategoryById[categoryId]
      const duplicate = await dataStore.get('SELECT id FROM businesses WHERE lower(name) = lower(?)', [business.name])
      if (duplicate) throw new HttpError(409, 'A business with that name already exists. Select it or edit it.')
      const id = randomUUID()
      const timestamp = new Date().toISOString()
      await dataStore.run(`
        INSERT INTO businesses (id, name, review_url, category, category_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [id, business.name, business.reviewUrl, legacyCategory, categoryId, timestamp, timestamp])
      sendJson(response, 201, {
        business: {
          id,
          ...business,
          category: legacyCategory,
          category_id: categoryId,
          category_label: categoryLabel(categoryId),
          created_at: timestamp,
          updated_at: timestamp,
          qr_count: 0,
        },
      })
      return
    }

    const testMatch = pathname.match(/^\/api\/qrs\/(rt-[0-9a-f-]+)\/test$/i)
    if (testMatch && request.method === 'GET') {
      const qr = await dataStore.get(`
        SELECT q.id, q.status, b.review_url AS destination_url
        FROM qr_codes q
        LEFT JOIN businesses b ON b.id = q.business_id
        WHERE q.id = ?
      `, [testMatch[1]])
      if (!qr) throw new HttpError(404, 'QR code not found.')
      if (qr.status === 'disabled') throw new HttpError(410, 'This QR code is disabled.')
      if (qr.status !== 'assigned' || !qr.destination_url) {
        throw new HttpError(409, 'Assign a business before testing this QR code.')
      }
      const destination = validateGoogleReviewUrl(qr.destination_url)
      if (!destination.valid) throw new HttpError(500, 'The saved review destination is invalid.')
      sendJson(response, 200, {
        redirect_url: `${publicOrigin}/r/${encodeURIComponent(qr.id)}`,
        destination_url: destination.normalizedUrl,
      })
      return
    }

    const businessMatch = pathname.match(/^\/api\/businesses\/([0-9a-f-]+)$/i)
    if (businessMatch && request.method === 'PUT') {
      const body = await readJson(request)
      const existingBusiness = await dataStore.get(
        'SELECT category_id, category FROM businesses WHERE id = ?',
        [businessMatch[1]],
      )
      if (!existingBusiness) throw new HttpError(404, 'Business not found.')
      const business = validateBusiness(body.name, body.review_url)
      const categoryId = resolveBusinessCategory(
        body,
        existingBusiness.category_id ?? generalBusinessCategoryId,
      )
      const legacyCategory = legacyCategoryById[categoryId]
      const duplicate = await dataStore.get(
        'SELECT id FROM businesses WHERE lower(name) = lower(?) AND id != ?',
        [business.name, businessMatch[1]],
      )
      if (duplicate) throw new HttpError(409, 'A business with that name already exists.')
      const timestamp = new Date().toISOString()
      const result = await dataStore.run(`
        UPDATE businesses SET name = ?, review_url = ?, category = ?, category_id = ?, updated_at = ? WHERE id = ?
      `, [business.name, business.reviewUrl, legacyCategory, categoryId, timestamp, businessMatch[1]])
      if (!result.changes) throw new HttpError(404, 'Business not found.')
      await logAction(dataStore, 'business_update', {
        businessId: businessMatch[1],
        details: { name: business.name, review_url: business.reviewUrl, category_id: categoryId },
      })
      sendJson(response, 200, {
        business: {
          id: businessMatch[1],
          ...business,
          category: legacyCategory,
          category_id: categoryId,
          category_label: categoryLabel(categoryId),
          updated_at: timestamp,
        },
      })
      return
    }

    const assignMatch = pathname.match(/^\/api\/qrs\/(rt-[0-9a-f-]+)\/assign$/i)
    if (assignMatch && request.method === 'POST') {
      const body = await readJson(request)
      const qr = await dataStore.get('SELECT id, status FROM qr_codes WHERE id = ?', [assignMatch[1]])
      if (!qr) throw new HttpError(404, 'QR code not found.')
      if (qr.status !== 'unassigned') {
        throw new HttpError(409, 'This QR code is already assigned or disabled. Reset it before reassigning.')
      }

      const result = await dataStore.transaction(async (transactionStore) => {
        let businessId = body.business_id
        let business
        if (typeof businessId === 'string' && businessId) {
          business = await transactionStore.get('SELECT id, name FROM businesses WHERE id = ?', [businessId])
          if (!business) throw new HttpError(404, 'Business not found.')
        } else {
          business = validateBusiness(body.name, body.review_url)
          const categoryId = resolveBusinessCategory(body)
          const legacyCategory = legacyCategoryById[categoryId]
          const duplicate = await transactionStore.get(
            'SELECT id FROM businesses WHERE lower(name) = lower(?)',
            [business.name],
          )
          if (duplicate) throw new HttpError(409, 'A business with that name already exists. Select it from the business list.')
          businessId = randomUUID()
          const timestamp = new Date().toISOString()
          await transactionStore.run(`
            INSERT INTO businesses (id, name, review_url, category, category_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [businessId, business.name, business.reviewUrl, legacyCategory, categoryId, timestamp, timestamp])
          business = { id: businessId, name: business.name, category: legacyCategory, category_id: categoryId }
        }
        const assignedAt = new Date().toISOString()
        const update = await transactionStore.run(`
          UPDATE qr_codes SET status = 'assigned', business_id = ?, assigned_at = ?
          WHERE id = ? AND status = 'unassigned' AND business_id IS NULL
        `, [businessId, assignedAt, qr.id])
        if (!update.changes) throw new HttpError(409, 'This QR code has already been assigned.')
        await logAction(transactionStore, 'assign', {
          qrId: qr.id,
          businessId,
          details: { business_name: business.name },
        })
        return { business_id: businessId, business_name: business.name, assigned_at: assignedAt }
      })
      sendJson(response, 200, { qr: { id: qr.id, status: 'assigned', ...result } })
      return
    }

    const qrActionMatch = pathname.match(/^\/api\/qrs\/(rt-[0-9a-f-]+)\/(reset|disable|enable)$/i)
    if (qrActionMatch && request.method === 'POST') {
      const body = await readJson(request)
      const [, qrId, action] = qrActionMatch
      const qr = await dataStore.get('SELECT id, status, business_id FROM qr_codes WHERE id = ?', [qrId])
      if (!qr) throw new HttpError(404, 'QR code not found.')
      if (action === 'reset' && body.confirm !== true) {
        throw new HttpError(400, 'Confirm the reset before removing this assignment.')
      }
      await dataStore.transaction(async (transactionStore) => {
        if (action === 'reset') {
          if (!qr.business_id) throw new HttpError(409, 'This QR code is not assigned.')
          await transactionStore.run(`
            UPDATE qr_codes SET status = 'unassigned', business_id = NULL, assigned_at = NULL
            WHERE id = ?
          `, [qr.id])
          await logAction(transactionStore, 'reset', { qrId: qr.id, businessId: qr.business_id })
        } else if (action === 'disable') {
          if (qr.status === 'disabled') throw new HttpError(409, 'This QR code is already disabled.')
          await transactionStore.run("UPDATE qr_codes SET status = 'disabled' WHERE id = ?", [qr.id])
          await logAction(transactionStore, 'disable', { qrId: qr.id, businessId: qr.business_id })
        } else {
          if (qr.status !== 'disabled') throw new HttpError(409, 'This QR code is not disabled.')
          const status = qr.business_id ? 'assigned' : 'unassigned'
          await transactionStore.run('UPDATE qr_codes SET status = ? WHERE id = ?', [status, qr.id])
          await logAction(transactionStore, 'enable', { qrId: qr.id, businessId: qr.business_id })
        }
      })
      sendJson(response, 200, { status: action === 'reset' ? 'unassigned' : action === 'disable' ? 'disabled' : qr.business_id ? 'assigned' : 'unassigned' })
      return
    }

    if (pathname === '/api/audit' && request.method === 'GET') {
      const logs = await dataStore.all(`
        SELECT id, qr_id, business_id, action, actor, details_json, created_at
        FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT 500
      `)
      sendJson(response, 200, { logs })
      return
    }

    throw new HttpError(404, 'API route not found.')
  }

  return async (request, response) => {
    const url = new URL(request.url, 'http://localhost')
    try {
      if (url.pathname.startsWith('/api/')) {
        await handleApi(request, response, url)
        return
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        throw new HttpError(404, 'Not found.')
      }
      if (!existsSync(distDirectory)) throw new HttpError(404, 'Build the frontend with npm run build first.')
      const relativePath = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '')
      const requestedPath = resolve(distDirectory, relativePath)
      if (requestedPath !== distDirectory && !requestedPath.startsWith(`${resolve(distDirectory)}${sep}`)) {
        throw new HttpError(404, 'Not found.')
      }
      const filePath = existsSync(requestedPath) && statSync(requestedPath).isFile()
        ? requestedPath
        : join(distDirectory, 'index.html')
      if (!existsSync(filePath)) throw new HttpError(404, 'Build the frontend with npm run build first.')
      if (request.method === 'HEAD') {
        response.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath)] ?? 'text/html; charset=utf-8' })
        response.end()
      } else {
        sendStaticFile(response, filePath)
      }
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500
      if (status === 500) console.error('Request failed:', error)
      if (!response.headersSent) sendJson(response, status, { error: status === 500 ? 'The request could not be completed.' : error.message })
      else response.end()
    }
  }
}

export function createAppServer(options = {}) {
  const rawDatabase = openDatabase(
    options.databasePath ?? join(projectRoot, 'data', 'reviewtap.sqlite'),
  )
  const store = createDataStore(rawDatabase)
  const handler = createAppHandler({ ...options, store })
  const server = createServer(handler)
  server.on('close', () => rawDatabase.close())
  return server
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT ?? 3001)
  const server = createAppServer()
  server.listen(port, () => {
    console.log(`ReviewTap server listening on port ${port}`)
  })
}

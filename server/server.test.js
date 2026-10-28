import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAppServer, getClientAddress } from './index.js'

const adminPassword = 'correct horse battery staple'

describe('client address detection', () => {
  it('uses the socket address when available', () => {
    expect(getClientAddress({
      socket: { remoteAddress: '192.0.2.1' },
      headers: { 'x-forwarded-for': '198.51.100.2' },
    })).toBe('192.0.2.1')
  })

  it('uses the first forwarded address for serverless requests without a socket', () => {
    expect(getClientAddress({
      headers: { 'x-forwarded-for': '198.51.100.2, 192.0.2.1' },
    })).toBe('198.51.100.2')
  })

  it('falls back safely when no client address is available', () => {
    expect(getClientAddress({ headers: {} })).toBe('unknown')
  })
})

describe('dynamic QR management API', () => {
  let server
  let origin
  let cookie
  let databaseDirectory
  let databasePath
  let distDirectory

  async function startServer() {
    server = createAppServer({
      databasePath,
      adminPassword,
      publicBaseUrl: 'https://reviews.example',
      secureCookies: false,
      distDirectory,
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    origin = `http://127.0.0.1:${server.address().port}`
  }

  async function signIn() {
    const response = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ password: adminPassword }),
    })
    expect(response.status).toBe(200)
    cookie = response.headers.get('set-cookie').split(';')[0]
  }

  beforeEach(async () => {
    databaseDirectory = mkdtempSync(join(tmpdir(), 'reviewtap-qr-'))
    databasePath = join(databaseDirectory, 'reviewtap.sqlite')
    distDirectory = join(databaseDirectory, 'dist')
    mkdirSync(distDirectory, { recursive: true })
    writeFileSync(join(distDirectory, 'index.html'), '<!doctype html><html><body><div id="root"></div></body></html>')
    await startServer()
    await signIn()
  })

  afterEach(async () => {
    if (server?.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    rmSync(databaseDirectory, { recursive: true, force: true })
  })

  async function request(path, { method = 'GET', body, authenticated = true, originHeader = origin } = {}) {
    const headers = {}
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      headers.Origin = originHeader
    }
    if (authenticated) headers.Cookie = cookie
    const response = await fetch(`${origin}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: 'manual',
    })
    const payload = response.headers.get('content-type')?.includes('application/json')
      ? await response.json()
      : null
    return { response, payload }
  }

  it('requires authentication and creates unique, unassigned dynamic QR codes in bulk', async () => {
    const unauthenticated = await request('/api/qrs', { authenticated: false })
    expect(unauthenticated.response.status).toBe(401)

    const result = await request('/api/qrs', { method: 'POST', body: { count: 4 } })
    const codes = result.payload.qrs
    expect(result.response.status).toBe(201)
    expect(codes).toHaveLength(4)
    expect(new Set(codes.map((qr) => qr.id)).size).toBe(4)
    expect(codes.every((qr) => qr.status === 'unassigned')).toBe(true)
    expect(codes[0].dynamic_url).toBe(`https://reviews.example/r/${codes[0].id}`)
    expect((await request('/api/qrs')).payload.summary.unassigned).toBe(4)
  })

  it('persists QR inventory and migrations across server restarts', async () => {
    const generated = await request('/api/qrs', { method: 'POST', body: { count: 1 } })
    const generatedId = generated.payload.qrs[0].id
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))

    await startServer()
    const inventory = await request('/api/qrs')
    expect(inventory.response.status).toBe(200)
    expect(inventory.payload.qrs.map((qr) => qr.id)).toContain(generatedId)
  })

  it('validates destinations, prevents reassignment, updates redirects, and requires explicit reset', async () => {
    const generated = await request('/api/qrs', { method: 'POST', body: { count: 1 } })
    const qr = generated.payload.qrs[0]
    const rejected = await request(`/api/qrs/${qr.id}/assign`, {
      method: 'POST',
      body: { name: 'Example', review_url: 'https://attacker.example/redirect' },
    })
    expect(rejected.response.status).toBe(400)

    const assigned = await request(`/api/qrs/${qr.id}/assign`, {
      method: 'POST',
      body: { name: 'Danish Smile Care', review_url: 'https://g.page/r/PlaceId/review', category: 'dental' },
    })
    expect(assigned.response.status).toBe(200)
    const reassignment = await request(`/api/qrs/${qr.id}/assign`, {
      method: 'POST',
      body: { name: 'Another business', review_url: 'https://g.page/r/OtherId/review' },
    })
    expect(reassignment.response.status).toBe(409)

    const businessId = assigned.payload.qr.business_id
    const beforeEdit = await request(`/r/${qr.id}`)
    expect(beforeEdit.response.status).toBe(200)
    expect(beforeEdit.response.headers.get('content-type')).toContain('text/html')
    const publicDetails = await request(`/api/public/qrs/${qr.id}`, { authenticated: false })
    expect(publicDetails.response.status).toBe(200)
    expect(publicDetails.payload.business_name).toBe('Danish Smile Care')
    expect(publicDetails.payload.category).toBe('dental')
    expect(publicDetails.payload.destination_url).toBe('https://g.page/r/PlaceId/review')

    await request(`/api/businesses/${businessId}`, {
      method: 'PUT',
      body: { name: 'Danish Smile Care', review_url: 'https://search.google.com/local/writereview?placeid=NewPlace' },
    })
    const afterEdit = await request(`/r/${qr.id}`)
    expect(afterEdit.response.status).toBe(200)
    const updatedPublicDetails = await request(`/api/public/qrs/${qr.id}`, { authenticated: false })
    expect(updatedPublicDetails.payload.destination_url).toBe(
      'https://search.google.com/local/writereview?placeid=NewPlace',
    )

    const unconfirmedReset = await request(`/api/qrs/${qr.id}/reset`, {
      method: 'POST',
      body: { confirm: false },
    })
    expect(unconfirmedReset.response.status).toBe(400)
    const reset = await request(`/api/qrs/${qr.id}/reset`, {
      method: 'POST',
      body: { confirm: true },
    })
    expect(reset.response.status).toBe(200)
    expect((await request(`/r/${qr.id}`)).response.status).toBe(409)

    const logs = (await request('/api/audit')).payload.logs.map((log) => log.action)
    expect(logs).toContain('assign')
    expect(logs).toContain('reset')
  })

  it('rejects cross-origin programming actions and handles disabled QR codes safely', async () => {
    const generated = await request('/api/qrs', { method: 'POST', body: { count: 1 } })
    const qr = generated.payload.qrs[0]
    const forbidden = await request(`/api/qrs/${qr.id}/assign`, {
      method: 'POST',
      body: { name: 'Example', review_url: 'https://g.page/r/Example/review' },
      originHeader: 'https://attacker.example',
    })
    expect(forbidden.response.status).toBe(403)

    await request(`/api/qrs/${qr.id}/assign`, {
      method: 'POST',
      body: { name: 'Example', review_url: 'https://g.page/r/Example/review' },
    })
    const disabled = await request(`/api/qrs/${qr.id}/disable`, { method: 'POST', body: {} })
    expect(disabled.response.status).toBe(200)
    expect((await request(`/r/${qr.id}`)).response.status).toBe(410)
    const enabled = await request(`/api/qrs/${qr.id}/enable`, { method: 'POST', body: {} })
    expect(enabled.payload.status).toBe('assigned')
    expect((await request(`/r/${qr.id}`)).response.status).toBe(200)
  })
})

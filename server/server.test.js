import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAppServer, getClientAddress } from './index.js'
import { openDatabase } from './database.js'
import { getReviewCategories } from '../src/lib/reviewSuggestions.js'

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
    const requestBody = path === '/api/qrs' && method === 'POST'
      ? { ...body, request_id: body?.request_id ?? randomUUID() }
      : body
    const headers = {}
    if (requestBody !== undefined) {
      headers['Content-Type'] = 'application/json'
      headers.Origin = originHeader
    }
    if (authenticated) headers.Cookie = cookie
    const response = await fetch(`${origin}${path}`, {
      method,
      headers,
      ...(requestBody === undefined ? {} : { body: JSON.stringify(requestBody) }),
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
    expect(codes.map((qr) => qr.inventory_code)).toEqual(['RT-0001', 'RT-0002', 'RT-0003', 'RT-0004'])
    expect(codes.every((qr) => qr.status === 'unassigned')).toBe(true)
    expect(codes[0].dynamic_url).toBe(`https://reviews.example/r/${codes[0].id}`)
    expect((await request('/api/qrs')).payload.summary.unassigned).toBe(4)
  })

  it('replays a batch request id without creating duplicate stands and searches inventory codes', async () => {
    const requestId = randomUUID()
    const first = await request('/api/qrs', {
      method: 'POST',
      body: { count: 2, request_id: requestId },
    })
    const repeated = await request('/api/qrs', {
      method: 'POST',
      body: { count: 2, request_id: requestId },
    })

    expect(first.response.status).toBe(201)
    expect(repeated.response.status).toBe(201)
    expect(repeated.payload.qrs).toEqual(first.payload.qrs)
    const matches = await request(`/api/qrs?search=${first.payload.qrs[0].inventory_code}`)
    expect(matches.payload.total).toBe(1)
    expect(matches.payload.qrs[0].id).toBe(first.payload.qrs[0].id)

    const next = await request('/api/qrs', { method: 'POST', body: { count: 1 } })
    expect(next.payload.qrs[0].inventory_code).toBe('RT-0003')
  })

  it('rejects invalid quantities and invalid idempotency request IDs', async () => {
    for (const count of [0, -1, 501, 1.5]) {
      const result = await request('/api/qrs', { method: 'POST', body: { count } })
      expect(result.response.status).toBe(400)
    }

    const invalidRequestId = await request('/api/qrs', {
      method: 'POST',
      body: { count: 1, request_id: 'not-a-uuid' },
    })
    expect(invalidRequestId.response.status).toBe(400)
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

  it('creates businesses with every supported category and rejects invalid category ids', async () => {
    for (const [index, category] of getReviewCategories().entries()) {
      const result = await request('/api/businesses', {
        method: 'POST',
        body: {
          name: `Category Business ${index}`,
          review_url: `https://g.page/r/Place${index}/review`,
          category_id: category.id,
        },
      })

      expect(result.response.status).toBe(201)
      expect(result.payload.business.category_id).toBe(category.id)
      expect(result.payload.business.category_label).toBe(category.label)
    }

    const invalid = await request('/api/businesses', {
      method: 'POST',
      body: {
        name: 'Invalid Category Business',
        review_url: 'https://g.page/r/InvalidPlace/review',
        category_id: 'coffee-shop',
      },
    })
    expect(invalid.response.status).toBe(400)
    expect(invalid.payload.error).toMatch(/valid business category/i)

    const defaulted = await request('/api/businesses', {
      method: 'POST',
      body: {
        name: 'Unspecified Category Business',
        review_url: 'https://g.page/r/UnspecifiedPlace/review',
      },
    })
    expect(defaulted.response.status).toBe(201)
    expect(defaulted.payload.business.category_id).toBe('other-general-business')
  })

  it('updates a business category without changing its id or assigned QR ids', async () => {
    const generated = await request('/api/qrs', { method: 'POST', body: { count: 1 } })
    const qr = generated.payload.qrs[0]
    const assigned = await request(`/api/qrs/${qr.id}/assign`, {
      method: 'POST',
      body: {
        name: 'Category Edit Business',
        review_url: 'https://g.page/r/CategoryPlace/review',
        category_id: 'cafe-restaurant',
      },
    })
    const businessId = assigned.payload.qr.business_id

    const edited = await request(`/api/businesses/${businessId}`, {
      method: 'PUT',
      body: {
        name: 'Category Edit Business',
        review_url: 'https://g.page/r/CategoryPlace/review',
        category_id: 'gaming-cafe',
      },
    })
    expect(edited.response.status).toBe(200)
    expect(edited.payload.business.id).toBe(businessId)
    expect(edited.payload.business.category_id).toBe('gaming-cafe')

    const inventory = await request(`/api/qrs?business_id=${businessId}`)
    expect(inventory.payload.qrs.map((item) => item.id)).toEqual([qr.id])
    expect(inventory.payload.qrs[0].business_id).toBe(businessId)
    const businessList = await request('/api/businesses')
    const business = businessList.payload.businesses.find((item) => item.id === businessId)
    expect(business.category_id).toBe('gaming-cafe')
    expect(business.category_label).toBe('Gaming Cafe')
  })

  it('validates destinations, prevents reassignment, updates redirects, and requires explicit reset', async () => {
    const generated = await request('/api/qrs', { method: 'POST', body: { count: 1 } })
    const qr = generated.payload.qrs[0]
    const invalidBusiness = await request(`/api/qrs/${qr.id}/assign`, {
      method: 'POST',
      body: { business_id: 'missing-business-id' },
    })
    expect(invalidBusiness.response.status).toBe(404)

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
    const unassignedQr = await request('/api/qrs', { method: 'POST', body: { count: 1 } })
    const publicUnassigned = await request(`/api/public/qrs/${unassignedQr.payload.qrs[0].id}`, {
      authenticated: false,
    })
    expect(publicUnassigned.response.status).toBe(409)
    expect(publicUnassigned.payload.error).toMatch(/not been activated yet/i)
    expect(publicUnassigned.payload).not.toHaveProperty('destination_url')
    const publicMalformed = await request('/api/public/qrs/not-a-qr-id', { authenticated: false })
    expect(publicMalformed.response.status).toBe(400)
    const publicMissing = await request('/api/public/qrs/rt-00000000-0000-0000-0000-000000000000', {
      authenticated: false,
    })
    expect(publicMissing.response.status).toBe(404)

    const beforeEdit = await request(`/r/${qr.id}`)
    expect(beforeEdit.response.status).toBe(200)
    expect(beforeEdit.response.headers.get('content-type')).toContain('text/html')
    const publicDetails = await request(`/api/public/qrs/${qr.id}`, { authenticated: false })
    expect(publicDetails.response.status).toBe(200)
    expect(publicDetails.payload.business_name).toBe('Danish Smile Care')
    expect(publicDetails.payload.category_id).toBe('dental-clinic')
    expect(publicDetails.payload.category_label).toBe('Dental Clinic')
    expect(publicDetails.payload.destination_url).toBe('https://g.page/r/PlaceId/review')
    expect(Object.keys(publicDetails.payload).sort()).toEqual([
      'business_name',
      'category_id',
      'category_label',
      'destination_url',
    ])

    await request(`/api/businesses/${businessId}`, {
      method: 'PUT',
      body: {
        name: 'Danish Smile Care',
        review_url: 'https://search.google.com/local/writereview?placeid=NewPlace',
        category_id: 'dental-clinic',
      },
    })
    const afterEdit = await request(`/r/${qr.id}`)
    expect(afterEdit.response.status).toBe(200)
    const updatedPublicDetails = await request(`/api/public/qrs/${qr.id}`, { authenticated: false })
    expect(updatedPublicDetails.payload.category_id).toBe('dental-clinic')
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
    const resetScan = await request(`/r/${qr.id}`)
    expect(resetScan.response.status).toBe(200)
    expect(resetScan.response.headers.get('content-type')).toContain('text/html')
    expect((await request(`/api/public/qrs/${qr.id}`, { authenticated: false })).response.status).toBe(409)

    const logs = (await request('/api/audit')).payload.logs.map((log) => log.action)
    expect(logs).toContain('assign')
    expect(logs).toContain('reset')
  })

  it('allows only one concurrent assignment and keeps the existing QR ID', async () => {
    const [qr] = (await request('/api/qrs', { method: 'POST', body: { count: 1 } })).payload.qrs
    const business = await request('/api/businesses', {
      method: 'POST',
      body: {
        name: 'Existing Client Business',
        review_url: 'https://g.page/r/ClientPlace/review',
        category_id: 'hotel-accommodation',
      },
    })
    const assignmentPath = `/api/qrs/${qr.id}/assign`
    const assignments = await Promise.all([
      request(assignmentPath, { method: 'POST', body: { business_id: business.payload.business.id } }),
      request(assignmentPath, { method: 'POST', body: { business_id: business.payload.business.id } }),
    ])

    expect(assignments.map(({ response }) => response.status).sort()).toEqual([200, 409])
    const publicDetails = await request(`/api/public/qrs/${qr.id}`, { authenticated: false })
    expect(publicDetails.payload).toMatchObject({
      business_name: 'Existing Client Business',
      category_id: 'hotel-accommodation',
      destination_url: 'https://g.page/r/ClientPlace/review',
    })
    const inventory = await request(`/api/qrs?search=${qr.inventory_code}`)
    expect(inventory.payload.qrs[0].id).toBe(qr.id)
    expect(inventory.payload.qrs[0].inventory_code).toBe(qr.inventory_code)
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
    const publicDisabled = await request(`/api/public/qrs/${qr.id}`, { authenticated: false })
    expect(publicDisabled.response.status).toBe(410)
    const disabledScan = await request(`/r/${qr.id}`)
    expect(disabledScan.response.status).toBe(200)
    expect(disabledScan.response.headers.get('content-type')).toContain('text/html')
    const enabled = await request(`/api/qrs/${qr.id}/enable`, { method: 'POST', body: {} })
    expect(enabled.payload.status).toBe('assigned')
    expect((await request(`/r/${qr.id}`)).response.status).toBe(200)
  })

  it('serves the assistant shell for existing QR URLs and resolves each QR independently', async () => {
    const generated = await request('/api/qrs', { method: 'POST', body: { count: 2 } })
    const [firstQr, secondQr] = generated.payload.qrs
    const firstAssignment = await request(`/api/qrs/${firstQr.id}/assign`, {
      method: 'POST',
      body: {
        name: 'Northstar Dental',
        review_url: 'https://g.page/r/NorthstarPlace/review',
        category_id: 'dental-clinic',
      },
    })
    const secondAssignment = await request(`/api/qrs/${secondQr.id}/assign`, {
      method: 'POST',
      body: {
        name: 'Pixel Gaming Cafe',
        review_url: 'https://g.page/r/PixelPlace/review',
        category_id: 'gaming-cafe',
      },
    })

    expect(firstAssignment.payload.qr.id).toBe(firstQr.id)
    expect(secondAssignment.payload.qr.id).toBe(secondQr.id)
    for (const qr of [firstQr, secondQr]) {
      const scan = await request(`/r/${qr.id}`, { authenticated: false })
      expect(scan.response.status).toBe(200)
      expect(scan.response.headers.get('content-type')).toContain('text/html')
      expect(scan.response.headers.get('location')).toBeNull()
    }

    const firstDetails = await request(`/api/public/qrs/${firstQr.id}`, { authenticated: false })
    const secondDetails = await request(`/api/public/qrs/${secondQr.id}`, { authenticated: false })
    expect(firstDetails.payload).toMatchObject({
      business_name: 'Northstar Dental',
      category_id: 'dental-clinic',
      destination_url: 'https://g.page/r/NorthstarPlace/review',
    })
    expect(secondDetails.payload).toMatchObject({
      business_name: 'Pixel Gaming Cafe',
      category_id: 'gaming-cafe',
      destination_url: 'https://g.page/r/PixelPlace/review',
    })

    const malformedScan = await request('/r/not-a-qr-id', { authenticated: false })
    expect(malformedScan.response.status).toBe(200)
    expect(malformedScan.response.headers.get('content-type')).toContain('text/html')
    expect((await request('/api/public/qrs/not-a-qr-id', { authenticated: false })).response.status).toBe(400)
  })

  it('does not return an invalid saved destination from the public endpoint', async () => {
    const generated = await request('/api/qrs', { method: 'POST', body: { count: 1 } })
    const qr = generated.payload.qrs[0]
    const assigned = await request(`/api/qrs/${qr.id}/assign`, {
      method: 'POST',
      body: {
        name: 'Invalid Destination Business',
        review_url: 'https://g.page/r/ValidPlace/review',
        category_id: 'other-general-business',
      },
    })
    const database = openDatabase(databasePath)
    database.prepare('UPDATE businesses SET review_url = ? WHERE id = ?')
      .run('https://untrusted.example/review', assigned.payload.qr.business_id)
    database.close()

    const publicDetails = await request(`/api/public/qrs/${qr.id}`, { authenticated: false })
    expect(publicDetails.response.status).toBe(500)
    expect(publicDetails.payload).not.toHaveProperty('destination_url')
  })
})

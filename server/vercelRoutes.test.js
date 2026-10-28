import { describe, expect, it } from 'vitest'
import { rewriteApiRequest } from '../api/index.js'
import { rewriteRedirectRequest } from '../api/redirect.js'

describe('Vercel function route adapters', () => {
  it('restores the requested API path and preserves endpoint query parameters', () => {
    const request = {
      url: '/api?path=qrs&status=unassigned&search=coffee',
      headers: { host: 'reviews.example' },
      query: { path: 'qrs' },
    }

    rewriteApiRequest(request)

    expect(request.url).toBe('/api/qrs?status=unassigned&search=coffee')
  })

  it('restores the assistant scan path without changing the existing QR ID', () => {
    const request = {
      url: '/api/redirect?qrId=rt-123',
      headers: { host: 'reviews.example' },
      query: { qrId: 'rt-123' },
    }

    rewriteRedirectRequest(request)

    expect(request.url).toBe('/r/rt-123?qrId=rt-123')
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { adminApi } from './adminApi'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('adminApi error messages', () => {
  it('explains how to recover when the backend cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(adminApi('/api/auth/session')).rejects.toThrow(
      /start it with "npm run dev:server" in a second terminal/i,
    )
  })

  it('reports a non-JSON backend response with its HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 502,
      headers: new Headers({ 'content-type': 'text/html' }),
    }))

    await expect(adminApi('/api/auth/session')).rejects.toThrow(
      /unexpected response \(HTTP 502\).*npm run dev:server/i,
    )
  })

  it('returns API errors sent as JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers({ 'content-type': 'application/json; charset=utf-8' }),
      json: vi.fn().mockResolvedValue({ error: 'Sign in to manage QR codes.' }),
    }))

    await expect(adminApi('/api/qrs')).rejects.toThrow('Sign in to manage QR codes.')
  })
})

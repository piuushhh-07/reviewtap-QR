import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateQrCode } from '../lib/generateQrCode'
import { AdminDashboard } from './AdminDashboard'
import { getReviewCategories } from '../lib/reviewSuggestions'

vi.mock('../lib/generateQrCode', () => ({
  generateQrCode: vi.fn(async () => 'data:image/png;base64,test-qr'),
}))

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => payload,
  }
}

describe('admin business categories', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows saved and fallback categories and allows selecting any category when editing', async () => {
    const businesses = [
      {
        id: 'business-gaming',
        name: 'Gaming Supply',
        category: 'other',
        category_id: 'gaming-cafe',
        category_label: 'Gaming Cafe',
        review_url: 'https://g.page/r/GamingPlace/review',
        qr_count: 2,
      },
      {
        id: 'business-legacy',
        name: 'Legacy Shop',
        category: 'retail',
        review_url: 'https://g.page/r/LegacyPlace/review',
        qr_count: 0,
      },
    ]
    const requests = []
    vi.stubGlobal('fetch', vi.fn(async (path, options = {}) => {
      requests.push({ path, options })
      if (path === '/api/auth/session') return jsonResponse({ authenticated: true })
      if (String(path).startsWith('/api/qrs?')) {
        return jsonResponse({ qrs: [], total: 0, summary: { unassigned: 0, assigned: 0, disabled: 0 } })
      }
      if (path === '/api/businesses') return jsonResponse({ businesses })
      if (path === '/api/businesses/business-gaming' && options.method === 'PUT') {
        const update = JSON.parse(options.body)
        const category = getReviewCategories().find(({ id }) => id === update.category_id)
        Object.assign(businesses[0], update, { category_label: category.label })
        return jsonResponse({ business: businesses[0] })
      }
      throw new Error(`Unexpected API request: ${path}`)
    }))

    render(<AdminDashboard />)
    await screen.findByText('QR inventory')
    fireEvent.click(screen.getByRole('tab', { name: 'Businesses' }))

    const gamingCard = (await screen.findByText('Gaming Supply')).closest('article')
    expect(within(gamingCard).getByText('Gaming Cafe')).toBeInTheDocument()
    const legacyCard = screen.getByText('Legacy Shop').closest('article')
    expect(within(legacyCard).getByText('Other / General Business')).toBeInTheDocument()

    fireEvent.click(within(gamingCard).getByRole('button', { name: 'Edit' }))
    const categorySelect = screen.getByLabelText('Business category')
    expect(categorySelect).toHaveValue('gaming-cafe')
    expect([...categorySelect.options].map((option) => option.value)).toEqual(
      getReviewCategories().map(({ id }) => id),
    )

    fireEvent.change(categorySelect, { target: { value: 'gym-fitness' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      const update = requests.find(({ path, options }) => (
        path === '/api/businesses/business-gaming' && options.method === 'PUT'
      ))
      expect(update).toBeDefined()
      expect(JSON.parse(update.options.body)).toMatchObject({
        name: 'Gaming Supply',
        category_id: 'gym-fitness',
      })
    })
    await screen.findByText('Gym / Fitness')
    fireEvent.click(screen.getByRole('button', { name: 'Add business' }))
    const newBusinessCategory = screen.getByLabelText('Business category')
    expect(newBusinessCategory).toHaveValue('other-general-business')
    expect([...newBusinessCategory.options]).toHaveLength(10)
  })

  it('accepts the exact search.google.com review URL in the business form', async () => {
    const requests = []
    vi.stubGlobal('fetch', vi.fn(async (path, options = {}) => {
      requests.push({ path, options })
      if (path === '/api/auth/session') return jsonResponse({ authenticated: true })
      if (String(path).startsWith('/api/qrs?')) {
        return jsonResponse({ qrs: [], total: 0, summary: { unassigned: 0, assigned: 0, disabled: 0 } })
      }
      if (path === '/api/businesses' && options.method === 'POST') {
        return jsonResponse({ business: { id: 'business-review-link' } }, 201)
      }
      if (path === '/api/businesses') return jsonResponse({ businesses: [] })
      throw new Error(`Unexpected API request: ${path}`)
    }))

    render(<AdminDashboard />)
    await screen.findByText('QR inventory')
    fireEvent.click(screen.getByRole('tab', { name: 'Businesses' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Add business' }))

    fireEvent.change(screen.getByLabelText('Business name'), { target: { value: 'Review Link Test' } })
    fireEvent.change(screen.getByPlaceholderText('https://g.page/r/...'), {
      target: { value: 'https://search.google.com/local/writereview?placeid=ChIJU41UUYCT5zsRd4Da_IpmAM4' },
    })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add business' }))

    await waitFor(() => {
      const creation = requests.find(({ path, options }) => path === '/api/businesses' && options.method === 'POST')
      expect(creation).toBeDefined()
      expect(JSON.parse(creation.options.body).review_url)
        .toBe('https://search.google.com/local/writereview?placeid=ChIJU41UUYCT5zsRd4Da_IpmAM4')
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('generates a retry-safe batch and prints its stable codes with the logo and permanent QR URLs', async () => {
    const requests = []
    let inventory = []
    const generated = Array.from({ length: 20 }, (_, index) => ({
      id: `rt-00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      inventory_code: `RT-${String(index + 1).padStart(4, '0')}`,
      status: 'unassigned',
      created_at: '2026-01-01T00:00:00.000Z',
      dynamic_url: `https://reviews.example/r/rt-00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    }))
    const printDocument = { write: vi.fn(), close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue({ document: printDocument, close: vi.fn() })
    vi.stubGlobal('fetch', vi.fn(async (path, options = {}) => {
      requests.push({ path, options })
      if (path === '/api/auth/session') return jsonResponse({ authenticated: true })
      if (String(path).startsWith('/api/qrs?')) {
        return jsonResponse({
          qrs: inventory,
          total: inventory.length,
          summary: { unassigned: inventory.length, assigned: 0, disabled: 0 },
        })
      }
      if (path === '/api/businesses') return jsonResponse({ businesses: [] })
      if (path === '/api/qrs' && options.method === 'POST') {
        inventory = generated
        return jsonResponse({ qrs: generated }, 201)
      }
      throw new Error(`Unexpected API request: ${path}`)
    }))

    render(<AdminDashboard />)
    await screen.findByText('QR inventory')
    fireEvent.change(screen.getByLabelText('New QR codes'), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate codes' }))

    expect(await screen.findByText(/RT-0001, RT-0002/)).toBeInTheDocument()
    const generation = requests.find(({ path, options }) => path === '/api/qrs' && options.method === 'POST')
    expect(JSON.parse(generation.options.body)).toMatchObject({
      count: 20,
      request_id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    })

    fireEvent.click(screen.getByRole('button', { name: 'Print last batch' }))
    await waitFor(() => expect(printDocument.write).toHaveBeenCalledOnce())
    const printMarkup = printDocument.write.mock.calls[0][0]
    expect(printMarkup).toContain('/reviewtap-logo.png')
    expect(printMarkup).toContain('Scan to leave a review.')
    expect(printMarkup).toContain('RT-0001')
    expect(generateQrCode).toHaveBeenCalledWith(generated[0].dynamic_url)
    expect(printMarkup).toContain('@page{size:A4 portrait')
    expect(printMarkup).toContain('width:44mm;height:44mm')
  })
})

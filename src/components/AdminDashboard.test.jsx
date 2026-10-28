import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdminDashboard } from './AdminDashboard'
import { getReviewCategories } from '../lib/reviewSuggestions'

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
})

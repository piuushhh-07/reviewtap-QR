import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReviewAssistant } from './ReviewAssistant'
import { getReviewCategories, getReviewSuggestions } from '../lib/reviewSuggestions'
import App from '../App'

const qrId = 'rt-11111111-1111-4111-8111-111111111111'
const businessData = {
  business_name: 'Northstar Dental',
  category_id: 'dental-clinic',
  category_label: 'Dental Clinic',
  destination_url: 'https://g.page/r/NorthstarPlace/review',
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }
}

function selectTopic(topic) {
  return screen.getByRole('button', { name: new RegExp(topic, 'i') })
}

async function openTopics() {
  await screen.findByRole('heading', { level: 1 })
  if (screen.queryByRole('heading', { name: 'What would you like to mention?' })) return
  fireEvent.click(screen.getByRole('button', { name: /choose topics/i }))
  await screen.findByRole('heading', { name: 'What would you like to mention?' })
}

describe('ReviewAssistant', () => {
  let fetchMock
  let originalClipboard

  beforeEach(() => {
    window.history.pushState({}, '', `/r/${qrId}`)
    originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    fetchMock = vi.fn().mockResolvedValue(jsonResponse(businessData))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    if (originalClipboard) {
      Object.defineProperty(navigator, 'clipboard', originalClipboard)
    } else {
      delete navigator.clipboard
    }
    vi.restoreAllMocks()
  })

  it('loads the QR business and displays the saved category suggestion catalogue', async () => {
    render(<ReviewAssistant />)

    expect(await screen.findByRole('heading', { name: 'Northstar Dental' })).toBeInTheDocument()
    expect(screen.getByText('Your experience matters')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/public/qrs/${qrId}`,
      expect.objectContaining({ signal: expect.anything() }),
    )
    expect(screen.getByText(/Northstar Dental/)).toBeInTheDocument()
    expect(screen.getByText('Dental Clinic')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Powered by')
    expect(screen.getByRole('contentinfo')).toHaveTextContent('AIRNOXAE TECHNOLOGIES')
    await openTopics()
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(
      getReviewSuggestions('dental-clinic').length,
    )
    expect(getReviewCategories().some(({ id }) => id === 'dental-clinic')).toBe(true)
    expect(screen.getByText(/Pick any topics that reflect your visit/i)).toBeInTheDocument()
  })

  it('routes customer QR scans to the assistant page', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Northstar Dental' })).toBeInTheDocument()
  })

  it('loads the business, category, and Google destination for the exact scanned QR ID', async () => {
    const secondQrId = 'rt-22222222-2222-4222-8222-222222222222'
    const secondBusiness = {
      business_name: 'Pixel Gaming Cafe',
      category_id: 'gaming-cafe',
      category_label: 'Gaming Cafe',
      destination_url: 'https://g.page/r/PixelPlace/review',
    }
    window.history.pushState({}, '', `/r/${secondQrId}`)
    fetchMock.mockResolvedValueOnce(jsonResponse(secondBusiness))

    render(<ReviewAssistant />)

    expect(await screen.findByRole('heading', { name: 'Pixel Gaming Cafe' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/public/qrs/${secondQrId}`,
      expect.objectContaining({ signal: expect.anything() }),
    )
    expect(screen.getByText('Gaming Cafe')).toBeInTheDocument()
    await openTopics()
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(
      getReviewSuggestions('gaming-cafe').length,
    )
    fireEvent.click(screen.getByRole('button', { name: /range of available games/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Create my draft' }))
    expect(await screen.findByRole('link', { name: /continue to google reviews/i }))
      .toHaveAttribute('href', secondBusiness.destination_url)
  })

  it('lets customers select and deselect topics and blocks an unsupported empty draft', async () => {
    render(<ReviewAssistant />)

    await openTopics()
    const topic = await screen.findByRole('button', { name: /cleanliness of the treatment rooms/i })
    fireEvent.click(topic)
    expect(topic).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(topic)
    expect(screen.getByRole('button', { name: /cleanliness of the treatment rooms/i }))
      .toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Create my draft' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/choose at least one topic or add a detail/i)
    expect(screen.queryByRole('heading', { name: 'Make it yours' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/add a detail in your own words/i), {
      target: { value: 'The service took longer than planned & the room felt <quiet>.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create my draft' }))
    const draft = await screen.findByRole('textbox', { name: /Editable review draft/ })
    expect(draft.value).toContain('The service took longer than planned & the room felt <quiet>.')
    expect(draft.value).not.toContain('aspects I’d like to mention')
  })

  it.each([
    [1, 'What needs attention', 'very poor', 'Thank you for being honest. Your feedback can help highlight what needs attention.'],
    [2, 'Main disappointment', 'disappointing', 'Thanks for sharing. A little context can help make your feedback useful.'],
    [3, 'What worked well', 'mixed', 'A balanced perspective matters. Share what worked and what could improve.'],
    [4, 'What went well', 'good', 'Lovely to hear. Tell us what made your visit a good one.'],
    [5, 'What stood out about the experience', 'excellent', 'Wonderful! What made this experience stand out for you?'],
  ])('offers an optional accessible %i-star rating without restricting review access', async (value, prompt, tone, message) => {
    render(<ReviewAssistant />)

    const ratingLabel = `${value} ${value === 1 ? 'star' : 'stars'}`
    const rating = await screen.findByRole('radio', { name: ratingLabel })
    expect(rating).not.toBeChecked()
    fireEvent.click(rating)

    expect(rating).toBeChecked()
    expect(rating.closest('fieldset')).toHaveClass(`review-rating--rating-${value}`)
    expect(screen.getByText(message)).toBeInTheDocument()
    expect(screen.getByText(`${value} out of 5 selected. You can still share any kind of feedback.`)).toBeInTheDocument()
    await openTopics()
    expect(screen.getByRole('button', { name: 'What could be improved' })).toBeInTheDocument()
    const reflectionPrompt = screen.getByRole('button', { name: prompt })
    expect(reflectionPrompt).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(reflectionPrompt)
    fireEvent.click(screen.getByRole('button', { name: 'Create my draft' }))

    const continueLink = await screen.findByRole('link', { name: /continue to google reviews/i })
    const draft = screen.getByRole('textbox', { name: /Editable review draft/ })
    expect(continueLink).toHaveAttribute('href', businessData.destination_url)
    fireEvent.click(continueLink)
    expect(draft).toBeInTheDocument()
    expect(screen.getByText('Review and copy').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    )
    expect(screen.getByRole('textbox', { name: /Editable review draft/ }).value).toContain(
      `${tone} experience`,
    )
  })

  it('keeps low-rating feedback visible, selectable, and accurate after switching ratings', async () => {
    render(<ReviewAssistant />)

    fireEvent.click(await screen.findByRole('radio', { name: '2 stars' }))
    await openTopics()
    fireEvent.click(screen.getByRole('button', { name: 'Main disappointment' }))
    expect(screen.getByRole('button', { name: 'Main disappointment' }))
      .toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Change rating' }))
    fireEvent.click(screen.getByRole('radio', { name: '5 stars' }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose topics' }))
    const retainedTopic = screen.getByRole('button', { name: /main disappointment/i })
    expect(retainedTopic).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Not suggested for this rating')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Change rating' }))
    fireEvent.click(screen.getByRole('radio', { name: '4 stars' }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose topics' }))
    fireEvent.click(screen.getByRole('button', { name: 'Change rating' }))
    fireEvent.click(screen.getByRole('radio', { name: '1 star' }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose topics' }))
    expect(screen.getByText('1 selected')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /main disappointment/i })).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /dentist communication during the visit/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Create my draft' }))
    let draft = await screen.findByRole('textbox', { name: /Editable review draft/ })
    expect(draft.value).toContain('main disappointment')
    expect(draft.value).toContain('dentist communication during the visit')

    fireEvent.click(screen.getByRole('button', { name: 'Back to topics' }))
    fireEvent.click(screen.getByRole('button', { name: /main disappointment/i }))
    expect(screen.getByText('1 selected')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Update draft' }))
    draft = screen.getByRole('textbox', { name: /Editable review draft/ })
    expect(draft.value).not.toContain('main disappointment')
    expect(draft.value).toContain('dentist communication during the visit')
  })

  it('does not duplicate selected topics when ratings are switched repeatedly', async () => {
    render(<ReviewAssistant />)

    fireEvent.click(await screen.findByRole('radio', { name: '1 star' }))
    await openTopics()
    fireEvent.click(screen.getByRole('button', { name: 'What could be improved' }))
    fireEvent.click(screen.getByRole('button', { name: 'Change rating' }))
    fireEvent.click(screen.getByRole('radio', { name: '5 stars' }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose topics' }))
    fireEvent.click(screen.getByRole('button', { name: 'Change rating' }))
    fireEvent.click(screen.getByRole('radio', { name: '3 stars' }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose topics' }))
    fireEvent.click(screen.getByRole('button', { name: 'Change rating' }))
    fireEvent.click(screen.getByRole('radio', { name: '2 stars' }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose topics' }))

    expect(screen.getByText('1 selected')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /what could be improved/i })).toHaveLength(1)
  })

  it.each([
    ['custom-hvac-service', 'Other / General Business'],
    [undefined, 'Other / General Business'],
  ])('uses the general suggestion fallback for missing or unknown category %s', async (categoryId, label) => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      ...businessData,
      category_id: categoryId,
    }))
    render(<ReviewAssistant />)

    expect(await screen.findByText(label)).toBeInTheDocument()
    await openTopics()
    expect(screen.getByRole('button', { name: /overall service experience/i })).toBeInTheDocument()
  })

  it('supports keyboard selection for the accessible rating controls', async () => {
    render(<ReviewAssistant />)

    const firstRating = await screen.findByRole('radio', { name: '1 star' })
    firstRating.focus()
    await userEvent.keyboard('{ArrowRight}')

    expect(screen.getByRole('radio', { name: '2 stars' })).toBeChecked()
  })

  it('lets customers move back without losing their rating, topics, or details', async () => {
    render(<ReviewAssistant />)

    fireEvent.click(await screen.findByRole('radio', { name: '3 stars' }))
    await openTopics()
    fireEvent.click(screen.getByRole('button', { name: /time spent waiting for the appointment/i }))
    fireEvent.change(screen.getByLabelText(/add a detail in your own words/i), {
      target: { value: 'The visit was straightforward.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByRole('radio', { name: '3 stars' })).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: /choose topics/i }))
    expect(screen.getByRole('button', { name: /time spent waiting for the appointment/i }))
      .toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText(/add a detail in your own words/i))
      .toHaveValue('The visit was straightforward.')
  })

  it('lets customers clear selections and return to topic choices without losing draft edits', async () => {
    render(<ReviewAssistant />)

    await openTopics()
    const topic = await screen.findByRole('button', { name: /cleanliness of the treatment rooms/i })
    fireEvent.click(topic)
    fireEvent.click(screen.getByRole('button', { name: 'Create my draft' }))
    const draft = await screen.findByRole('textbox', { name: /Editable review draft/ })
    fireEvent.change(draft, { target: { value: 'My words should stay here.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Back to topics' }))

    expect(screen.getByRole('heading', { name: /what would you like to mention/i })).toHaveFocus()
    expect(draft).toHaveValue('My words should stay here.')
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(screen.getByRole('button', { name: /cleanliness of the treatment rooms/i }))
      .toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('0 selected')).toBeInTheDocument()
    expect(draft).toHaveValue('My words should stay here.')
  })

  it('updates the draft after changing the rating while preserving selected feedback', async () => {
    render(<ReviewAssistant />)

    fireEvent.click(await screen.findByRole('radio', { name: '2 stars' }))
    await openTopics()
    fireEvent.click(screen.getByRole('button', { name: 'Main disappointment' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create my draft' }))
    expect(await screen.findByRole('button', { name: 'Copy review' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Back to topics' }))
    fireEvent.click(screen.getByRole('button', { name: 'Change rating' }))
    fireEvent.click(screen.getByRole('radio', { name: '5 stars' }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose topics' }))
    fireEvent.click(screen.getByRole('button', { name: 'Update draft' }))
    const updatedDraft = await screen.findByRole('textbox', { name: /Editable review draft/ })
    expect(updatedDraft.value).toContain('excellent experience')
    expect(updatedDraft.value).toContain('main disappointment')
    expect(screen.getByRole('button', { name: 'Copy review' })).toBeEnabled()
  })

  it('builds a modest editable draft from the selected topics and customer details only', async () => {
    render(<ReviewAssistant />)

    await openTopics()
    fireEvent.click(await screen.findByRole('button', { name: /time spent waiting for the appointment/i }))
    fireEvent.click(selectTopic('clarity of cost estimates'))
    fireEvent.change(screen.getByLabelText(/add a detail in your own words/i), {
      target: { value: 'The appointment started later than expected.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create my draft' }))

    const draft = await screen.findByRole('textbox', { name: /Editable review draft/ })
    expect(draft.value).toContain('Northstar Dental')
    expect(draft.value).toContain('time spent waiting for the appointment')
    expect(draft.value).toContain('clarity of cost estimates')
    expect(draft.value).toContain('The appointment started later than expected.')
    expect(draft.value).not.toMatch(/the dentist was|the treatment cured|staff resolved/i)
    expect(screen.getByRole('link', { name: /continue to google reviews/i })).toHaveAttribute(
      'href',
      businessData.destination_url,
    )
  })

  it('keeps customer edits and selections when the draft is regenerated', async () => {
    render(<ReviewAssistant />)

    await openTopics()
    const topic = await screen.findByRole('button', { name: /support from dental nurses/i })
    fireEvent.click(topic)
    fireEvent.change(screen.getByLabelText(/add a detail in your own words/i), {
      target: { value: 'I would mention the clear appointment reminders.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create my draft' }))

    const draft = await screen.findByRole('textbox', { name: /Editable review draft/ })
    fireEvent.change(draft, { target: { value: 'My edited draft.' } })
    expect(draft).toHaveValue('My edited draft.')
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate draft' }))

    await waitFor(() => {
      expect(draft.value).not.toBe('My edited draft.')
    })
    expect(draft.value).toContain('support from dental nurses')
    expect(draft.value).toContain('I would mention the clear appointment reminders.')
    fireEvent.click(screen.getByRole('button', { name: 'Back to topics' }))
    expect(screen.getByRole('button', { name: /support from dental nurses/i }))
      .toHaveAttribute('aria-pressed', 'true')
  })

  it('announces successful clipboard copying and handles clipboard failures', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    render(<ReviewAssistant />)

    await openTopics()
    fireEvent.click(await screen.findByRole('button', { name: /dentist communication during the visit/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Create my draft' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Copy review' }))
    expect(await screen.findByRole('status')).toHaveTextContent(/draft copied to your clipboard/i)
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Northstar Dental'))

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('Permission denied')) },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Copy review' }))
    expect(await screen.findByRole('status')).toHaveTextContent(/copy was blocked/i)
  })

  it('prevents duplicate clipboard requests while copying is pending', async () => {
    let finishCopy
    const writeText = vi.fn(() => new Promise((resolve) => {
      finishCopy = resolve
    }))
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    render(<ReviewAssistant />)

    await openTopics()
    fireEvent.click(await screen.findByRole('button', { name: /dentist communication during the visit/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Create my draft' }))
    const copyButton = await screen.findByRole('button', { name: 'Copy review' })
    fireEvent.click(copyButton)
    expect(await screen.findByRole('button', { name: 'Copying…' })).toBeDisabled()
    expect(writeText).toHaveBeenCalledTimes(1)

    finishCopy()
    expect(await screen.findByRole('button', { name: 'Copy review' })).toBeEnabled()
  })

  it('shows a retryable timeout message when the business request is too slow', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation((_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        const error = new Error('Aborted')
        error.name = 'AbortError'
        reject(error)
      })
    }))
    render(<ReviewAssistant />)

    expect(screen.getByRole('contentinfo')).toHaveTextContent('AIRNOXAE TECHNOLOGIES')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000)
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/taking longer than expected/i)
    vi.useRealTimers()
  })

  it('offers a clear loading and retry state for network failures', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network unavailable'))
    render(<ReviewAssistant />)

    expect(await screen.findByRole('heading', { name: /review link is unavailable/i })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/check your internet connection/i)
    fetchMock.mockResolvedValueOnce(jsonResponse(businessData))
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Northstar Dental' })).toBeInTheDocument()
  })

  it('continues to the exact Google destination from this QR', async () => {
    render(<ReviewAssistant />)

    await openTopics()
    fireEvent.click(await screen.findByRole('button', { name: /help with dental anxiety/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Create my draft' }))
    const continueLink = await screen.findByRole('link', { name: /continue to google reviews/i })
    expect(continueLink).toHaveAttribute('href', businessData.destination_url)
    expect(continueLink).toHaveAttribute('target', '_blank')
  })

  it('shows a friendly message for an unavailable QR ID', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'QR code not found.' }, 404))
    render(<ReviewAssistant />)

    expect(await screen.findByRole('heading', { name: /review link is unavailable/i })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/scan a current reviewtap code/i)
    expect(screen.getByRole('contentinfo')).toHaveTextContent('AIRNOXAE TECHNOLOGIES')
  })

  it.each([
    [400, /scan a current reviewtap code/i],
    [409, /not been activated yet/i],
    [410, /currently unavailable/i],
    [500, /try again in a moment/i],
  ])('shows a friendly assistant error for API status %i', async (status, message) => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'The QR is unavailable.' }, status))
    render(<ReviewAssistant />)

    expect(await screen.findByRole('heading', { name: /review link is unavailable/i })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(message)
  })
})

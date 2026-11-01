import { describe, expect, it } from 'vitest'
import { createReviewDraft, hasReviewDraftAlternatives } from './reviewDraft'

describe('createReviewDraft', () => {
  it('does not insert the selected numerical rating or a repetitive rating introduction', () => {
    const draft = createReviewDraft({
      businessName: 'Northstar Dental',
      topics: ['What went well'],
      offerings: [],
      details: 'The appointment reminders were clear.',
      rating: 5,
    })

    expect(draft).toBe('The appointment reminders were clear.')
    expect(draft).not.toMatch(/(?:\b[1-5]\s*out of\s*5\b|I.d rate my experience|my experience was|overall)/i)
    expect(draft).not.toContain('Northstar Dental')
  })

  it.each([
    [1, 'I was really unhappy with the visit.'],
    [2, 'I was disappointed with the visit.'],
    [3, 'My visit was okay, though some things could have been better.'],
    [4, 'It was a pretty good visit.'],
    [5, 'I really enjoyed the visit.'],
  ])('uses concise, rating-appropriate wording for a %i-star rating alone', (rating, expected) => {
    const draft = createReviewDraft({
      topics: [],
      offerings: [],
      details: '',
      rating,
    })

    expect(draft).toBe(expected)
    expect(draft).not.toMatch(/\b[1-5]\s*out of\s*5\b/)
  })

  it.each([
    [1, /disappointed|wasn.t happy/i],
    [2, /disappointed|could have been better/i],
    [3, /mixed|wasn.t sure/i],
    [4, /liked|enjoyed/i],
    [5, /really enjoyed|especially liked/i],
  ])('uses the %i-star rating as tone without turning a topic into a made-up story', (rating, tone) => {
    const draft = createReviewDraft({
      topics: ['Staff behaviour'],
      offerings: [],
      details: '',
      rating,
    })

    expect(draft).toMatch(tone)
    expect(draft).not.toMatch(/ignored|helped|recommended|resolved/i)
    expect(draft).not.toMatch(/\b[1-5]\s*out of\s*5\b/)
    expect(draft).toMatch(/^[A-Z].*[.!?]$/)
  })

  it('preserves personal details and mentions only explicitly selected offerings and topics', () => {
    const detail = 'The staff helped us choose dishes and were really friendly.'
    const draft = createReviewDraft({
      topics: ['Staff behaviour'],
      offerings: ['Dine-in'],
      details: detail,
      rating: 5,
    })

    expect(draft).toContain(detail)
    expect(draft).toContain('dine-in')
    expect(draft).not.toMatch(/recommended the pasta|brought us water|visited again/i)
    expect(draft.match(/staff/gi)).toHaveLength(1)
  })

  it('keeps negative and mixed details accurate without adding positive claims', () => {
    const details = 'We waited almost 40 minutes for our order, and it was frustrating.'
    const draft = createReviewDraft({
      topics: ['Waiting time'],
      offerings: ['Dine-in'],
      details,
      rating: 2,
    })

    expect(draft).toContain(details)
    expect(draft).toContain('dine-in')
    expect(draft).toContain('frustrating')
    expect(draft).not.toMatch(/delicious|friendly staff|would happily visit again|highly recommend/i)
  })

  it('creates structurally different alternatives without changing the supplied facts', () => {
    const input = {
      topics: ['Waiting time'],
      offerings: ['Dine-in'],
      details: 'We waited almost 40 minutes for our order.',
      rating: 2,
    }
    const first = createReviewDraft(input, 0)
    const second = createReviewDraft(input, 1, first)
    const third = createReviewDraft(input, 2, second)

    expect(new Set([first, second, third]).size).toBe(3)
    for (const draft of [first, second, third]) {
      expect(draft).toContain(input.details)
      expect(draft).toContain('dine-in')
      expect(draft).not.toContain('waiting time')
      expect(draft).not.toMatch(/\b[1-5]\s*out of\s*5\b/)
    }
    expect(hasReviewDraftAlternatives(input)).toBe(true)
    expect(createReviewDraft(input, 2, first)).not.toBe(first)
  })

  it('uses the customer’s own wording without a generic introduction when no topic is selected', () => {
    const details = 'I waited, then asked & was told “not yet <maybe>”'
    const draft = createReviewDraft({
      topics: [],
      offerings: [],
      details,
      rating: 1,
    })

    expect(draft).toBe(`${details}.`)
    expect(draft).not.toContain('undefined')
    expect(hasReviewDraftAlternatives({ topics: [], offerings: [], details, rating: 1 })).toBe(false)
  })

  it('keeps short, honest suggestions for topic-only or low-information input', () => {
    const draft = createReviewDraft({
      topics: ['Staff behaviour'],
      offerings: [],
      details: '',
      rating: null,
    })

    expect(draft).toBe('I wanted to mention staff behaviour.')
    expect(draft).not.toMatch(/ignored|helped|recommended|resolved/i)
    expect(draft).toMatch(/[.!?]$/)
  })

  it('does not repeat a selected topic already described by the customer', () => {
    const draft = createReviewDraft({
      topics: ['Staff friendliness'],
      offerings: [],
      details: 'The staff were friendly and helpful.',
      rating: 5,
    })

    expect(draft).toBe('The staff were friendly and helpful.')
  })

  it('does not include boilerplate, promotional, incentivized, or keyword-stuffed copy', () => {
    const draft = createReviewDraft({
      topics: ['Food freshness'],
      offerings: ['Takeaway'],
      details: 'The food was fresh and still warm when I got home.',
      rating: 4,
    })

    expect(draft).not.toMatch(/highly recommend|unforgettable|discount|reward|special offer|#|https?:\/\//i)
    expect(draft.match(/food/gi)).toHaveLength(1)
  })
})

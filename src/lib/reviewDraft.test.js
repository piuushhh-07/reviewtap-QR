import { describe, expect, it } from 'vitest'
import {
  createReviewDraft,
  createReviewDraftAlternatives,
  hasReviewDraftAlternatives,
} from './reviewDraft'

describe('createReviewDraft', () => {
  it('does not insert the selected numerical rating or a repetitive rating introduction', () => {
    const draft = createReviewDraft({
      businessName: 'Northstar Dental',
      topics: ['What went well'],
      offerings: [],
      details: 'The appointment reminders were clear.',
      rating: 5,
    })

    expect(draft).toContain('The appointment reminders were clear.')
    expect(draft).toMatch(/enjoyed|loved|happy/i)
    expect(draft).not.toMatch(/(?:\b[1-5]\s*out of\s*5\b|I.d rate my experience|my experience was|overall)/i)
    expect(draft).not.toContain('Northstar Dental')
  })

  it.each([
    [1, 'I was really unhappy with my visit.'],
    [2, 'I was disappointed with my visit.'],
    [3, 'I had mixed feelings about my visit.'],
    [4, 'I had a pretty good visit.'],
    [5, 'I really enjoyed my visit.'],
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
    [1, /disappointed|unhappy/i],
    [2, /disappointed|could have been better/i],
    [3, /mixed|wasn.t sure/i],
    [4, /liked|enjoyed|pretty good/i],
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

    expect(draft).toContain(`${details}.`)
    expect(draft).toMatch(/unhappy|disappointed/i)
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

    expect(draft).toBe('I’d also like to mention staff behaviour.')
    expect(createReviewDraft({
      topics: ['Staff behaviour'],
      offerings: [],
      details: '',
      rating: null,
    }, 1)).toBe('One thing I’d mention is staff behaviour.')
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

    expect(draft).toContain('The staff were friendly and helpful.')
    expect(draft.match(/staff/gi)).toHaveLength(1)
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

describe('createReviewDraftAlternatives', () => {
  it('creates three distinct, editable styles that preserve all supplied facts', () => {
    const input = {
      rating: 2,
      topics: ['Waiting time'],
      offerings: ['Dine-in'],
      details: 'We waited almost 40 minutes for our order, and it was frustrating.',
      experienceTerm: 'meal',
    }
    const alternatives = createReviewDraftAlternatives(input)
    const drafts = alternatives.map(({ draft }) => draft)

    expect(alternatives.map(({ style }) => style)).toEqual(['Warm', 'Casual', 'Short'])
    expect(new Set(drafts).size).toBe(3)
    for (const draft of drafts) {
      expect(draft).toContain(input.details)
      expect(draft).toMatch(/dine-in/i)
      expect(draft).not.toMatch(/\b[1-5]\s*out of\s*5\b/i)
      expect(draft).not.toMatch(/highly recommend|unforgettable|delicious/i)
      expect(draft).toMatch(/^[A-Z].*[.!?]$/)
      expect(draft).not.toMatch(/[.!?]{2}/)
    }
  })

  it.each([
    [1, /unhappy|disappointed/i],
    [2, /disappointed|could have gone better/i],
    [3, /mixed|okay|room for improvement/i],
    [4, /pretty good|happy|enjoyed/i],
    [5, /really enjoyed|really happy|loved/i],
  ])('uses the %i-star rating as neutral overall tone without inventing topic details', (rating, tone) => {
    const alternatives = createReviewDraftAlternatives({
      rating,
      topics: ['Staff behaviour'],
      offerings: [],
      details: '',
      experienceTerm: 'visit',
    })

    for (const { draft } of alternatives) {
      expect(draft).toMatch(tone)
      expect(draft).toMatch(/staff behaviour/i)
      expect(draft).not.toMatch(/ignored|helped|recommended|resolved/i)
      expect(draft).not.toMatch(/\b[1-5]\s*out of\s*5\b/i)
    }
  })

  it('keeps customer details unchanged and produces concise alternatives when little is selected', () => {
    const details = 'The staff helped us choose dishes and were really friendly.'
    const alternatives = createReviewDraftAlternatives({
      rating: null,
      topics: [],
      offerings: [],
      details,
    })

    expect(new Set(alternatives.map(({ draft }) => draft)).size).toBe(3)
    expect(alternatives.map(({ draft }) => draft)).toContain(details)
    expect(alternatives.every(({ draft }) => draft.length < 200)).toBe(true)
  })

  it('avoids repeating a previous set and varies structure on another generation', () => {
    const input = {
      rating: 5,
      topics: ['Coffee quality'],
      offerings: ['Takeaway'],
      details: 'The latte was smooth and not too sweet.',
      experienceTerm: 'visit',
    }
    const first = createReviewDraftAlternatives(input)
    const second = createReviewDraftAlternatives(input, 1, first.map(({ draft }) => draft))

    expect(second.every(({ draft }, index) => draft !== first[index].draft)).toBe(true)
    expect(new Set(second.map(({ draft }) => draft)).size).toBe(3)
  })
})

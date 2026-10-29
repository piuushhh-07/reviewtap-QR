import { describe, expect, it } from 'vitest'
import { createReviewDraft } from './reviewDraft'

describe('createReviewDraft', () => {
  it.each([
    [1, 'very poor'],
    [2, 'disappointing'],
    [3, 'mixed'],
    [4, 'good'],
    [5, 'excellent'],
  ])('reflects the customer-selected %i-star rating', (rating, description) => {
    const draft = createReviewDraft({
      businessName: 'Northstar Dental',
      topics: ['What could be improved'],
      details: '',
      rating,
    })

    expect(draft).toContain(`a ${description} experience`)
    expect(draft).toContain('what could be improved')
  })

  it('represents selected positive and negative topics without inventing incidents', () => {
    const draft = createReviewDraft({
      businessName: 'Auroo Cafe',
      topics: ['What went well', 'What could be improved'],
      details: '',
      rating: 3,
    })

    expect(draft).toContain('mixed experience')
    expect(draft).toContain('what went well and what could be improved')
    expect(draft).not.toMatch(/the staff ignored|the order was wrong|the food was cold/i)
  })

  it('keeps customer-entered unusual text and adds natural punctuation', () => {
    const details = 'I waited, then asked & was told “not yet <maybe>”'
    const draft = createReviewDraft({
      businessName: 'Northstar Dental',
      topics: [],
      details,
      rating: 2,
    })

    expect(draft).toContain(`${details}.`)
    expect(draft).not.toContain('undefined')
  })

  it('uses only distinct selected topics and preserves category acronyms', () => {
    const draft = createReviewDraft({
      businessName: 'Pixel Gaming Cafe',
      topics: ['PC performance during gameplay', 'Wi-Fi availability and reliability', 'PC performance during gameplay'],
      details: '',
    })

    expect(draft).toContain('PC performance during gameplay and Wi-Fi availability and reliability')
    expect(draft.match(/PC performance during gameplay/g)).toHaveLength(1)
  })

  it('uses neutral wording when no rating is selected', () => {
    const draft = createReviewDraft({
      businessName: 'Auroo Cafe',
      topics: [],
      details: 'The music was loud.',
      rating: null,
    })

    expect(draft).toContain('feedback about my experience')
    expect(draft).toContain('The music was loud.')
    expect(draft).not.toMatch(/excellent|disappointing|very poor/i)
  })
})

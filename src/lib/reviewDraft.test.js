import { describe, expect, it } from 'vitest'
import { createReviewDraft } from './reviewDraft'

describe('createReviewDraft', () => {
  it.each([1, 2, 3, 4, 5])('uses the customer-selected %i-star rating accurately', (rating) => {
    const draft = createReviewDraft({
      businessName: 'Northstar Dental',
      topics: ['What could be improved'],
      details: '',
      rating,
    })

    expect(draft).toContain(`Northstar Dental ${rating} out of 5`)
    expect(draft).toContain('what could be improved')
  })

  it('uses the customer details and both positive and constructive topics without inventing incidents', () => {
    const draft = createReviewDraft({
      businessName: 'Auroo Cafe',
      topics: ['What went well', 'What could be improved'],
      offerings: [],
      details: 'The music was enjoyable, but the queue felt slow.',
      rating: 3,
    })

    expect(draft).toContain('3 out of 5')
    expect(draft).toContain('The music was enjoyable, but the queue felt slow.')
    expect(draft).toContain('what went well and what could be improved')
    expect(draft).not.toMatch(/the staff ignored|the order was wrong|the food was cold/i)
  })

  it('combines selected offerings and topics while keeping mentions distinct', () => {
    const draft = createReviewDraft({
      businessName: 'Pixel Gaming Cafe',
      topics: ['PC performance during gameplay', 'Wi-Fi availability and reliability'],
      offerings: ['Gaming experience', 'PC performance during gameplay'],
      details: '',
      rating: null,
    })

    expect(draft).toContain(
      'PC performance during gameplay, Wi-Fi availability and reliability, and Gaming experience',
    )
    expect(draft.match(/PC performance during gameplay/g)).toHaveLength(1)
  })

  it('keeps customer-entered text verbatim and adds natural punctuation', () => {
    const details = 'I waited, then asked & was told “not yet <maybe>”'
    const draft = createReviewDraft({
      businessName: 'Northstar Dental',
      topics: [],
      offerings: [],
      details,
      rating: 2,
    })

    expect(draft).toContain(`${details}.`)
    expect(draft).not.toContain('undefined')
  })

  it('does not repeat a selected topic already included in the customer detail', () => {
    const draft = createReviewDraft({
      topics: ['Staff friendliness'],
      offerings: [],
      details: 'Staff friendliness was a highlight.',
      rating: null,
    })

    expect(draft).toBe('Staff friendliness was a highlight.')
  })

  it('creates a short draft from a rating alone and neutral copy when no rating is selected', () => {
    expect(createReviewDraft({
      businessName: 'Auroo Cafe',
      topics: [],
      offerings: [],
      details: '',
      rating: 5,
    })).toBe('I’d rate my experience at Auroo Cafe 5 out of 5.')

    const neutralDraft = createReviewDraft({
      businessName: 'Auroo Cafe',
      topics: [],
      offerings: [],
      details: 'The music was loud.',
      rating: null,
    })
    expect(neutralDraft).toBe('The music was loud.')
    expect(neutralDraft).not.toMatch(/excellent|disappointing|very poor/i)
  })
})

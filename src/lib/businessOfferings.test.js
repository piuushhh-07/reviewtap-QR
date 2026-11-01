import { describe, expect, it } from 'vitest'
import {
  parseBusinessReviewTopics,
  validateBusinessReviewTopics,
} from './businessOfferings'

describe('business custom review topics', () => {
  it('parses trimmed lines and treats an absent value as an empty optional list', () => {
    expect(parseBusinessReviewTopics('  Quiet workspace \n\nSeasonal menu ')).toEqual([
      'Quiet workspace',
      'Seasonal menu',
    ])
    expect(validateBusinessReviewTopics(undefined)).toEqual({ valid: true, topics: [] })
  })

  it('validates topic text, length, count, and duplicates', () => {
    expect(validateBusinessReviewTopics(['']).valid).toBe(false)
    expect(validateBusinessReviewTopics(['x'.repeat(81)]).valid).toBe(false)
    expect(validateBusinessReviewTopics(Array.from({ length: 21 }, (_, index) => `Topic ${index}`)).valid)
      .toBe(false)
    expect(validateBusinessReviewTopics(['Quiet area', ' quiet area ']).valid).toBe(false)
    expect(validateBusinessReviewTopics(['Quiet area', 'Seasonal menu'])).toEqual({
      valid: true,
      topics: ['Quiet area', 'Seasonal menu'],
    })
  })
})

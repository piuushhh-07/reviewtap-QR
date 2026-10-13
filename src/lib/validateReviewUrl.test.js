import { describe, expect, it } from 'vitest'
import {
  validateBusinessName,
  validateGoogleReviewUrl,
  validateReviewUrl,
} from './validateReviewUrl'

describe('validateReviewUrl', () => {
  it('rejects an empty value', () => {
    const result = validateReviewUrl('')
    expect(result.valid).toBe(false)
    expect(result.message).toMatch(/enter your google review link/i)
  })

  it('rejects a value that is only whitespace', () => {
    const result = validateReviewUrl('   ')
    expect(result.valid).toBe(false)
  })

  it('rejects text that is not a usable link', () => {
    const result = validateReviewUrl('not a link at all')
    expect(result.valid).toBe(false)
  })

  it('rejects a non-http(s) protocol', () => {
    const result = validateReviewUrl('ftp://example.com/review')
    expect(result.valid).toBe(false)
    expect(result.message).toMatch(/http/i)
  })

  it('accepts a standard https Google review link', () => {
    const result = validateReviewUrl(
      'https://g.page/r/CYourPlaceId/review',
    )
    expect(result.valid).toBe(true)
    expect(result.normalizedUrl).toBe(
      'https://g.page/r/CYourPlaceId/review',
    )
  })

  it('accepts a search.google.com write-review link with a query string', () => {
    const url =
      'https://search.google.com/local/writereview?placeid=ChIJabc123'
    const result = validateReviewUrl(url)
    expect(result.valid).toBe(true)
    expect(result.normalizedUrl).toBe(url)
  })

  it('adds https:// to a bare domain so it still encodes as a working link', () => {
    const result = validateReviewUrl('g.page/r/CYourPlaceId/review')
    expect(result.valid).toBe(true)
    expect(result.normalizedUrl).toBe(
      'https://g.page/r/CYourPlaceId/review',
    )
  })

  it('rejects a string with no dot in the host', () => {
    const result = validateReviewUrl('https://localhost')
    expect(result.valid).toBe(false)
  })
})

describe('validateBusinessName', () => {
  it('rejects an empty value', () => {
    const result = validateBusinessName('')
    expect(result.valid).toBe(false)
  })

  describe('validateGoogleReviewUrl', () => {
    it.each([
      'https://g.page/r/CYourPlaceId/review',
      'https://search.google.com/local/writereview?placeid=ChIJabc123',
      'https://maps.app.goo.gl/abc123',
      'https://www.google.com/maps/place/example',
      'https://maps.google.com/?cid=1234',
      'g.page/r/CYourPlaceId/review',
    ])('accepts a Google review URL: %s', (url) => {
      expect(validateGoogleReviewUrl(url).valid).toBe(true)
    })

    it.each([
      'https://example.com/review',
      'http://g.page/r/example/review',
      'https://g.page/url?target=https://attacker.example',
      'https://www.google.com/url?target=https://attacker.example',
      'javascript:alert(1)',
      'https://user@g.page/r/example/review',
    ])('rejects unsafe or non-review URL: %s', (url) => {
      expect(validateGoogleReviewUrl(url).valid).toBe(false)
    })
  })

  it('rejects a value that is only whitespace', () => {
    const result = validateBusinessName('   ')
    expect(result.valid).toBe(false)
  })

  it('trims surrounding whitespace on success', () => {
    const result = validateBusinessName('  Danish Smile Care  ')
    expect(result.valid).toBe(true)
    expect(result.normalizedName).toBe('Danish Smile Care')
  })

  it('rejects an excessively long name', () => {
    const result = validateBusinessName('A'.repeat(81))
    expect(result.valid).toBe(false)
    expect(result.message).toMatch(/80 characters/i)
  })
})

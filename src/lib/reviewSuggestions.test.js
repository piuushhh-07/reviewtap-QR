import { describe, expect, it } from 'vitest'
import {
  getReviewCategories,
  getReviewSuggestions,
  isValidBusinessCategory,
} from './reviewSuggestions'

const generalCategoryId = 'other-general-business'
const expectedCategories = [
  ['cafe-restaurant', 'Cafe / Restaurant'],
  ['dental-clinic', 'Dental Clinic'],
  ['pharmacy', 'Pharmacy'],
  ['salon-barber', 'Salon / Barber'],
  ['gaming-cafe', 'Gaming Cafe'],
  ['retail-store', 'Retail Store'],
  ['hotel-accommodation', 'Hotel / Accommodation'],
  ['gym-fitness', 'Gym / Fitness'],
  ['electronics-computer-store', 'Electronics / Computer Store'],
  ['other-general-business', 'Other / General Business'],
]

describe('review suggestion catalogue', () => {
  it('provides all ten categories with stable ids and human-readable labels', () => {
    const categories = getReviewCategories()

    expect(categories).toHaveLength(10)
    expect(categories.map(({ id, label }) => [id, label])).toEqual(expectedCategories)
    expect(categories.every(({ id, label }) => (
      typeof id === 'string' &&
      /^[a-z]+(?:-[a-z]+)*$/.test(id) &&
      typeof label === 'string' &&
      label.trim().length > 0
    ))).toBe(true)
    expect(new Set(categories.map(({ id }) => id)).size).toBe(10)
    expect(new Set(categories.map(({ label }) => label)).size).toBe(10)
  })

  it('provides at least twenty unique non-empty suggestions for every category', () => {
    for (const { id, suggestions } of getReviewCategories()) {
      expect(isValidBusinessCategory(id)).toBe(true)
      expect(Array.isArray(suggestions)).toBe(true)
      expect(suggestions.length).toBeGreaterThanOrEqual(20)
      expect(suggestions.every((suggestion) => (
        typeof suggestion === 'string' && suggestion.trim().length > 0
      ))).toBe(true)
      expect(new Set(suggestions).size).toBe(suggestions.length)
      expect(getReviewSuggestions(id)).toEqual(suggestions)
    }
  })

  it('uses meaningfully different suggestions for each supported category', () => {
    const categories = getReviewCategories()
    const specificCategories = categories.filter(({ id }) => id !== generalCategoryId)

    for (const category of specificCategories) {
      const uniqueSuggestions = category.suggestions.filter((suggestion) => (
        !categories.some((other) => (
          other.id !== category.id && other.suggestions.includes(suggestion)
        ))
      ))
      expect(uniqueSuggestions.length).toBeGreaterThanOrEqual(18)
    }
  })

  it.each([undefined, null, '', 'unknown', 'Cafe', 42])(
    'falls back to general suggestions for an invalid category id: %s',
    (categoryId) => {
      expect(isValidBusinessCategory(categoryId)).toBe(false)
      expect(getReviewSuggestions(categoryId)).toBe(
        getReviewSuggestions(generalCategoryId),
      )
    },
  )

  it.each([
    [1, 'What could be improved'],
    [2, 'What could be improved'],
    [3, 'Overall experience'],
    [4, 'What stood out during the visit'],
    [5, 'What stood out during the visit'],
  ])('adds a neutral reflection prompt for rating %i', (rating, expectedPrompt) => {
    expect(getReviewSuggestions('dental-clinic', rating)[0]).toBe(expectedPrompt)
  })

  it('uses the universal fallback when rating-aware suggestions receive an unknown category', () => {
    expect(getReviewSuggestions('custom-category', 1)).toContain('What could be improved')
    expect(getReviewSuggestions(undefined, 5)).toContain('What stood out during the visit')
  })

  it('ignores ratings outside the supported range', () => {
    expect(getReviewSuggestions('dental-clinic', 0)).toBe(
      getReviewSuggestions('dental-clinic'),
    )
    expect(getReviewSuggestions('dental-clinic', 6)).toBe(
      getReviewSuggestions('dental-clinic'),
    )
  })

  it('returns an array of category records and an array of suggestions', () => {
    const categories = getReviewCategories()
    const suggestions = getReviewSuggestions('gaming-cafe')

    expect(Array.isArray(categories)).toBe(true)
    expect(categories.every((category) => (
      typeof category.id === 'string' &&
      typeof category.label === 'string' &&
      Array.isArray(category.suggestions)
    ))).toBe(true)
    expect(Array.isArray(suggestions)).toBe(true)
    expect(isValidBusinessCategory('gaming-cafe')).toBe(true)
  })
})

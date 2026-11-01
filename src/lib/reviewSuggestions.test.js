import { describe, expect, it } from 'vitest'
import {
  getInitialReviewSuggestions,
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

  it('uses clear, category-specific wording for representative businesses', () => {
    expect(getReviewSuggestions('cafe-restaurant')).toContain(
      'Quality of coffee, tea, and other drinks',
    )
    expect(getReviewSuggestions('retail-store')).toContain('Returns and exchanges process')
    expect(getReviewSuggestions('hotel-accommodation')).toContain('Check-in process and welcome')
    expect(getReviewSuggestions('gym-fitness')).toContain('Value for the membership price')
    expect(getReviewSuggestions('electronics-computer-store')).toContain(
      'Clarity of repair diagnosis and communication',
    )
  })

  it('creates a compact, varied subset that stays stable for a visit seed', () => {
    const categoryId = 'cafe-restaurant'
    const firstVisit = getInitialReviewSuggestions(categoryId, null, 'visit-one')
    const repeatRender = getInitialReviewSuggestions(categoryId, null, 'visit-one')
    const secondVisit = getInitialReviewSuggestions(categoryId, null, 'visit-two')

    expect(firstVisit).toHaveLength(5)
    expect(firstVisit).toEqual(repeatRender)
    expect(secondVisit).not.toEqual(firstVisit)
    expect(new Set(firstVisit).size).toBe(firstVisit.length)
    expect(firstVisit.filter((topic) => getReviewSuggestions(categoryId).includes(topic))).toHaveLength(3)
  })

  it('keeps rating reflections available while retaining the same category subset', () => {
    const neutral = getInitialReviewSuggestions('dental-clinic', null, 'visit')
    const lowRating = getInitialReviewSuggestions('dental-clinic', 1, 'visit')
    const highRating = getInitialReviewSuggestions('dental-clinic', 5, 'visit')
    const categoryTopics = (topics) => topics.filter((topic) => (
      getReviewCategories().find(({ id }) => id === 'dental-clinic').suggestions.includes(topic)
    ))

    expect(lowRating).toHaveLength(6)
    expect(lowRating).toContain('What needs attention')
    expect(lowRating).toContain('What went well')
    expect(lowRating).toContain('What could be improved')
    expect(categoryTopics(lowRating)).toEqual(categoryTopics(highRating))
    expect(categoryTopics(neutral)).toEqual(categoryTopics(lowRating))
  })

  it('allows every category topic to appear in the initial subset over different visits', () => {
    const allTopics = getReviewSuggestions('gaming-cafe')
    const seenTopics = new Set(
      Array.from({ length: 300 }, (_, index) => (
        getInitialReviewSuggestions('gaming-cafe', null, `visit-${index}`)
      )).flat(),
    )

    expect(allTopics.every((topic) => seenTopics.has(topic))).toBe(true)
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
    [1, 'What needs attention'],
    [2, 'Main disappointment'],
    [3, 'What worked well'],
    [4, 'What went well'],
    [5, 'What stood out about the experience'],
  ])('adds a neutral reflection prompt for rating %i without reordering category topics', (rating, expectedPrompt) => {
    const suggestions = getReviewSuggestions('dental-clinic', rating)
    expect(suggestions).toContain(expectedPrompt)
    expect(suggestions.slice(0, 20)).toEqual(getReviewSuggestions('dental-clinic'))
  })

  it.each([1, 2, 3, 4, 5])(
    'keeps balanced positive and constructive topics available at rating %i',
    (rating) => {
      const suggestions = getReviewSuggestions('cafe-restaurant', rating)
      expect(suggestions).toContain('What went well')
      expect(suggestions).toContain('What could be improved')
    },
  )

  it('uses the universal fallback when rating-aware suggestions receive an unknown category', () => {
    expect(getReviewSuggestions('custom-category', 1)).toContain('What could be improved')
    expect(getReviewSuggestions(undefined, 5)).toContain('What stood out about the experience')
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

const reflectionTopics = new Set([
  'what went well',
  'what could be improved',
  'what could be better',
  'what worked well',
  'what needs attention',
  'main disappointment',
  'what stood out about the experience',
])

function sentenceCaseTopic(topic) {
  if (/^(?:PC|TV|USB)\b/.test(topic) || /^Wi-Fi\b/.test(topic)) return topic
  return `${topic[0].toLowerCase()}${topic.slice(1)}`
}

function finishSentence(text) {
  return /[.!?…]["'”’)\]}]*$/u.test(text) ? text : `${text}.`
}

function joinTopics(topics) {
  if (topics.length < 2) return topics[0]
  if (topics.length === 2) return `${topics[0]} and ${topics[1]}`
  return `${topics.slice(0, -1).join(', ')}, and ${topics.at(-1)}`
}

function stemWord(word) {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y'
  if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3)
  if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2)
  if (word.endsWith('ness') && word.length > 7) return word.slice(0, -4)
  if (word.endsWith('s') && word.length > 4) return word.slice(0, -1)
  return word
}

function filterMentions(items, detail, detailWords) {
  return [...new Map(
    items
      .filter((item) => typeof item === 'string' && item.trim())
      .map(sentenceCaseTopic)
      .filter((item) => {
        const normalized = item.toLocaleLowerCase()
        if (reflectionTopics.has(normalized) || detail.toLocaleLowerCase().includes(normalized)) {
          return false
        }
        const words = normalized.match(/[\p{L}\p{N}]+/gu) ?? []
        const overlappingWords = words.filter((word) => word.length > 3 && detailWords.has(stemWord(word)))
        return overlappingWords.length < Math.ceil(words.length / 2)
      })
      .map((item) => [item.toLocaleLowerCase(), item]),
  ).values()]
}

function normalizeInputs({ topics = [], offerings = [], details = '', rating }) {
  const detail = typeof details === 'string' ? details.trim() : ''
  const detailWords = new Set(
    (detail.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).map(stemWord),
  )
  const selectedTopics = filterMentions(topics, detail, detailWords)
  const topicKeys = new Set(selectedTopics.map((topic) => topic.toLocaleLowerCase()))

  return {
    detail,
    rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null,
    selectedTopics,
    selectedOfferings: filterMentions(offerings, detail, detailWords).filter((offering) => (
      !topicKeys.has(offering.toLocaleLowerCase())
    )),
  }
}

function ratingSentence(rating, experienceTerm, variation) {
  const term = experienceTerm?.trim() || 'visit'
  const sentences = {
    1: [
      `I was really unhappy with my ${term}.`,
      `My ${term} left me disappointed.`,
      `I was unhappy with how my ${term} went.`,
    ],
    2: [
      `I was disappointed with my ${term}.`,
      `My ${term} could have gone better.`,
      `I left disappointed with my ${term}.`,
    ],
    3: [
      `I had mixed feelings about my ${term}.`,
      `My ${term} had some good parts and some room for improvement.`,
      `My ${term} was okay, though not everything felt right.`,
    ],
    4: [
      `I had a pretty good ${term}.`,
      `I came away happy with my ${term}.`,
      `I enjoyed my ${term}.`,
    ],
    5: [
      `I really enjoyed my ${term}.`,
      `I came away really happy with my ${term}.`,
      `I loved my ${term}.`,
    ],
  }
  return sentences[rating]?.[variation % 3] ?? ''
}

function mentionSentence(topics, offerings, style, variation) {
  const mentions = joinTopics([...topics, ...offerings])
  if (!mentions) return ''
  if (style === 'Short') return `I’d mention ${mentions}.`
  if (style === 'Warm') {
    return [...topics, ...offerings].length === 1
      ? `One thing I’d like to mention is ${mentions}.`
      : `A few things I’d like to mention are ${mentions}.`
  }
  return [
    `I also wanted to mention ${mentions}.`,
    `I’d also like to mention ${mentions}.`,
    `Another thing I wanted to mention is ${mentions}.`,
  ][variation % 3]
}

function composeAlternative(input, style, variation) {
  const { detail, rating, selectedTopics, selectedOfferings } = input
  const ratingText = rating === null
    ? ''
    : ratingSentence(rating, input.experienceTerm, variation)
  const mentionText = mentionSentence(selectedTopics, selectedOfferings, style, variation)
  const detailText = detail ? finishSentence(detail) : ''
  const parts = [ratingText, detailText, mentionText].filter(Boolean)

  if (detailText && !ratingText && !mentionText) {
    if (style === 'Warm') return `One thing I’d like to share: ${detailText}`
    if (style === 'Short') return `The main thing I’d add: ${detailText}`
    return detailText
  }
  if (parts.length <= 1) {
    return parts[0] ?? ''
  }

  if (style === 'Warm') {
    return [detailText, ratingText, mentionText].filter(Boolean).join(' ')
  }
  if (style === 'Short') {
    return [detailText, mentionText, ratingText].filter(Boolean).join(' ')
  }
  return parts.join(' ')
}

export function hasReviewDraftAlternatives(input) {
  const { selectedTopics, selectedOfferings } = normalizeInputs(input)
  return selectedTopics.length > 0 || selectedOfferings.length > 0
}

export function createReviewDraftAlternatives(input, variation = 0, previousDrafts = []) {
  const normalized = normalizeInputs(input)
  normalized.experienceTerm = input.experienceTerm
  const styles = ['Casual', 'Warm', 'Short']

  return styles.map((style, styleIndex) => {
    let draft = ''
    for (let offset = 0; offset < 3; offset += 1) {
      draft = composeAlternative(
        normalized,
        style,
        variation + styleIndex + offset,
      )
      if (draft && !previousDrafts.includes(draft)) break
    }
    return { style, draft }
  })
}

export function createReviewDraft(input, variation = 0, previousDraft = '') {
  return createReviewDraftAlternatives(
    input,
    variation,
    previousDraft ? [previousDraft] : [],
  )[0].draft
}

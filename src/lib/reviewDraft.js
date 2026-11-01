const ratingOnlyDrafts = Object.freeze({
  1: 'I was really unhappy with the visit.',
  2: 'I was disappointed with the visit.',
  3: 'My visit was okay, though some things could have been better.',
  4: 'It was a pretty good visit.',
  5: 'I really enjoyed the visit.',
})

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

function capitalizeFirst(text) {
  return `${text[0].toLocaleUpperCase()}${text.slice(1)}`
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

function addTopicArticle(topics) {
  return /^(?:how|what|whether)\b/i.test(topics) ? topics : `the ${topics}`
}

function topicSentence(topics, rating, variation) {
  const list = joinTopics(topics)
  const mentionedTopics = addTopicArticle(list)
  if (rating !== null && rating <= 2) {
    return capitalizeFirst([
      `I was also disappointed by ${mentionedTopics}.`,
      `${mentionedTopics} could have been better.`,
      `I wasn’t happy with ${mentionedTopics}.`,
    ][variation % 3])
  }
  if (rating === 3) {
    return capitalizeFirst([
      `I also had mixed feelings about ${mentionedTopics}.`,
      `I wasn’t sure what to make of ${mentionedTopics}.`,
      `I felt a bit mixed about ${mentionedTopics}.`,
    ][variation % 3])
  }
  if (rating !== null && rating >= 4) {
    return capitalizeFirst([
      `I also really enjoyed ${mentionedTopics}.`,
      `I especially liked ${mentionedTopics}.`,
      `I found ${mentionedTopics} enjoyable.`,
    ][variation % 3])
  }
  return capitalizeFirst([
    `I also wanted to mention ${list}.`,
    `One thing I wanted to mention is ${list}.`,
    `I noticed ${list} during my experience.`,
  ][variation % 3])
}

function offeringSentence(offerings, variation) {
  const list = joinTopics(offerings)
  return [
    `I also wanted to mention ${list}.`,
    `I’d also like to mention ${list}.`,
    `Another part of my visit was ${list}.`,
  ][variation % 3]
}

function topicOnlyDraft(topics, rating, variation) {
  const list = joinTopics(topics)
  if (rating !== null && rating <= 2) {
    return capitalizeFirst([
      `I was disappointed with ${addTopicArticle(list)}.`,
      `${addTopicArticle(list)} could have been better.`,
      `I wasn’t happy with ${addTopicArticle(list)}.`,
    ][variation % 3])
  }
  if (rating === 3) {
    return capitalizeFirst([
      `My experience was mixed, especially around ${addTopicArticle(list)}.`,
      `I wasn’t sure what to make of ${addTopicArticle(list)}.`,
      `I felt a bit mixed about ${addTopicArticle(list)}.`,
    ][variation % 3])
  }
  if (rating !== null && rating >= 4) {
    return capitalizeFirst([
      `I really enjoyed ${addTopicArticle(list)}.`,
      `I especially liked ${addTopicArticle(list)}.`,
      `I found ${addTopicArticle(list)} enjoyable.`,
    ][variation % 3])
  }
  return capitalizeFirst([
    `I wanted to mention ${list}.`,
    `One thing I wanted to mention is ${list}.`,
    `I noticed ${list} during my experience.`,
  ][variation % 3])
}

function createCandidate({ detail, rating, selectedTopics, selectedOfferings }, variation) {
  if (!detail && !selectedTopics.length && !selectedOfferings.length) {
    return rating ? ratingOnlyDrafts[rating] : ''
  }
  if (!detail && selectedTopics.length) {
    const topicDraft = topicOnlyDraft(selectedTopics, rating, variation)
    if (!selectedOfferings.length) return topicDraft
    return `${topicDraft} ${offeringSentence(selectedOfferings, variation)}`
  }
  if (!detail && selectedOfferings.length) {
    return offeringSentence(selectedOfferings, variation)
  }

  const detailSentence = finishSentence(detail)
  const topicLine = selectedTopics.length
    ? topicSentence(selectedTopics, rating, variation)
    : ''
  const offeringLine = selectedOfferings.length
    ? offeringSentence(selectedOfferings, variation)
    : ''
  const otherLines = [topicLine, offeringLine].filter(Boolean)

  if (!otherLines.length) return detailSentence
  if (variation % 3 === 0) return [detailSentence, ...otherLines].join(' ')
  if (variation % 3 === 1) return [...otherLines, detailSentence].join(' ')
  const mentions = joinTopics([...selectedTopics, ...selectedOfferings])
  return `${detailSentence} Another thing I wanted to mention was ${mentions}.`
}

export function hasReviewDraftAlternatives(input) {
  const { selectedTopics, selectedOfferings } = normalizeInputs(input)
  return selectedTopics.length > 0 || selectedOfferings.length > 0
}

export function createReviewDraft(input, variation = 0, previousDraft = '') {
  const normalized = normalizeInputs(input)
  const candidateCount = normalized.detail && (
    normalized.selectedTopics.length || normalized.selectedOfferings.length
  ) ? 3 : 1

  for (let offset = 0; offset < candidateCount; offset += 1) {
    const candidate = createCandidate(normalized, variation + offset)
    if (candidate && candidate !== previousDraft) return candidate
  }

  return createCandidate(normalized, variation)
}

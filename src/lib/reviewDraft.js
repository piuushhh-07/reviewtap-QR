const ratingDescriptions = Object.freeze({
  1: 'very poor',
  2: 'disappointing',
  3: 'mixed',
  4: 'good',
  5: 'excellent',
})

function sentenceCaseTopic(topic) {
  if (/^(?:PC|TV|USB)\b/.test(topic) || /^Wi-Fi\b/.test(topic)) return topic
  return `${topic[0].toLowerCase()}${topic.slice(1)}`
}

function joinTopics(topics) {
  if (topics.length < 2) return topics[0]
  if (topics.length === 2) return `${topics[0]} and ${topics[1]}`
  return `${topics.slice(0, -1).join(', ')}, and ${topics.at(-1)}`
}

function finishSentence(text) {
  return /[.!?…]["'”’)\]}]*$/u.test(text) ? text : `${text}.`
}

export function createReviewDraft({ businessName, topics, details, rating }, variation = 0) {
  const selectedTopics = [...new Set(
    topics.filter((topic) => typeof topic === 'string' && topic.trim()).map(sentenceCaseTopic),
  )]
  const detail = typeof details === 'string' ? details.trim() : ''
  const description = ratingDescriptions[rating]
  const opening = description
    ? [
        `I had a ${description} experience at ${businessName}.`,
        `My experience at ${businessName} was ${description}.`,
        `Overall, my experience at ${businessName} was ${description}.`,
      ][variation % 3]
    : [
        `I’d like to share feedback about my experience at ${businessName}.`,
        `Here are a few thoughts about my experience at ${businessName}.`,
        `I’d like to share a few thoughts about my experience at ${businessName}.`,
      ][variation % 3]
  const topicSentence = selectedTopics.length === 1
    ? ` One point I’d like to mention is ${selectedTopics[0]}.`
    : selectedTopics.length > 1
      ? ` A few points I’d like to mention are ${joinTopics(selectedTopics)}.`
      : ''
  const detailSentence = detail ? ` ${finishSentence(detail)}` : ''

  return `${opening}${topicSentence}${detailSentence}`
}

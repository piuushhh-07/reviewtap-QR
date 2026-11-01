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

export function createReviewDraft({ businessName, topics = [], offerings = [], details = '', rating }) {
  const detail = typeof details === 'string' ? details.trim() : ''
  const detailForComparison = detail.toLocaleLowerCase()
  const mentions = [...new Map(
    [
      ...topics
        .filter((item) => typeof item === 'string' && item.trim())
        .map(sentenceCaseTopic),
      ...offerings.filter((item) => typeof item === 'string' && item.trim()),
    ]
      .filter((item) => !detailForComparison.includes(item.toLocaleLowerCase()))
      .map((item) => [item.toLocaleLowerCase(), item]),
  ).values()]
  const sentences = []

  if (Number.isInteger(rating) && rating >= 1 && rating <= 5 && businessName) {
    sentences.push(`I’d rate my experience at ${businessName} ${rating} out of 5.`)
  }
  if (detail) sentences.push(finishSentence(detail))
  if (mentions.length) {
    const opening = sentences.length
      ? 'I’d also like to mention'
      : businessName
        ? `At ${businessName}, I’d like to mention`
        : 'I’d like to mention'
    sentences.push(`${opening} ${joinTopics(mentions)}.`)
  }

  return sentences.join(' ')
}

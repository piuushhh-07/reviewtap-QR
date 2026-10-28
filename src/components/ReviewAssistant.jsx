import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getReviewCategories,
  getReviewSuggestions,
  isValidBusinessCategory,
} from '../lib/reviewSuggestions'
import './ReviewAssistant.css'

const generalCategoryId = 'other-general-business'
const categories = getReviewCategories()
const businessLoadTimeoutMs = 15000

function getErrorMessage(status, message) {
  if (status === 400 || status === 404) return 'This QR code is not valid. Please scan a current ReviewTap code.'
  if (status === 409) return 'This stand has not been activated yet. Please contact the business for help.'
  if (status === 410) return 'This QR code is currently unavailable. Please contact the business for help.'
  if (status >= 500) return 'We could not load this review link right now. Please try again in a moment.'
  return message || 'We could not load this review link. Please try again.'
}

async function loadBusiness(qrId, signal) {
  let response
  try {
    response = await fetch(`/api/public/qrs/${encodeURIComponent(qrId)}`, { signal })
  } catch (error) {
    if (signal.aborted || error.name === 'AbortError') {
      throw new Error('This is taking longer than expected. Please try again.')
    }
    throw new Error('We could not connect. Check your internet connection and try again.')
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error('We received an unexpected response. Please try again.')
  }
  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, payload.error))
  }

  const categoryId = isValidBusinessCategory(payload.category_id)
    ? payload.category_id
    : generalCategoryId
  if (
    typeof payload.business_name !== 'string' ||
    !payload.business_name.trim() ||
    typeof payload.destination_url !== 'string'
  ) {
    throw new Error('Business review details are incomplete. Please try again later.')
  }

  return {
    businessName: payload.business_name,
    categoryId,
    categoryLabel: categories.find(({ id }) => id === categoryId).label,
    destinationUrl: payload.destination_url,
  }
}

function createDraft({ businessName, topics, details }, variation = 0) {
  const topicList = topics.length > 1
    ? `${topics.slice(0, -1).join(', ')} and ${topics.at(-1)}`
    : topics[0]
  const opening = variation % 2 === 0
    ? `I’d like to share feedback about my experience at ${businessName}.`
    : `Here is some feedback about my experience at ${businessName}.`
  const topicSentence = topicList
    ? ` The aspects I’d like to mention are ${topicList}.`
    : ''
  const detailSentence = details.trim() ? ` ${details.trim()}` : ''
  return `${opening}${topicSentence}${detailSentence}`.trim()
}

function StepIndicator({ step }) {
  const steps = ['Choose topics', 'Review your draft', 'Continue']
  return (
    <ol className="review-progress" aria-label="Review steps">
      {steps.map((label, index) => {
        const stepNumber = index + 1
        return (
          <li
            className={stepNumber === step ? 'is-current' : stepNumber < step ? 'is-complete' : ''}
            aria-current={stepNumber === step ? 'step' : undefined}
            key={label}
          >
            <span className="review-progress__number">{stepNumber < step ? '✓' : stepNumber}</span>
            <span>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

function TopicButton({ topic, selected, onToggle, note }) {
  return (
    <button
      className={`review-topic${selected ? ' is-selected' : ''}`}
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
    >
      <span className="review-topic__check" aria-hidden="true">{selected ? '✓' : '+'}</span>
      <span>{topic}</span>
      {note && <span className="review-topic__note">{note}</span>}
    </button>
  )
}

export function ReviewAssistant() {
  const pathSegments = window.location.pathname.split('/').filter(Boolean)
  const qrId = pathSegments.length === 2 && pathSegments[0] === 'r' ? pathSegments[1] : ''
  const [business, setBusiness] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retryCount, setRetryCount] = useState(0)
  const [copying, setCopying] = useState(false)
  const [rating, setRating] = useState(null)
  const [ratingHover, setRatingHover] = useState(null)
  const [selectedTopics, setSelectedTopics] = useState([])
  const [details, setDetails] = useState('')
  const [draft, setDraft] = useState('')
  const [draftError, setDraftError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [step, setStep] = useState(1)
  const [draftVariation, setDraftVariation] = useState(0)
  const draftHeadingRef = useRef(null)
  const topicsHeadingRef = useRef(null)

  useEffect(() => {
    let current = true
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), businessLoadTimeoutMs)
    loadBusiness(qrId, controller.signal)
      .then((result) => {
        if (current) setBusiness(result)
      })
      .catch((error) => {
        if (current) setLoadError(error.message)
      })
      .finally(() => {
        window.clearTimeout(timeoutId)
        if (current) setLoading(false)
      })
    return () => {
      current = false
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [qrId, retryCount])

  useEffect(() => {
    if (step === 2) draftHeadingRef.current?.focus()
  }, [step])

  function retryLoading() {
    setLoading(true)
    setLoadError('')
    setRetryCount((count) => count + 1)
  }

  const suggestions = useMemo(
    () => getReviewSuggestions(business?.categoryId, rating),
    [business?.categoryId, rating],
  )
  const staleSelectedTopics = selectedTopics.filter((topic) => !suggestions.includes(topic))
  const visibleRating = ratingHover ?? rating

  function toggleTopic(topic) {
    setSelectedTopics((current) => current.includes(topic)
      ? current.filter((item) => item !== topic)
      : [...current, topic])
    setDraftError('')
    setCopyStatus('')
  }

  function clearTopics() {
    setSelectedTopics([])
    setDraftError('')
    setCopyStatus('')
  }

  function returnToTopics() {
    setStep(1)
    topicsHeadingRef.current?.focus()
  }

  function generateReviewDraft(isRegenerating = false) {
    if (!selectedTopics.length && !details.trim()) {
      setDraftError('Choose at least one topic or add a detail from your experience to create a draft.')
      return
    }
    const nextVariation = isRegenerating ? draftVariation + 1 : draftVariation
    setDraft(createDraft({
      businessName: business.businessName,
      topics: selectedTopics,
      details,
    }, nextVariation))
    setDraftVariation(nextVariation)
    setDraftError('')
    setCopyStatus('')
    setStep(2)
  }

  async function copyDraft() {
    if (copying) return
    setCopying(true)
    setCopyStatus('')
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable.')
      await navigator.clipboard.writeText(draft)
      setCopyStatus('Review copied to your clipboard.')
    } catch {
      setCopyStatus('Copy was blocked. Select the draft text and copy it manually.')
    } finally {
      setCopying(false)
    }
  }

  if (loading) {
    return (
      <main className="review-assistant">
        <section className="review-panel review-panel--loading" aria-labelledby="review-loading-heading">
          <p className="review-brand"><span className="review-brand__mark" aria-hidden="true">R</span>ReviewTap</p>
          <p className="review-loading-copy" id="review-loading-heading" role="status">
            Loading this business’s review prompts…
          </p>
          <div className="review-skeleton" aria-hidden="true" />
          <div className="review-skeleton review-skeleton--short" aria-hidden="true" />
        </section>
      </main>
    )
  }

  if (loadError || !business) {
    return (
      <main className="review-assistant">
        <section className="review-panel review-panel--message" aria-labelledby="review-error-heading">
          <p className="review-brand"><span className="review-brand__mark" aria-hidden="true">R</span>ReviewTap</p>
          <span className="review-message-icon" aria-hidden="true">↗</span>
          <h1 id="review-error-heading">This review link is unavailable</h1>
          <p className="review-intro" role="alert">{loadError || 'We could not find this business.'}</p>
          <button className="review-button review-button--primary" type="button" onClick={retryLoading}>
            Try again
          </button>
          <p className="review-policy">If the problem continues, please contact the business directly.</p>
        </section>
        <footer className="review-footer">ReviewTap helps you share feedback in your own words.</footer>
      </main>
    )
  }

  return (
    <main className="review-assistant">
      <div className="review-shell">
        <header className="review-topbar">
          <a className="review-brand" href="/" aria-label="ReviewTap home">
            <span className="review-brand__mark" aria-hidden="true">R</span>
            ReviewTap
          </a>
          <span className="review-topbar__note">Your experience, your words</span>
        </header>

        <section className="review-panel" aria-labelledby="review-heading">
          <div className="review-welcome">
            <span className="review-category">{business.categoryLabel}</span>
            <p className="review-eyebrow">A note for {business.businessName}</p>
            <h1 id="review-heading">Share your experience</h1>
            <p className="review-intro">
              A few prompts can help you reflect. Choose only what matches your experience and shape it into your own words.
            </p>
          </div>

          <StepIndicator step={step} />

          <section className="review-step" aria-labelledby="topics-heading">
            <fieldset className="review-rating">
              <legend>How was your experience? <span className="review-optional">(optional)</span></legend>
              <div
                className="review-rating__choices"
                onMouseLeave={() => setRatingHover(null)}
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <label
                    className="review-rating__choice"
                    key={value}
                    onMouseEnter={() => setRatingHover(value)}
                  >
                    <input
                      className="review-rating__input"
                      type="radio"
                      name="experience-rating"
                      value={value}
                      checked={rating === value}
                      aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
                      onChange={() => setRating(value)}
                      onFocus={() => setRatingHover(null)}
                    />
                    <span
                      className={`review-rating__star${visibleRating >= value ? ' is-active' : ''}`}
                      aria-hidden="true"
                    >
                      ★
                    </span>
                  </label>
                ))}
              </div>
              <span className="review-rating__hint" aria-live="polite">
                {rating ? `${rating} out of 5 selected. You can still share any kind of feedback.` : 'Choose a rating if it helps you reflect.'}
              </span>
            </fieldset>
            <div className="review-section-heading">
              <div>
                <p className="review-step__eyebrow">Step 1</p>
                <h2 id="topics-heading" ref={topicsHeadingRef} tabIndex="-1">What would you like to mention?</h2>
              </div>
              <div className="review-selection-tools">
                <span className="review-selection-count" aria-live="polite">
                  {selectedTopics.length} selected
                </span>
                {selectedTopics.length > 0 && (
                  <button className="review-text-button" type="button" onClick={clearTopics}>
                    Clear selection
                  </button>
                )}
              </div>
            </div>
            <p className="review-muted" id="topics-description">
              {rating === 1 || rating === 2
                ? 'You may want to consider what could be improved. Pick any topics that reflect your experience.'
                : rating === 4 || rating === 5
                  ? 'You may want to consider what stood out. Pick any topics that reflect your experience.'
                  : 'Pick any topics that reflect your experience. These are ideas, not claims about what happened.'}
            </p>
            {staleSelectedTopics.length > 0 && (
              <div className="review-previously-selected" aria-labelledby="selected-topics-heading">
                <h3 id="selected-topics-heading">Still selected</h3>
                <p>
                  These topics are not suggested for this rating, but remain selected. Remove any you no longer want to include.
                </p>
                <div className="review-topics">
                  {staleSelectedTopics.map((topic) => (
                    <TopicButton
                      key={topic}
                      topic={topic}
                      selected
                      note="Not suggested for this rating"
                      onToggle={() => toggleTopic(topic)}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="review-topics" role="group" aria-labelledby="topics-heading" aria-describedby="topics-description">
              {suggestions.map((topic) => (
                <TopicButton
                  key={topic}
                  topic={topic}
                  selected={selectedTopics.includes(topic)}
                  onToggle={() => toggleTopic(topic)}
                />
              ))}
            </div>
            <label className="review-field" htmlFor="review-details">
              <span>Add a detail in your own words <span className="review-optional">(optional)</span></span>
              <textarea
                id="review-details"
                value={details}
                onChange={(event) => {
                  setDetails(event.target.value)
                  setDraftError('')
                  setCopyStatus('')
                }}
                maxLength={1000}
                rows={3}
                placeholder="What would you like other customers to know?"
              />
              <span className="review-character-count" aria-label={`${details.length} of 1000 characters`}>
                {details.length}/1000
              </span>
            </label>
            <p className="review-truth-note">
              Select only topics that reflect your actual experience. Your details are used only to prepare this draft.
            </p>
            {draftError && <p className="review-inline-error" role="alert">{draftError}</p>}
            <button
              className="review-button review-button--primary review-create-button"
              type="button"
              onClick={() => generateReviewDraft()}
            >
              Create my review
              <span aria-hidden="true">→</span>
            </button>
          </section>

          {step === 2 && (
            <section className="review-step review-draft" aria-labelledby="draft-heading">
              <div className="review-section-heading">
                <div>
                  <p className="review-step__eyebrow">Step 2</p>
                  <h2 id="draft-heading" ref={draftHeadingRef} tabIndex="-1">Make it yours</h2>
                </div>
                <span className="review-draft__hint">Your draft is editable</span>
              </div>
              <p className="review-muted">
                This draft reflects only the topics and details you provided. Edit it to match your experience before posting.
              </p>
              <label className="review-field" htmlFor="review-draft">
                <span className="visually-hidden">Editable review draft</span>
                <textarea
                  id="review-draft"
                  className="review-draft__textarea"
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value)
                    setCopyStatus('')
                  }}
                  maxLength={4000}
                  rows={6}
                />
                <span className="review-character-count" aria-label={`${draft.length} of 4000 characters`}>
                  {draft.length}/4000
                </span>
              </label>
              <div className="review-actions">
                <button className="review-button review-button--secondary" type="button" onClick={returnToTopics}>
                  Back to topics
                </button>
                <button className="review-button review-button--secondary" type="button" onClick={() => generateReviewDraft(true)}>
                  Regenerate draft
                </button>
                <button className="review-button review-button--secondary" type="button" onClick={copyDraft} disabled={!draft.trim() || copying}>
                  {copying ? 'Copying…' : 'Copy review'}
                </button>
                <a
                  className="review-button review-button--primary"
                  href={business.destinationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Continue to Google Reviews (opens in a new tab)"
                  onClick={() => setStep(3)}
                >
                  Continue to Google Reviews
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
              <p className="review-copy-status" role="status" aria-live="polite">{copyStatus}</p>
              <p className="review-policy">
                Review your text, choose your own rating on Google, and submit it there yourself. ReviewTap does not send your review.
              </p>
            </section>
          )}
        </section>

        <footer className="review-footer">
          <span>Powered by ReviewTap</span>
          <span>Not affiliated with or endorsed by Google.</span>
        </footer>
      </div>
    </main>
  )
}

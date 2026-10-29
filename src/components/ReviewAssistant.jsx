import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getReviewCategories,
  getReviewSuggestions,
  isValidBusinessCategory,
} from '../lib/reviewSuggestions'
import { createReviewDraft } from '../lib/reviewDraft'
import { Footer } from './Footer'
import './ReviewAssistant.css'

const generalCategoryId = 'other-general-business'
const categories = getReviewCategories()
const businessLoadTimeoutMs = 15000
const ratingReflectionCopy = {
  1: 'Think about what needs attention and what did not meet your expectations. Choose only points that match your experience.',
  2: 'You can describe the main disappointment or what could be improved. Choose only points that match your experience.',
  3: 'You can mention what worked well and what could have been better. Choose only points that match your experience.',
  4: 'You can mention what went well and any small change that could improve the experience.',
  5: 'Think about what stood out. You can also mention anything you feel could be improved.',
}

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

function StepIndicator({ step }) {
  const steps = ['Rate', 'Choose topics', 'Review and copy']
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
  const [draftSignature, setDraftSignature] = useState('')
  const [draftError, setDraftError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const [step, setStep] = useState(1)
  const [draftVariation, setDraftVariation] = useState(0)
  const ratingHeadingRef = useRef(null)
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
    if (step === 1) ratingHeadingRef.current?.focus()
    if (step === 2) topicsHeadingRef.current?.focus()
    if (step === 3) draftHeadingRef.current?.focus()
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
  const draftSourceSignature = JSON.stringify({
    businessName: business?.businessName,
    rating,
    selectedTopics,
    details,
  })
  const staleSelectedTopics = selectedTopics.filter((topic) => !suggestions.includes(topic))
  const visibleRating = ratingHover ?? rating
  const draftIsCurrent = draftSourceSignature === draftSignature

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

  function continueToTopics() {
    setStep(2)
  }

  function returnToRating() {
    setStep(1)
  }

  function returnToTopics() {
    setStep(2)
  }

  function generateReviewDraft(isRegenerating = false) {
    if (!selectedTopics.length && !details.trim()) {
      setDraftError('Choose at least one topic or add a detail from your experience to create a draft.')
      return
    }
    const nextVariation = isRegenerating ? draftVariation + 1 : draftVariation
    setDraft(createReviewDraft({
      businessName: business.businessName,
      topics: selectedTopics,
      details,
      rating,
    }, nextVariation))
    setDraftSignature(draftSourceSignature)
    setDraftVariation(nextVariation)
    setDraftError('')
    setCopyStatus('')
    setStep(3)
  }

  async function copyDraft() {
    if (copying) return
    if (!draftIsCurrent) {
      setCopyStatus('Your rating, topics, or details changed. Update the draft before copying it.')
      return
    }
    setCopying(true)
    setCopyStatus('')
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable.')
      await navigator.clipboard.writeText(draft)
      setCopyStatus('Draft copied to your clipboard.')
    } catch {
      setCopyStatus('Copy was blocked. Select the draft text and copy it manually.')
    } finally {
      setCopying(false)
    }
  }

  if (loading) {
    return (
      <main className="review-assistant">
        <div className="review-shell">
          <section className="review-panel review-panel--loading" aria-labelledby="review-loading-heading">
            <a className="review-brand" href="/" aria-label="ReviewTap home">
              <img src="/reviewtap-logo.svg" alt="" width="196" height="40" />
            </a>
            <p className="review-loading-copy" id="review-loading-heading" role="status">
              Loading this business’s review prompts…
            </p>
            <div className="review-skeleton" aria-hidden="true" />
            <div className="review-skeleton review-skeleton--short" aria-hidden="true" />
          </section>
          <Footer variant="review" />
        </div>
      </main>
    )
  }

  if (loadError || !business) {
    return (
      <main className="review-assistant">
        <div className="review-shell">
          <section className="review-panel review-panel--message" aria-labelledby="review-error-heading">
            <a className="review-brand" href="/" aria-label="ReviewTap home">
              <img src="/reviewtap-logo.svg" alt="" width="196" height="40" />
            </a>
            <span className="review-message-icon" aria-hidden="true">↗</span>
            <h1 id="review-error-heading">This review link is unavailable</h1>
            <p className="review-intro" role="alert">{loadError || 'We could not find this business.'}</p>
            <button className="review-button review-button--primary" type="button" onClick={retryLoading}>
              Try again
            </button>
            <p className="review-policy">If the problem continues, please contact the business directly.</p>
          </section>
          <Footer variant="review" />
        </div>
      </main>
    )
  }

  return (
    <main className="review-assistant">
      <div className="review-shell">
        <header className="review-topbar">
          <a className="review-brand" href="/" aria-label="ReviewTap home">
            <img src="/reviewtap-logo.svg" alt="" width="196" height="40" />
          </a>
          <span className="review-topbar__note">Your experience, your words</span>
        </header>

        <section className="review-panel" aria-labelledby="review-heading">
          <StepIndicator step={step} />
          <div className="review-welcome">
            <span className="review-category">{business.categoryLabel}</span>
            <p className="review-eyebrow">Your visit to</p>
            <h1 id="review-heading">{business.businessName}</h1>
          </div>

          {step === 1 && (
            <section className="review-step review-rating-step" aria-labelledby="rating-heading">
              <div className="review-step-heading">
                <p className="review-step__eyebrow">Step 1 of 3</p>
                <h2 id="rating-heading" ref={ratingHeadingRef} tabIndex="-1">How was your experience?</h2>
                <p className="review-muted">Choose the rating that feels right. You can share any kind of feedback.</p>
              </div>
              <fieldset className="review-rating">
                <legend>
                  Your rating <span className="review-optional">(optional)</span>
                </legend>
                <div className="review-rating__choices" onMouseLeave={() => setRatingHover(null)}>
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
                      <span className={`review-rating__star${visibleRating >= value ? ' is-active' : ''}`} aria-hidden="true">
                        ★
                      </span>
                    </label>
                  ))}
                </div>
                <span className="review-rating__hint" aria-live="polite">
                  {rating
                    ? `${rating} out of 5 selected. You can still share any kind of feedback.`
                    : 'No rating selected. You can continue whenever you are ready.'}
                </span>
              </fieldset>
              <button
                className="review-button review-button--primary review-primary-action"
                type="button"
                onClick={continueToTopics}
              >
                Choose topics <span aria-hidden="true">→</span>
              </button>
            </section>
          )}

          {step === 2 && (
            <section className="review-step review-topics-step" aria-labelledby="topics-heading">
              <div className="review-section-heading">
                <div>
                  <p className="review-step__eyebrow">Step 2 of 3</p>
                  <h2 id="topics-heading" ref={topicsHeadingRef} tabIndex="-1">What would you like to mention?</h2>
                </div>
                <div className="review-selection-tools">
                  <span className="review-selection-count" aria-live="polite">{selectedTopics.length} selected</span>
                  {selectedTopics.length > 0 && (
                    <button className="review-text-button" type="button" onClick={clearTopics}>
                      Clear selection
                    </button>
                  )}
                </div>
              </div>
              <p className="review-muted" id="topics-description">
                {rating
                  ? ratingReflectionCopy[rating]
                  : 'Pick any topics that reflect your visit. These are ideas, not claims about what happened.'}
              </p>
              <button
                className="review-rating-summary"
                type="button"
                onClick={returnToRating}
                aria-label="Change rating"
              >
                {rating ? `${rating} out of 5 stars` : 'Add a rating (optional)'}
                <span className="review-rating-summary__action" aria-hidden="true">Change</span>
              </button>
              {staleSelectedTopics.length > 0 && (
                <div className="review-previously-selected" aria-labelledby="selected-topics-heading">
                  <h3 id="selected-topics-heading">Still selected</h3>
                  <p>These are not suggested for this rating, but remain selected. Remove any you no longer want to include.</p>
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
                Select only topics that reflect your experience. Your details are used only to prepare this draft.
              </p>
              {draftError && <p className="review-inline-error" role="alert">{draftError}</p>}
              <div className="review-step-actions">
                <button className="review-button review-button--secondary" type="button" onClick={returnToRating}>
                  Back
                </button>
                <button
                  className="review-button review-button--primary review-primary-action"
                  type="button"
                  onClick={() => generateReviewDraft()}
                >
                  {draftSignature ? 'Update draft' : 'Create my draft'} <span aria-hidden="true">→</span>
                </button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="review-step review-draft" aria-labelledby="draft-heading">
              <div className="review-section-heading">
                <div>
                  <p className="review-step__eyebrow">Step 3 of 3</p>
                  <h2 id="draft-heading" ref={draftHeadingRef} tabIndex="-1">Make it yours</h2>
                </div>
              </div>
              <p className="review-muted">
                This draft reflects only the topics and details you provided. Edit it to match your experience before posting.
              </p>
              {!draftIsCurrent && (
                <p className="review-inline-error" role="alert">
                  Your rating, topics, or details have changed. Update the draft before copying it.
                </p>
              )}
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
                <a
                  className="review-button review-button--primary"
                  href={business.destinationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Continue to Google Reviews (opens in a new tab)"
                >
                  Continue to Google Reviews
                  <span aria-hidden="true">↗</span>
                </a>
                <button className="review-button review-button--secondary" type="button" onClick={copyDraft} disabled={!draft.trim() || copying || !draftIsCurrent}>
                  {copying ? 'Copying…' : 'Copy review'}
                </button>
                <div className="review-secondary-actions">
                  <button className="review-button review-button--text" type="button" onClick={returnToTopics}>
                    Back to topics
                  </button>
                  <button className="review-button review-button--text" type="button" onClick={() => generateReviewDraft(true)}>
                    Regenerate draft
                  </button>
                </div>
              </div>
              <p className="review-copy-status" role="status" aria-live="polite">{copyStatus}</p>
              <p className="review-policy">
                Review your text, choose your own rating on Google, and submit it there yourself. ReviewTap does not send your review.
              </p>
            </section>
          )}
        </section>

        <Footer variant="review" />
      </div>
    </main>
  )
}

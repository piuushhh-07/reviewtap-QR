import { useEffect, useMemo, useState } from 'react'
import './ReviewAssistant.css'

const categories = {
  cafe: {
    label: 'Cafe or restaurant',
    prompts: [
      'What did you order, and how was it?',
      'Were menu options and prices clear?',
      'How long did ordering and serving take?',
      'How did the food or drink match your expectations?',
      'Was the dining area comfortable and clean?',
      'How would you describe the atmosphere?',
      'How did staff handle a question or request?',
      'What would you change or improve?',
    ],
  },
  pharmacy: {
    label: 'Pharmacy',
    prompts: [
      'Were you able to find the product you needed?',
      'Was the availability or waiting time explained clearly?',
      'Was the staff communication helpful and respectful?',
      'Were prices and payment details clear?',
      'Was the store easy to navigate?',
      'Was the collection process straightforward?',
      'Was any delay or stock issue communicated clearly?',
      'What could make the visit easier next time?',
    ],
  },
  dental: {
    label: 'Dentist or dental clinic',
    prompts: [
      'Was the appointment process straightforward?',
      'Were the treatment steps explained in a way you understood?',
      'Did you feel your questions were listened to?',
      'How was the waiting time?',
      'Was the clinic comfortable and clean?',
      'Were costs and next steps explained clearly?',
      'How was the staff communication before and after the visit?',
      'What would have improved your experience?',
    ],
  },
  clinic: {
    label: 'Clinic or healthcare',
    prompts: [
      'Was booking and check-in straightforward?',
      'Were waiting times communicated clearly?',
      'Were your questions heard and answered?',
      'Was information about next steps clear?',
      'Was the space comfortable and clean?',
      'Was the staff communication respectful?',
      'Were fees or paperwork explained clearly?',
      'What could improve the visit experience?',
    ],
  },
  salon: {
    label: 'Salon or spa',
    prompts: [
      'Did the service match what you asked for?',
      'Was the consultation clear before the service?',
      'How was the appointment timing?',
      'Was the space comfortable and clean?',
      'Were prices and optional add-ons explained clearly?',
      'How did staff respond to your preferences?',
      'What part of the experience stood out?',
      'What would you change for next time?',
    ],
  },
  hotel: {
    label: 'Hotel or accommodation',
    prompts: [
      'Was check-in and check-out straightforward?',
      'How did the room match its description?',
      'How was cleanliness and comfort?',
      'Were facilities and house rules explained clearly?',
      'How did staff handle requests or issues?',
      'Was noise or the location a factor in your stay?',
      'Were prices and extra charges clear?',
      'What would you want future guests to know?',
    ],
  },
  retail: {
    label: 'Retail or local shop',
    prompts: [
      'Did you find the item you were looking for?',
      'Was product information clear and useful?',
      'Were prices, returns, and warranty terms explained?',
      'How was the checkout experience?',
      'Was the store easy to browse?',
      'How did staff respond to questions?',
      'Was the product as described?',
      'What could make shopping easier?',
    ],
  },
  other: {
    label: 'Other business or service',
    prompts: [
      'What service or product did you use?',
      'Was the process easy to understand?',
      'Were costs and timelines clear?',
      'How was communication before and during the service?',
      'Did the result match your expectations?',
      'How were questions or problems handled?',
      'What detail would help another customer decide?',
      'What could be improved?',
    ],
  },
}

const generalPrompts = [
  'What brought you to this business?',
  'What went as expected?',
  'Was anything confusing or inconvenient?',
  'How easy was it to get the information you needed?',
  'How would you describe the overall experience in your own words?',
  'Was the location or accessibility convenient?',
  'Were staff or service providers clear in their communication?',
  'Did anything stand out, positively or negatively?',
  'Was the value for the price clear to you?',
  'How was the booking, ordering, or payment process?',
  'If something went wrong, how was it handled?',
  'What would you tell a friend considering this business?',
]

export function ReviewAssistant() {
  const qrId = window.location.pathname.split('/').filter(Boolean).at(-1)
  const [business, setBusiness] = useState(null)
  const [error, setError] = useState('')
  const [category, setCategory] = useState('other')
  const [selected, setSelected] = useState([])
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let current = true
    fetch(`/api/public/qrs/${encodeURIComponent(qrId || '')}`)
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'This review link is unavailable.')
        return payload
      })
      .then((payload) => {
        if (current) {
          setBusiness(payload)
          setCategory(categories[payload.category] ? payload.category : 'other')
        }
      })
      .catch((requestError) => {
        if (current) setError(requestError.message)
      })
    return () => {
      current = false
    }
  }, [qrId])

  const prompts = useMemo(() => [...generalPrompts, ...categories[category].prompts], [category])

  function togglePrompt(prompt) {
    setSelected((current) => current.includes(prompt)
      ? current.filter((item) => item !== prompt)
      : [...current, prompt])
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft)
      setCopied(true)
    } catch {
      setError('Copy was blocked by your browser. You can still select and copy your text manually.')
    }
  }

  if (error && !business) {
    return <main className="review-assistant"><section className="review-panel"><p className="review-eyebrow">ReviewTap</p><h1>Review link unavailable</h1><p role="alert">{error}</p></section></main>
  }

  if (!business) {
    return <main className="review-assistant"><section className="review-panel"><p role="status">Loading review details…</p></section></main>
  }

  return (
    <main className="review-assistant">
      <section className="review-panel">
        <p className="review-eyebrow">ReviewTap · Your experience, your words</p>
        <h1>Share your experience with {business.business_name}</h1>
        <p className="review-intro">A few prompts can help you remember the details. Choose any that are relevant, then write an honest review in your own words.</p>

        <label className="review-field">
          <span>Business type</span>
          <select value={category} onChange={(event) => { setCategory(event.target.value); setSelected([]) }}>
            {Object.entries(categories).map(([key, value]) => <option value={key} key={key}>{value.label}</option>)}
          </select>
        </label>

        <div className="review-prompts">
          <div className="review-section-heading">
            <h2>Prompts to consider</h2>
            <span>{selected.length} selected · {prompts.length} ideas</span>
          </div>
          <p className="review-muted">Pick details that reflect your actual visit. You do not need to answer every prompt.</p>
          <div className="review-prompt-grid">
            {prompts.map((prompt) => (
              <label className={`review-prompt ${selected.includes(prompt) ? 'is-selected' : ''}`} key={prompt}>
                <input type="checkbox" checked={selected.includes(prompt)} onChange={() => togglePrompt(prompt)} />
                <span>{prompt}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="review-field review-field--draft">
          <span>Your review draft</span>
          <textarea
            value={draft}
            onChange={(event) => { setDraft(event.target.value); setCopied(false) }}
            rows={6}
            maxLength={4000}
            placeholder="Describe what actually happened, including anything you liked or think could be better. Only include details you can personally stand behind."
          />
          <span className="review-muted">{draft.length}/4000 characters. Your text stays in this page until you choose to copy it.</span>
        </label>

        {error && <p className="review-inline-error" role="alert">{error}</p>}
        <div className="review-actions">
          <button className="review-button review-button--secondary" type="button" onClick={copyDraft} disabled={!draft.trim()}>{copied ? 'Copied' : 'Copy draft'}</button>
          <a className="review-button" href={business.destination_url} target="_blank" rel="noreferrer">Continue to Google Reviews ↗</a>
        </div>
        <p className="review-policy">Choose your own star rating on Google and post only a review that reflects your real experience. ReviewTap does not select a rating or submit anything for you.</p>
      </section>
      <footer className="review-footer">Powered by ReviewTap</footer>
    </main>
  )
}

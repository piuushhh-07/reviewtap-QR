import { useDeferredValue, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { adminApi, jsonRequest } from '../lib/adminApi'
import { generateQrCode } from '../lib/generateQrCode'
import { validateBusinessName, validateGoogleReviewUrl } from '../lib/validateReviewUrl'
import { getReviewCategories, isValidBusinessCategory } from '../lib/reviewSuggestions'
import './AdminDashboard.css'

const pageSize = 25
const generalBusinessCategoryId = 'other-general-business'
const reviewCategories = getReviewCategories()

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

function downloadFile(contents, filename, type) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([contents], { type }))
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

async function fetchAllQrs(search, status, businessId) {
  const qrs = []
  let offset = 0
  let total = 0
  do {
    const params = new URLSearchParams({ limit: '100', offset: String(offset) })
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    if (businessId) params.set('business_id', businessId)
    const result = await adminApi(`/api/qrs?${params}`)
    qrs.push(...result.qrs)
    total = result.total
    offset += result.qrs.length
    if (!result.qrs.length && offset < total) {
      throw new Error('The inventory changed during export. Please retry.')
    }
  } while (offset < total)
  return qrs
}

function QrThumbnail({ qr }) {
  const [image, setImage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let current = true
    generateQrCode(qr.dynamic_url)
      .then((dataUrl) => {
        if (current) setImage(dataUrl)
      })
      .catch(() => {
        if (current) setError('Preview unavailable')
      })
    return () => {
      current = false
    }
  }, [qr.dynamic_url])
  if (error) return <span className="qr-thumb__error">{error}</span>
  if (!image) return <span className="qr-thumb__loading">Loading QR…</span>
  return <img className="qr-thumb" src={image} alt={`QR code ${qr.id}`} />
}

function Login({ onLogin }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onLogin(password)
    } catch (loginError) {
      setError(loginError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="admin-login">
      <form className="admin-login__card" onSubmit={handleSubmit}>
        <p className="eyebrow">ReviewTap management</p>
        <h1>Admin sign in</h1>
        <p>Sign in to generate QR codes, program business destinations, and manage your inventory.</p>
        <label className="field">
          <span>Admin password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <button className="btn btn--primary btn--full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <a className="admin-login__home" href="/">Back to ReviewTap</a>
      </form>
    </main>
  )
}

function QrRow({ qr, selected, onSelect, onAssign, onAction, onTest, onDownload }) {
  const [testResult, setTestResult] = useState(null)
  const [testError, setTestError] = useState('')

  async function testRedirect() {
    setTestResult(null)
    setTestError('')
    try {
      const result = await onTest(qr.id)
      setTestResult(result)
    } catch (error) {
      setTestError(error.message)
    }
  }

  return (
    <tr>
      <td>
        <input
          type="checkbox"
          checked={selected}
          aria-label={`Select ${qr.inventory_code || qr.id}`}
          onChange={(event) => onSelect(qr, event.target.checked)}
        />
      </td>
      <td>
        <QrThumbnail qr={qr} />
      </td>
      <td>
        <strong className="inventory-code">{qr.inventory_code}</strong>
        <code>{qr.id}</code>
        <a className="qr-row__url" href={qr.dynamic_url} target="_blank" rel="noreferrer">
          {qr.dynamic_url}
        </a>
      </td>
      <td><span className={`status-pill status-pill--${qr.status}`}>{qr.status}</span></td>
      <td>
        {qr.business_name || '—'}
        {qr.destination_url && (
          <a className="qr-row__url" href={qr.destination_url} target="_blank" rel="noreferrer">
            {qr.destination_url}
          </a>
        )}
      </td>
      <td>{formatDate(qr.created_at)}</td>
      <td>
        <div className="qr-actions">
          {qr.status === 'unassigned' && (
            <button className="btn btn--small btn--primary" onClick={() => onAssign(qr)}>
              Program
            </button>
          )}
          {qr.status === 'assigned' && (
            <button className="btn btn--small btn--secondary" onClick={testRedirect}>
              Test redirect
            </button>
          )}
          {qr.status !== 'disabled' && (
            <button className="btn btn--small btn--secondary" onClick={() => onDownload(qr, 'png')}>
              PNG
            </button>
          )}
          {qr.status !== 'disabled' && (
            <button className="btn btn--small btn--secondary" onClick={() => onDownload(qr, 'svg')}>
              SVG
            </button>
          )}
          {qr.status !== 'disabled' && (
            <button className="btn btn--small btn--secondary" onClick={() => onAction(qr, 'disable')}>
              Disable
            </button>
          )}
          {qr.status === 'disabled' && (
            <button className="btn btn--small btn--secondary" onClick={() => onAction(qr, 'enable')}>
              Enable
            </button>
          )}
          {qr.business_id && (
            <button className="btn btn--small btn--danger" onClick={() => onAction(qr, 'reset')}>
              Reset assignment
            </button>
          )}
          {testResult && (
            <p className="qr-actions__test" role="status">
              Redirect target verified: <a href={testResult.redirect_url} target="_blank" rel="noreferrer">open QR endpoint</a>
              <span>{testResult.destination_url}</span>
            </p>
          )}
          {testError && <p className="admin-error" role="alert">{testError}</p>}
        </div>
      </td>
    </tr>
  )
}

function QrDialog({ qr, businesses, onClose, onSubmit }) {
  const [businessId, setBusinessId] = useState('')
  const [name, setName] = useState('')
  const [reviewUrl, setReviewUrl] = useState('')
  const [categoryId, setCategoryId] = useState(generalBusinessCategoryId)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const creating = businessId === '__new__'
  const selectedBusiness = businesses.find((business) => business.id === businessId)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!businessId) {
      setError('Select a business or choose Add a business.')
      return
    }
    if (creating) {
      const nameResult = validateBusinessName(name)
      const urlResult = validateGoogleReviewUrl(reviewUrl)
      if (!nameResult.valid) return setError(nameResult.message)
      if (!urlResult.valid) return setError(urlResult.message)
    }
    setBusy(true)
    setError('')
    try {
      await onSubmit(
        qr,
        creating
          ? { name, review_url: reviewUrl, category_id: categoryId }
          : { business_id: businessId },
      )
      onClose()
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="assign-heading">
        <button className="admin-dialog__close" type="button" onClick={onClose} aria-label="Close">×</button>
        <p className="eyebrow">Program QR code</p>
        <h2 id="assign-heading">{qr.inventory_code || qr.id}</h2>
        <p className="qr-assignment-id">{qr.id}</p>
        <p>This QR will permanently point to the selected business until an admin explicitly resets it.</p>
        {selectedBusiness && (
          <p className="qr-assignment-confirmation">
            Assign {qr.inventory_code || qr.id} to <strong>{selectedBusiness.name}</strong>?
          </p>
        )}
        <form className="admin-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Business</span>
            <select value={businessId} onChange={(event) => setBusinessId(event.target.value)} required>
              <option value="">Select a business</option>
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>{business.name}</option>
              ))}
              <option value="__new__">Add a business…</option>
            </select>
          </label>
          {creating && (
            <>
              <label className="field">
                <span>Business name</span>
                <input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label className="field">
                <span>Business category</span>
                <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                  {reviewCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.label}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Google review URL</span>
                <input required type="text" inputMode="url" placeholder="https://g.page/r/..." value={reviewUrl} onChange={(event) => setReviewUrl(event.target.value)} />
                <span className="field__help">Google review, Google Maps, or Google short links only.</span>
              </label>
            </>
          )}
          {error && <p className="admin-error" role="alert">{error}</p>}
          <div className="admin-dialog__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn--primary" disabled={busy}>{busy ? 'Saving…' : 'Confirm assignment'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

function BusinessForm({ business, onClose, onSubmit }) {
  const [name, setName] = useState(business?.name ?? '')
  const [reviewUrl, setReviewUrl] = useState(business?.review_url ?? '')
  const [categoryId, setCategoryId] = useState(
    isValidBusinessCategory(business?.category_id)
      ? business.category_id
      : generalBusinessCategoryId,
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const nameResult = validateBusinessName(name)
    const urlResult = validateGoogleReviewUrl(reviewUrl)
    if (!nameResult.valid) return setError(nameResult.message)
    if (!urlResult.valid) return setError(urlResult.message)
    setBusy(true)
    setError('')
    try {
      await onSubmit(business?.id, {
        name: nameResult.normalizedName,
        review_url: urlResult.normalizedUrl,
        category_id: categoryId,
      })
      onClose()
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="business-form-heading">
        <button className="admin-dialog__close" type="button" onClick={onClose} aria-label="Close">×</button>
        <p className="eyebrow">{business ? 'Business details' : 'New business'}</p>
        <h2 id="business-form-heading">{business ? 'Edit business' : 'Add a business'}</h2>
        <form className="admin-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Business name</span>
            <input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="field">
            <span>Business category</span>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              {reviewCategories.map((category) => (
                <option key={category.id} value={category.id}>{category.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Google review URL</span>
            <input required type="url" placeholder="https://g.page/r/..." value={reviewUrl} onChange={(event) => setReviewUrl(event.target.value)} />
            <span className="field__help">Changes update every QR assigned to this business.</span>
          </label>
          {error && <p className="admin-error" role="alert">{error}</p>}
          <div className="admin-dialog__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn--primary" disabled={busy}>{busy ? 'Saving…' : business ? 'Save changes' : 'Add business'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

export function AdminDashboard() {
  const [authState, setAuthState] = useState('checking')
  const [page, setPage] = useState('qrs')
  const [qrs, setQrs] = useState([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState({ unassigned: 0, assigned: 0, disabled: 0 })
  const [inventoryRevision, setInventoryRevision] = useState(0)
  const [businesses, setBusinesses] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [countInput, setCountInput] = useState('1')
  const generationRequest = useRef(null)
  const [lastBatch, setLastBatch] = useState([])
  const [selectedQrs, setSelectedQrs] = useState(() => new Map())
  const [searchInput, setSearchInput] = useState('')
  const search = useDeferredValue(searchInput.trim())
  const [status, setStatus] = useState('')
  const [businessFilter, setBusinessFilter] = useState('')
  const [offset, setOffset] = useState(0)
  const [assigning, setAssigning] = useState(null)
  const [editingBusiness, setEditingBusiness] = useState(null)
  const [showBusinessForm, setShowBusinessForm] = useState(false)

  useEffect(() => {
    let current = true
    adminApi('/api/auth/session')
      .then((result) => {
        if (current) setAuthState(result.authenticated ? 'signed-in' : 'signed-out')
      })
      .catch((sessionError) => {
        if (current) {
          setError(sessionError.message)
          setAuthState('signed-out')
        }
      })
    return () => {
      current = false
    }
  }, [])

  useEffect(() => {
    if (authState !== 'signed-in') return undefined
    let current = true
    async function loadInventory() {
      try {
        const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) })
        if (search) params.set('search', search)
        if (status) params.set('status', status)
        if (businessFilter) params.set('business_id', businessFilter)
        const [qrResult, businessResult] = await Promise.all([
          adminApi(`/api/qrs?${params}`),
          adminApi('/api/businesses'),
        ])
        if (!current) return
        setError('')
        setQrs(qrResult.qrs)
        setTotal(qrResult.total)
        setSummary(qrResult.summary)
        setBusinesses(businessResult.businesses)
        if (offset > 0 && offset >= qrResult.total) setOffset(Math.max(0, offset - pageSize))
      } catch (loadError) {
        if (!current) return
        if (loadError.message.includes('Sign in')) setAuthState('signed-out')
        else setError(loadError.message)
      }
    }
    loadInventory()
    return () => {
      current = false
    }
  }, [authState, businessFilter, inventoryRevision, offset, search, status])

  function refreshInventory() {
    setInventoryRevision((revision) => revision + 1)
  }

  function selectQr(qr, selected) {
    setSelectedQrs((current) => {
      const next = new Map(current)
      if (selected) next.set(qr.id, qr)
      else next.delete(qr.id)
      return next
    })
  }

  function selectVisibleQrs(selected) {
    setSelectedQrs((current) => {
      const next = new Map(current)
      for (const qr of qrs) {
        if (selected) next.set(qr.id, qr)
        else next.delete(qr.id)
      }
      return next
    })
  }

  function printSelectedQrs() {
    const selected = [...selectedQrs.values()]
    if (!selected.length) {
      setError('Select one or more QR stands to print.')
      return
    }
    printBatch(selected)
  }

  async function login(password) {
    await adminApi('/api/auth/login', jsonRequest('POST', { password }))
    setAuthState('signed-in')
  }

  async function logout() {
    await adminApi('/api/auth/logout', jsonRequest('POST', {}))
    setAuthState('signed-out')
    setQrs([])
  }

  async function generateBatch(event) {
    event.preventDefault()
    const count = Number(countInput)
    if (!Number.isInteger(count) || count < 1 || count > 500) {
      setError('Generate between 1 and 500 QR codes at a time.')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (!generationRequest.current || generationRequest.current.count !== count) {
        generationRequest.current = { id: window.crypto.randomUUID(), count }
      }
      const result = await adminApi('/api/qrs', jsonRequest('POST', {
        count,
        request_id: generationRequest.current.id,
      }))
      generationRequest.current = null
      setLastBatch(result.qrs)
      setStatus('unassigned')
      setBusinessFilter('')
      setSearchInput('')
      setOffset(0)
      setPage('qrs')
      refreshInventory()
    } catch (generateError) {
      setError(generateError.message)
    } finally {
      setBusy(false)
    }
  }

  async function assignQr(qr, business) {
    await adminApi(`/api/qrs/${encodeURIComponent(qr.id)}/assign`, jsonRequest('POST', business))
    setStatus('')
    refreshInventory()
  }

  async function changeQr(qr, action) {
    const prompt = action === 'reset'
      ? `Reset ${qr.id}? Its current business assignment will be removed and the QR can be programmed again.`
      : action === 'disable'
        ? `Disable ${qr.id}? Scans will no longer open the review page.`
        : `Enable ${qr.id} again?`
    if (!window.confirm(prompt)) return
    setError('')
    try {
      await adminApi(`/api/qrs/${encodeURIComponent(qr.id)}/${action}`, jsonRequest('POST', action === 'reset' ? { confirm: true } : {}))
      refreshInventory()
    } catch (actionError) {
      setError(actionError.message)
    }
  }

  async function testQr(id) {
    return adminApi(`/api/qrs/${encodeURIComponent(id)}/test`)
  }

  async function downloadQr(qr, format) {
    try {
      const qrSvg = await QRCode.toString(qr.dynamic_url, {
        type: 'svg',
        errorCorrectionLevel: 'H',
        margin: 4,
        width: 640,
        color: { dark: '#000000', light: '#ffffff' },
      })
      const { createLabeledQrSvg, svgToPngDataUrl } = await import('../lib/qrPrintLayout')
      const label = { qrId: qr.inventory_code || qr.id, businessName: qr.business_name || 'Unassigned' }
      const labeledSvg = createLabeledQrSvg(qrSvg, label)
      if (format === 'png') {
        const image = await svgToPngDataUrl(labeledSvg)
        const link = document.createElement('a')
        link.href = image
        link.download = `${qr.inventory_code || qr.id}.png`
        link.click()
      } else {
        downloadFile(labeledSvg, `${qr.inventory_code || qr.id}.svg`, 'image/svg+xml;charset=utf-8')
      }
    } catch (downloadError) {
      setError(`Could not create the ${format.toUpperCase()} file: ${downloadError.message}`)
    }
  }

  async function exportCsv() {
    try {
      const allQrs = await fetchAllQrs(search, status, businessFilter)
      const csvCell = (value) => {
        const text = String(value ?? '')
        const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
        return `"${safe.replace(/"/g, '""')}"`
      }
      const lines = [
        ['Inventory code', 'QR ID', 'Status', 'Business', 'Created at', 'Assigned at', 'Destination URL', 'Dynamic QR URL'],
        ...allQrs.map((qr) => [qr.inventory_code, qr.id, qr.status, qr.business_name, qr.created_at, qr.assigned_at, qr.destination_url, qr.dynamic_url]),
      ]
      downloadFile(lines.map((line) => line.map(csvCell).join(',')).join('\r\n'), 'reviewtap-qr-inventory.csv', 'text/csv;charset=utf-8')
    } catch (exportError) {
      setError(exportError.message)
    }
  }

  async function printBatch(batch) {
    if (!batch.length) {
      setError('Generate a batch first, or use Print visible page from the inventory.')
      return
    }
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setError('Allow pop-ups to open the printable QR batch.')
      return
    }
    try {
      const cards = await Promise.all(batch.map(async (qr) => {
        const image = await generateQrCode(qr.dynamic_url)
        return `<article class="print-card"><header><img class="print-logo" src="${window.location.origin}/reviewtap-logo.png" alt="ReviewTap"></header><img class="print-qr" src="${image}" alt="QR code for ${escapeHtml(qr.inventory_code)}"><h2>${escapeHtml(qr.inventory_code)}</h2><p class="print-business">${escapeHtml(qr.business_name || 'Unassigned stand')}</p><p class="print-instruction">Scan to leave a review.</p></article>`
      }))
      printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>ReviewTap QR stands</title><style>@page{size:A4 portrait;margin:8mm}*{box-sizing:border-box}html,body{margin:0;padding:0;font:10pt Arial,sans-serif;color:#10243b}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:85mm;gap:4mm}.print-card{height:85mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between;overflow:hidden;padding:2mm;border:0.35mm solid #d5deeb;border-radius:3mm;text-align:center;break-inside:avoid;page-break-inside:avoid}.print-card header{width:100%;height:13mm;display:flex;justify-content:flex-end;align-items:center}.print-logo{width:13mm;height:13mm;object-fit:contain;background:#020715;border-radius:2mm}.print-qr{width:44mm;height:44mm;object-fit:contain;image-rendering:pixelated}.print-card h2{margin:0;font-size:17pt;letter-spacing:.04em}.print-business{max-width:100%;margin:0;font-size:9pt;overflow-wrap:anywhere}.print-instruction{margin:0;font-size:10pt;font-weight:700}@media screen{body{padding:10mm}.print-card{box-shadow:0 1mm 4mm #0002}}@media print{.grid{gap:4mm}.print-card{box-shadow:none}}</style></head><body><main class="grid">${cards.join('')}</main><script>Promise.all([...document.images].map(image=>image.decode().catch(()=>{}))).then(()=>window.print())</script></body></html>`)
      printWindow.document.close()
    } catch (printError) {
      printWindow.close()
      setError(`Could not prepare the printable batch: ${printError.message}`)
    }
  }

  async function saveBusiness(id, details) {
    if (id) {
      await adminApi(`/api/businesses/${encodeURIComponent(id)}`, jsonRequest('PUT', details))
    } else {
      await adminApi('/api/businesses', jsonRequest('POST', details))
    }
    refreshInventory()
  }

  if (authState === 'checking') {
    return <main className="admin-shell"><p role="status">Checking admin session…</p></main>
  }
  if (authState !== 'signed-in') return <Login onLogin={login} />

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.floor(offset / pageSize) + 1

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <a href="/" className="admin-header__brand"><span className="admin-header__mark">R</span>ReviewTap</a>
        <div className="admin-header__right">
          <span>QR management</span>
          <button className="btn btn--small btn--secondary" onClick={logout}>Sign out</button>
        </div>
      </header>
      <div className="admin-content">
        <div className="admin-page-heading">
          <div>
            <p className="eyebrow">Dynamic QR management</p>
            <h1>QR inventory</h1>
            <p>Generate unassigned codes, then program each code to a business. Printed codes stay the same when a review URL changes.</p>
          </div>
          <form className="generate-form" onSubmit={generateBatch}>
            <label className="field">
              <span>New QR codes</span>
              <input type="number" min="1" max="500" value={countInput} onChange={(event) => setCountInput(event.target.value)} />
            </label>
            <button className="btn btn--primary" disabled={busy}>{busy ? 'Generating…' : 'Generate codes'}</button>
          </form>
        </div>
        <div className="admin-stats" aria-label="QR inventory summary">
          <div><span>Visible</span><strong>{total}</strong></div>
          <div><span>Unassigned</span><strong>{summary.unassigned}</strong></div>
          <div><span>Businesses</span><strong>{businesses.length}</strong></div>
        </div>
        <div className="admin-tabs" role="tablist" aria-label="Management sections">
          <button role="tab" aria-selected={page === 'qrs'} className={page === 'qrs' ? 'is-active' : ''} onClick={() => setPage('qrs')}>QR codes</button>
          <button role="tab" aria-selected={page === 'businesses'} className={page === 'businesses' ? 'is-active' : ''} onClick={() => setPage('businesses')}>Businesses</button>
        </div>
        {error && <div className="admin-error-banner" role="alert">{error}</div>}
        {lastBatch.length > 0 && (
          <div className="batch-notice" role="status">
            Generated {lastBatch.length} unassigned QR code{lastBatch.length === 1 ? '' : 's'}.
            <span>{lastBatch.map((qr) => qr.inventory_code).join(', ')}</span>
            <button className="btn btn--small btn--secondary" onClick={() => printBatch(lastBatch)}>Print last batch</button>
          </div>
        )}
        {page === 'qrs' ? (
          <>
            <div className="inventory-toolbar">
              <label className="field inventory-toolbar__search">
                <span>Search inventory</span>
                <input type="search" placeholder="Short code, QR ID, business, or URL" value={searchInput} onChange={(event) => { setSearchInput(event.target.value); setOffset(0) }} />
              </label>
              <label className="field">
                <span>Status</span>
                <select value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0) }}>
                  <option value="">All statuses</option>
                  <option value="unassigned">Unassigned</option>
                  <option value="assigned">Assigned</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
              {businessFilter && <button className="btn btn--small btn--secondary" onClick={() => { setBusinessFilter(''); setOffset(0) }}>Clear business filter</button>}
              <div className="inventory-toolbar__exports">
                <button className="btn btn--small btn--secondary" onClick={exportCsv}>Export CSV</button>
                <button className="btn btn--small btn--secondary" onClick={() => printBatch(qrs)}>Print visible page</button>
                <button className="btn btn--small btn--secondary" onClick={printSelectedQrs}>Print selected ({selectedQrs.size})</button>
              </div>
            </div>
            <div className="inventory-table-wrap">
              <table className="inventory-table">
                <thead><tr><th><input type="checkbox" aria-label="Select visible QR codes" checked={qrs.length > 0 && qrs.every((qr) => selectedQrs.has(qr.id))} onChange={(event) => selectVisibleQrs(event.target.checked)} /></th><th>QR image</th><th>Inventory code / QR ID</th><th>Status</th><th>Business / destination</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                  {qrs.map((qr) => (
                    <QrRow key={qr.id} qr={qr} selected={selectedQrs.has(qr.id)} onSelect={selectQr} onAssign={setAssigning} onAction={changeQr} onTest={testQr} onDownload={downloadQr} />
                  ))}
                  {!qrs.length && <tr><td colSpan="7" className="inventory-empty">No QR codes match these filters. Generate a batch to get started.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="inventory-pagination">
              <span>{total ? `${offset + 1}–${Math.min(offset + qrs.length, total)} of ${total}` : '0 QR codes'}</span>
              <div>
                <button className="btn btn--small btn--secondary" disabled={currentPage <= 1} onClick={() => setOffset(Math.max(0, offset - pageSize))}>Previous</button>
                <span>Page {currentPage} of {pageCount}</span>
                <button className="btn btn--small btn--secondary" disabled={currentPage >= pageCount} onClick={() => setOffset(offset + pageSize)}>Next</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="business-toolbar">
              <p>Business details and review URLs update dynamically for every assigned QR.</p>
              <button className="btn btn--primary" onClick={() => setShowBusinessForm(true)}>Add business</button>
            </div>
            <div className="business-grid">
              {businesses.map((business) => (
                <article className="business-card" key={business.id}>
                  <div className="business-card__top">
                    <div>
                      <h2>{business.name}</h2>
                      <p className="business-card__category">
                        {business.category_label ?? reviewCategories.find(
                          (category) => category.id === business.category_id,
                        )?.label ?? 'Other / General Business'}
                      </p>
                      <p>{business.qr_count} assigned QR{business.qr_count === 1 ? '' : 's'}</p>
                    </div>
                    <button className="btn btn--small btn--secondary" onClick={() => setEditingBusiness(business)}>Edit</button>
                  </div>
                  <a href={business.review_url} target="_blank" rel="noreferrer">{business.review_url}</a>
                  <div className="business-card__actions">
                    <button className="btn btn--small btn--secondary" onClick={() => { setPage('qrs'); setBusinessFilter(business.id); setStatus(''); setOffset(0) }}>View assigned QR codes</button>
                    <button className="btn btn--small btn--primary" onClick={() => {
                      setPage('qrs')
                      setStatus('unassigned')
                      setBusinessFilter('')
                      setOffset(0)
                    }}>View unassigned QR codes</button>
                  </div>
                </article>
              ))}
              {!businesses.length && <p className="inventory-empty">No businesses yet. Add one here or while programming a QR.</p>}
            </div>
          </>
        )}
      </div>
      {assigning && (
        <QrDialog
          qr={assigning}
          businesses={businesses}
          onClose={() => setAssigning(null)}
          onSubmit={assignQr}
        />
      )}
      {(editingBusiness || showBusinessForm) && (
        <BusinessForm
          business={editingBusiness}
          onClose={() => { setEditingBusiness(null); setShowBusinessForm(false) }}
          onSubmit={saveBusiness}
        />
      )}
    </main>
  )
}

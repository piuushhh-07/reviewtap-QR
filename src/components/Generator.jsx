export function Generator() {
  return (
    <div className="generator" id="generator">
      <div className="generator__card">
        <p className="eyebrow">Admin dashboard</p>
        <h2 id="generator-heading">Create dynamic QR codes</h2>
        <p className="generator__intro">
          Generate unique codes, assign them to a business, and keep printed
          codes working when a review destination changes.
        </p>
        <a href="/admin" className="btn btn--primary btn--full">
          Open QR dashboard
        </a>
      </div>
    </div>
  )
}

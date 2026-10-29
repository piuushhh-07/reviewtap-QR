export function Header() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a href="#top" className="site-header__brand" aria-label="ReviewTap home">
          <img src="/reviewtap-logo.svg" alt="" width="196" height="40" />
        </a>
        <nav className="site-header__nav" aria-label="Primary">
          <a href="#how-it-works">How it works</a>
          <a href="#contact">Contact</a>
          <a href="/admin" className="site-header__cta">
            QR dashboard
          </a>
        </nav>
      </div>
    </header>
  )
}

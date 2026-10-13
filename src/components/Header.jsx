import { siteContent } from '../content/siteContent'

export function Header() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a href="#top" className="site-header__brand">
          <svg
            className="site-header__mark"
            viewBox="0 0 32 32"
            role="presentation"
            aria-hidden="true"
          >
            <rect width="32" height="32" rx="7" fill="var(--color-ink)" />
            <rect x="6" y="6" width="8" height="8" fill="var(--color-bg)" />
            <rect x="8" y="8" width="4" height="4" fill="var(--color-ink)" />
            <rect x="18" y="6" width="8" height="8" fill="var(--color-bg)" />
            <rect x="20" y="8" width="4" height="4" fill="var(--color-ink)" />
            <rect x="6" y="18" width="8" height="8" fill="var(--color-bg)" />
            <rect x="8" y="20" width="4" height="4" fill="var(--color-ink)" />
            <rect x="18" y="18" width="3" height="3" fill="var(--color-bg)" />
            <rect x="23" y="18" width="3" height="3" fill="var(--color-bg)" />
            <rect x="18" y="23" width="3" height="3" fill="var(--color-bg)" />
            <rect x="23" y="23" width="3" height="3" fill="var(--color-accent)" />
          </svg>
          <span>{siteContent.brandName}</span>
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

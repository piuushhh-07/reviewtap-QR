import airnoxaeSymbol from '../../assets/symbol.png'
import { siteContent } from '../content/siteContent'
import { getConfiguredSocialLinks } from '../lib/socialLinks'

const year = new Date().getFullYear()

function SocialIcon({ name }) {
  if (name === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.5" cy="6.8" r="1.2" fill="currentColor" />
      </svg>
    )
  }
  if (name === 'linkedin') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M5.2 8.7H2.1V22h3.1V8.7ZM3.7 2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6ZM22 14.4c0-4-2.1-5.9-4.9-5.9a4.2 4.2 0 0 0-3.8 2.1V8.7h-3V22h3.1v-6.6c0-1.7.3-3.4 2.5-3.4s2.2 2 2.2 3.5V22h3.1l.8-7.6Z" />
      </svg>
    )
  }
  if (name === 'google') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285f4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.1h5.4a4.6 4.6 0 0 1-2 3v2.7h3.3c1.9-1.8 2.9-4.4 2.9-7.6Z" />
        <path fill="#34a853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.7c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H3v2.8A10 10 0 0 0 12 22Z" />
        <path fill="#fbbc05" d="M6.4 13.7a6 6 0 0 1 0-3.5V7.4H3a10 10 0 0 0 0 9.1l3.4-2.8Z" />
        <path fill="#ea4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.8 9.8 0 0 0 12 2a10 10 0 0 0-9 5.4l3.4 2.8C7.2 7.8 9.4 6 12 6Z" />
      </svg>
    )
  }
  if (name === 'website') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3.5 12h17M12 3c2.2 2.4 3.2 5.4 3.2 9s-1 6.6-3.2 9c-2.2-2.4-3.2-5.4-3.2-9S9.8 5.4 12 3Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M18.9 2h3.1l-6.8 7.8L23.2 22H17l-4.9-7.3L5.7 22H2.5l7.3-8.4L2 2h6.4l4.4 6.7L18.9 2Zm-1.1 18h1.7L7.4 3.9H5.6L17.8 20Z" />
    </svg>
  )
}

export function Footer({ variant = 'site', socialLinks }) {
  const links = getConfiguredSocialLinks(socialLinks)

  return (
    <footer className={`site-footer${variant === 'review' ? ' site-footer--review' : ''}`}>
      <div className="site-footer__inner">
        <div className="site-footer__top">
          <div className="site-footer__brand">
            <img src={airnoxaeSymbol} alt="AIRNOXAE Technologies symbol" width="64" height="64" loading="lazy" />
            <p className="site-footer__powered-by">
              <span>Powered by</span>
              <strong>AIRNOXAE TECHNOLOGIES</strong>
            </p>
          </div>
          {links.length > 0 && (
            <nav className="site-footer__social" aria-label="AIRNOXAE TECHNOLOGIES social links">
              {links.map(({ id, label, href }) => (
                <a
                  key={id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${label} (opens in a new tab)`}
                >
                  <SocialIcon name={id} />
                </a>
              ))}
            </nav>
          )}
        </div>
        {variant === 'site' ? (
          <>
            <p>
              {siteContent.brandName} helps local businesses make QR codes
              that link to their own Google review page.
            </p>
            <p className="site-footer__disclaimer">
              {siteContent.brandName} is not affiliated with, sponsored by, or
              endorsed by Google. Google and the Google logo are trademarks of
              Google LLC. QR codes are generated in your browser from the
              exact link you provide.
            </p>
            <p className="site-footer__copyright">
              © {year} {siteContent.brandName}
            </p>
          </>
        ) : (
          <p className="site-footer__disclaimer">
            ReviewTap is not affiliated with or endorsed by Google.
          </p>
        )}
      </div>
    </footer>
  )
}

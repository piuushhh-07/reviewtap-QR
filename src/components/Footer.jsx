import { siteContent } from '../content/siteContent'

const year = new Date().getFullYear()

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
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
      </div>
    </footer>
  )
}

import { siteContent } from '../content/siteContent'

export function Contact() {
  const { contact, brandName } = siteContent

  return (
    <section className="section" id="contact" aria-labelledby="contact-heading">
      <div className="section__inner">
        <h2 id="contact-heading">Questions before you generate one?</h2>
        <p className="contact__intro">
          Reach out and someone from {brandName} will get back to you.
        </p>
        <dl className="contact__list">
          <div className="contact__row">
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </dd>
          </div>
          <div className="contact__row">
            <dt>Phone</dt>
            <dd>
              <a href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`}>
                {contact.phone}
              </a>
            </dd>
          </div>
          <div className="contact__row">
            <dt>Based in</dt>
            <dd>{contact.location}</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}

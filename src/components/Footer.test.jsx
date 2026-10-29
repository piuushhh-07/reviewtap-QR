import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { airnoxaeSocialLinks } from '../config/airnoxae'
import { getConfiguredSocialLinks } from '../lib/socialLinks'
import { Footer } from './Footer'

describe('AIRNOXAE footer', () => {
  it('uses the supplied company logo and exact branding without empty social icons', () => {
    const { container } = render(<Footer variant="review" />)
    const footer = screen.getByRole('contentinfo')
    const logo = container.querySelector('.site-footer__brand img')

    expect(footer).toHaveClass('site-footer--review')
    expect(within(footer).getByText('Powered by')).toBeInTheDocument()
    expect(within(footer).getByText('AIRNOXAE TECHNOLOGIES')).toBeInTheDocument()
    expect(logo).toHaveAttribute('src')
    expect(logo.getAttribute('src')).toContain('2a863f88-dc39-4026-a42e-cd7fe979dec5')
    expect(within(footer).queryByRole('navigation')).not.toBeInTheDocument()
    expect(Object.values(airnoxaeSocialLinks)).toEqual(['', '', '', '', ''])
  })

  it('renders only configured, secure provider links with accessible labels and safe targets', () => {
    const links = getConfiguredSocialLinks({
      instagram: 'https://www.instagram.com/airnoxae/',
      linkedin: 'https://www.linkedin.com/company/airnoxae/',
      google: 'https://www.google.com/search?q=airnoxae',
      website: 'https://airnoxae.example/',
      x: 'https://x.com/airnoxae',
    })
    const { container } = render(<Footer socialLinks={Object.fromEntries(
      links.map(({ id, href }) => [id, href]),
    )} />)

    expect(links.map(({ id }) => id)).toEqual(['instagram', 'linkedin', 'google', 'website', 'x'])
    const navigation = screen.getByRole('navigation', { name: 'AIRNOXAE TECHNOLOGIES social links' })
    const anchors = within(navigation).getAllByRole('link')
    expect(anchors).toHaveLength(5)
    for (const [index, label] of ['Instagram', 'LinkedIn', 'Google', 'Website', 'X'].entries()) {
      expect(anchors[index]).toHaveAccessibleName(`${label} (opens in a new tab)`)
      expect(anchors[index]).toHaveAttribute('target', '_blank')
      expect(anchors[index]).toHaveAttribute('rel', 'noopener noreferrer')
      expect(anchors[index].querySelector('svg')).toBeInTheDocument()
    }
    expect(container.querySelectorAll('.site-footer__social a svg')).toHaveLength(5)
  })

  it('filters blank, insecure, malformed, credentialed, and lookalike social links', () => {
    const links = getConfiguredSocialLinks({
      instagram: 'javascript:alert(1)',
      linkedin: 'https://linkedin.com.example.org/company/example',
      google: 'https://user@google.com/search',
      website: 'http://example.org',
      x: 'https://x.com/reviewtap',
    })

    expect(links.map(({ id, href }) => [id, href])).toEqual([
      ['x', 'https://x.com/reviewtap'],
    ])
    expect(getConfiguredSocialLinks(null)).toEqual([])
  })
})

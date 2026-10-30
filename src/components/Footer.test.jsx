import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { airnoxaeSocialLinks } from '../config/airnoxae'
import { getConfiguredSocialLinks } from '../lib/socialLinks'
import { Footer } from './Footer'

describe('AIRNOXAE footer', () => {
  it('uses the supplied logo and branding and shows only configured social links', () => {
    const { container } = render(<Footer variant="review" />)
    const footer = screen.getByRole('contentinfo')
    const logo = container.querySelector('.site-footer__brand img')

    expect(footer).toHaveClass('site-footer--review')
    expect(within(footer).getByText('Powered by')).toBeInTheDocument()
    expect(within(footer).getByText('AIRNOXAE TECHNOLOGIES')).toBeInTheDocument()
    expect(logo).toHaveAttribute('src')
    expect(logo.getAttribute('src')).toContain('symbol.png')
    expect(logo).toHaveAccessibleName('AIRNOXAE Technologies symbol')
    expect(airnoxaeSocialLinks).toEqual({
      instagram: 'https://www.instagram.com/airnoxae_technologies/',
      linkedin: 'https://www.linkedin.com/company/airnoxae-technologies/',
      google: '',
      website: '',
      x: 'https://x.com/AirnoxaeTech',
    })

    const navigation = within(footer).getByRole('navigation', {
      name: 'AIRNOXAE TECHNOLOGIES social links',
    })
    const links = within(navigation).getAllByRole('link')
    expect(links).toHaveLength(3)
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      airnoxaeSocialLinks.instagram,
      airnoxaeSocialLinks.linkedin,
      airnoxaeSocialLinks.x,
    ])
    expect(within(navigation).queryByRole('link', { name: /google|website/i }))
      .not.toBeInTheDocument()
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      expect(link).toHaveAccessibleName(/opens in a new tab/)
      expect(link.querySelector('svg')).toBeInTheDocument()
    }
    expect(container.querySelector('.site-footer--review .site-footer__social'))
      .toBeInTheDocument()
  })

  it('renders only configured, secure provider links with accessible labels and safe targets', () => {
    const links = getConfiguredSocialLinks({
      instagram: airnoxaeSocialLinks.instagram,
      linkedin: airnoxaeSocialLinks.linkedin,
      x: airnoxaeSocialLinks.x,
    })
    const { container } = render(<Footer socialLinks={Object.fromEntries(
      links.map(({ id, href }) => [id, href]),
    )} />)

    expect(links.map(({ id }) => id)).toEqual(['instagram', 'linkedin', 'x'])
    const navigation = screen.getByRole('navigation', { name: 'AIRNOXAE TECHNOLOGIES social links' })
    const anchors = within(navigation).getAllByRole('link')
    expect(anchors).toHaveLength(3)
    for (const [index, label] of ['Instagram', 'LinkedIn', 'X'].entries()) {
      expect(anchors[index]).toHaveAccessibleName(`${label} (opens in a new tab)`)
      expect(anchors[index]).toHaveAttribute('target', '_blank')
      expect(anchors[index]).toHaveAttribute('rel', 'noopener noreferrer')
      expect(anchors[index].querySelector('svg')).toBeInTheDocument()
    }
    expect(container.querySelectorAll('.site-footer__social a svg')).toHaveLength(3)
  })

  it('keeps Google and website icons hidden when their links are missing', () => {
    const links = getConfiguredSocialLinks(airnoxaeSocialLinks)

    expect(links.map(({ id }) => id)).toEqual(['instagram', 'linkedin', 'x'])
  })

  it('filters insecure, malformed, credentialed, and lookalike social links', () => {
    const links = getConfiguredSocialLinks({
      instagram: 'javascript:alert(1)',
      linkedin: 'https://linkedin.com.example.org/company/example',
      google: 'https://user@google.com/search',
      website: 'http://example.org',
      x: airnoxaeSocialLinks.x,
    })

    expect(links.map(({ id, href }) => [id, href])).toEqual([
      ['x', airnoxaeSocialLinks.x],
    ])
    expect(getConfiguredSocialLinks(null)).toEqual([])
  })
})

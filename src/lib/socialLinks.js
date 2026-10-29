import { airnoxaeSocialLinks } from '../config/airnoxae'

const socialProviders = [
  { id: 'instagram', label: 'Instagram', domains: ['instagram.com'] },
  { id: 'linkedin', label: 'LinkedIn', domains: ['linkedin.com'] },
  { id: 'google', label: 'Google', domains: ['google.com', 'g.page'] },
  { id: 'website', label: 'Website', domains: [] },
  { id: 'x', label: 'X', domains: ['x.com', 'twitter.com'] },
]

function isAllowedHost(hostname, domains) {
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
}

export function getConfiguredSocialLinks(configuration = airnoxaeSocialLinks) {
  const configuredValues = configuration && typeof configuration === 'object'
    ? configuration
    : {}
  return socialProviders.flatMap((provider) => {
    const value = configuredValues[provider.id]
    if (typeof value !== 'string' || !value.trim()) return []

    try {
      const url = new URL(value.trim())
      const validHost = provider.domains.length
        ? isAllowedHost(url.hostname.toLowerCase(), provider.domains)
        : url.hostname.includes('.')
      if (url.protocol !== 'https:' || url.username || url.password || !validHost) return []
      return [{ ...provider, href: url.toString() }]
    } catch {
      return []
    }
  })
}

/**
 * Validates that a string is present and looks like a usable web link.
 * Intentionally permissive about *which* domain it points to — business
 * review links come in several shapes (g.page, maps.app.goo.gl, search
 * .google.com/local/writereview, custom redirect links, etc.) — so this
 * only checks that something was entered and that it parses as an
 * http(s) URL with a real-looking host.
 *
 * @param {string} rawUrl
 * @returns {{ valid: boolean, message: string, normalizedUrl?: string }}
 */
export function validateReviewUrl(rawUrl) {
  const trimmed = typeof rawUrl === 'string' ? rawUrl.trim() : ''

  if (!trimmed) {
    return {
      valid: false,
      message: 'Enter your Google review link.',
    }
  }

  let parsed
  try {
    // Users often paste links without a protocol ("g.page/r/..."). Try the
    // value as-is first, then retry with https:// prepended, so a bare
    // domain is treated as a helpful default rather than an error.
    parsed = new URL(trimmed)
  } catch {
    try {
      parsed = new URL(`https://${trimmed}`)
    } catch {
      return {
        valid: false,
        message:
          "That doesn't look like a valid web link. Include the full address, e.g. https://g.page/r/your-business/review",
      }
    }
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    return {
      valid: false,
      message: 'The link must start with http:// or https://.',
    }
  }

  if (!parsed.hostname || !parsed.hostname.includes('.')) {
    return {
      valid: false,
      message: "That doesn't look like a valid web link.",
    }
  }

  return {
    valid: true,
    message: '',
    normalizedUrl: parsed.toString(),
  }
}

/**
 * Accepts known Google review and Maps share URL shapes only.
 * @param {string} rawUrl
 * @returns {{ valid: boolean, message: string, normalizedUrl?: string }}
 */
export function validateGoogleReviewUrl(rawUrl) {
  const trimmed = typeof rawUrl === 'string' ? rawUrl.trim() : ''
  let parsed

  try {
    parsed = new URL(trimmed)
  } catch {
    try {
      parsed = new URL(`https://${trimmed}`)
    } catch {
      return {
        valid: false,
        message: 'Enter a valid Google review or Google Maps link.',
      }
    }
  }

  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.port
  ) {
    return {
      valid: false,
      message: 'Use a secure HTTPS Google review or Google Maps link.',
    }
  }

  const hostname = parsed.hostname.toLowerCase()
  const isGoogleMapsHost = ['google.com', 'www.google.com', 'maps.google.com'].includes(hostname)
  const hasMapQuery = ['cid', 'q', 'query', 'll'].some((key) => parsed.searchParams.has(key))
  const isGoogleMapsPath = isGoogleMapsHost && (
    /^\/maps(?:\/|$)/.test(parsed.pathname) ||
    (hostname === 'maps.google.com' && parsed.pathname === '/' && hasMapQuery)
  )
  const isGoogleReviewLink =
    (hostname === 'g.page' &&
      !parsed.hash &&
      /^\/r\/[^/]+(?:\/review)?\/?$/.test(parsed.pathname)) ||
    (hostname === 'maps.app.goo.gl' && !parsed.hash && parsed.pathname.length > 1) ||
    (hostname === 'goo.gl' &&
      !parsed.hash &&
      /^\/maps(?:\/|$)/.test(parsed.pathname)) ||
    isGoogleMapsPath ||
    (hostname === 'search.google.com' &&
      !parsed.hash &&
      /^\/local\/writereview\/?$/.test(parsed.pathname))

  if (!isGoogleReviewLink) {
    return {
      valid: false,
      message: 'Use a Google review link such as g.page, Google Maps, or search.google.com/local/writereview.',
    }
  }

  return { valid: true, message: '', normalizedUrl: parsed.toString() }
}

/**
 * Validates that a business name was entered.
 * @param {string} rawName
 * @returns {{ valid: boolean, message: string, normalizedName?: string }}
 */
export function validateBusinessName(rawName) {
  const trimmed = typeof rawName === 'string' ? rawName.trim() : ''

  if (!trimmed) {
    return {
      valid: false,
      message: 'Enter your business name.',
    }
  }

  if (trimmed.length > 80) {
    return {
      valid: false,
      message: 'Keep the business name under 80 characters.',
    }
  }

  return {
    valid: true,
    message: '',
    normalizedName: trimmed,
  }
}

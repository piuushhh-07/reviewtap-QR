export function parseBusinessOfferings(value) {
  return value.split('\n').map((offering) => offering.trim()).filter(Boolean)
}

export function validateBusinessOfferings(value) {
  if (value === undefined || value === null) {
    return { valid: true, offerings: [] }
  }
  if (!Array.isArray(value)) {
    return { valid: false, message: 'Enter services or offerings as a list.' }
  }

  const offerings = value.map((offering) => (
    typeof offering === 'string' ? offering.trim() : ''
  ))
  if (offerings.some((offering) => !offering)) {
    return { valid: false, message: 'Each service or offering must contain text.' }
  }
  if (offerings.some((offering) => offering.length > 60)) {
    return { valid: false, message: 'Each service or offering must be 60 characters or fewer.' }
  }
  if (offerings.length > 12) {
    return { valid: false, message: 'Add no more than 12 services or offerings.' }
  }
  if (new Set(offerings.map((offering) => offering.toLocaleLowerCase())).size !== offerings.length) {
    return { valid: false, message: 'Remove duplicate services or offerings.' }
  }
  return { valid: true, offerings }
}

export async function adminApi(path, options = {}) {
  let response
  try {
    response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    })
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        'Cannot connect to the ReviewTap backend. Start it with "npm run dev:server" in a second terminal, then retry.',
      )
    }
    throw error
  }

  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(
      `The backend returned an unexpected response (HTTP ${response.status}). In development, confirm "npm run dev:server" is running.`,
    )
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error(
      `The backend returned invalid JSON (HTTP ${response.status}). Check the server logs and retry.`,
    )
  }
  if (!response.ok) throw new Error(payload.error || 'The request could not be completed.')
  return payload
}

export function jsonRequest(method, body) {
  return {
    method,
    body: JSON.stringify(body),
  }
}

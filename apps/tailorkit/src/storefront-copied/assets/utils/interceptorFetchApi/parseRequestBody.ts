/**
 * Attempts to parse the request body as:
 * - JSON (if `headers['Content-Type']` is application/json), or
 * - URL-encoded form data (application/x-www-form-urlencoded).
 *
 * Returns an object with the extracted fields (line, key, id, quantity, etc.).
 */
export async function parseRequestBody(input: RequestInfo, init?: RequestInit): Promise<Record<string, any>> {
  if (!init?.body) {
    return {}
  }

  // If body is already a string, we can parse it.
  // If body is something else (FormData, URLSearchParams, etc.), adapt as needed.
  const contentType = init.headers ? (init.headers as Record<string, string>)['Content-Type'] || '' : ''

  let rawBody: string
  if (typeof init.body === 'string') {
    rawBody = init.body
  } else if (init.body instanceof FormData) {
    // Handle FormData differently
    const formData = init.body
    const result: Record<string, any> = {}

    for (const [key, value] of formData.entries()) {
      // Convert numeric strings to numbers
      const maybeNum = Number(value)
      result[key] = isNaN(maybeNum) ? value : maybeNum
    }

    return result
  } else {
    // If it's FormData or something else, you might convert accordingly.
    // For now, let's assume it's text or JSON. We'll do a best-effort approach.
    rawBody = init.body.toString()
  }

  // Decide how to parse based on content type or if it's valid JSON
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(rawBody)
    } catch (err) {
      console.warn('[parseRequestBody] Could not parse JSON body:', err)
      return {}
    }
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    const result: Record<string, string | number> = {}
    rawBody.split('&').forEach(pair => {
      const [k, v] = pair.split('=')
      // decode if necessary
      const key = decodeURIComponent(k)
      const val = decodeURIComponent(v || '')
      // If numeric (line=2, quantity=0, id=123456), convert to number
      const maybeNum = Number(val)
      result[key] = isNaN(maybeNum) ? val : maybeNum
    })

    return result
  } else {
    // If the content type is unknown, attempt JSON parse as a fallback
    try {
      return JSON.parse(rawBody)
    } catch (err) {
      // Or fallback to a naive parse
      console.warn('[parseRequestBody] Unknown body format:', rawBody)
      return {}
    }
  }
}

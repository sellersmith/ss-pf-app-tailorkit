import crypto from 'node:crypto'

const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

// Inline JSON response helper to avoid importing from ~/bootstrap/fns/fetch.server,
// which pulls the full bootstrap chain (mongoose, app modules) and breaks unit tests
// that try to load this module in isolation. Same shape as Remix's `json()` helper.
function json(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

/**
 * Validates X-Api-Key header against PAGEFLY_PARTNER_API_KEY env var.
 * Returns 401 Response if invalid, null if valid.
 *
 * Uses SHA-256 + timingSafeEqual so length comparisons cannot leak the
 * expected key length and equality is timing-safe regardless of input shape.
 */
export function validatePartnerApiKey(request: Request): Response | null {
  const expected = process.env.PAGEFLY_PARTNER_API_KEY
  const provided = request.headers.get('X-Api-Key') || ''

  if (!expected) {
    console.error('[partner-auth] PAGEFLY_PARTNER_API_KEY env var not set')
    return json({ error: 'Server misconfigured' }, { status: 500, headers: corsHeaders })
  }

  if (!constantTimeEqual(provided, expected)) {
    return json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }

  return null
}

/**
 * Constant-time string equality. Hashes both sides to fixed length before
 * comparison so that length differences do not short-circuit and cannot
 * be timed by an attacker. Hash collision is not a security boundary
 * — it just normalizes input length for the timing-safe primitive.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const aHash = crypto.createHash('sha256').update(a).digest()
  const bHash = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(aHash, bHash)
}

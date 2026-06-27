/**
 * Standardized JSON error response shape for API routes.
 *
 * Use over inline `json({ success: false, ... })` so error envelopes stay
 * uniform across endpoints. Clients can rely on `success` and `error` fields
 * always being present. Pass `extra` for endpoint-specific flags (e.g.
 * `needsSubscription: true` on the 402 paywall response).
 *
 * @example
 *   return errorResponse('Subscription required', 402, { needsSubscription: true })
 */
import { json } from '~/bootstrap/fns/fetch.server'

export function errorResponse(error: string, status = 500, extra?: Record<string, unknown>) {
  return json({ success: false, error, ...(extra || {}) }, { status })
}

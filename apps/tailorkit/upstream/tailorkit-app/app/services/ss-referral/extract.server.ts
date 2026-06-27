const UA_MAX_LENGTH = 512

/**
 * Extract the leftmost IP from X-Forwarded-For, then fall back to
 * X-Real-IP / CF-Connecting-IP. Returns empty string when no header is present.
 *
 * IMPORTANT: must use the leftmost X-Forwarded-For value — the SS Admin Console
 * matches PUT and GET/PATCH fingerprints using this exact extraction logic.
 */
export function extractClientIP(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    return xff.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') ?? request.headers.get('cf-connecting-ip') ?? ''
}

/**
 * Return the raw User-Agent header, truncated to 512 chars.
 * No normalization — the value must be identical between PUT and GET/PATCH
 * for the fingerprint match to succeed on the SS Admin Console side.
 */
export function extractUserAgent(request: Request): string {
  return (request.headers.get('user-agent') ?? '').slice(0, UA_MAX_LENGTH)
}

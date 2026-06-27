import RedirectTracking, { type IRedirectTracking } from '~/models/RedirectTracking.server'

/**
 * Cookie name for tracking redirect data
 */
export const TRACKING_COOKIE_NAME = 'tk_redirect_id'

// Get client IP address (check various headers for proxy scenarios)
export function getClientIp(request: Request): string | undefined {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim()
  }

  return (
    request.headers.get('x-real-ip')
    || request.headers.get('x-client-ip')
    || request.headers.get('cf-connecting-ip') // Cloudflare
    || undefined
  )
}

/**
 * Parse tracking cookie from request headers
 */
export function parseTrackingCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null

  const cookies = cookieHeader.split(';').map(c => c.trim())
  const trackingCookie = cookies.find(c => c.startsWith(`${TRACKING_COOKIE_NAME}=`))

  if (!trackingCookie) return null

  const trackingId = trackingCookie.split('=')[1]
  return trackingId || null
}

/**
 * Get tracking data by ID from cookie
 */
export async function getTrackingDataFromCookie(request: Request): Promise<IRedirectTracking | null> {
  try {
    const trackingId = parseTrackingCookie(request)

    if (trackingId) {
      return await RedirectTracking.findOne({ _id: trackingId, appliedCoupon: null })
    }

    // Fallback => try to get tracking data by client IP and user agent
    const clientIp = getClientIp(request)
    const userAgent = request.headers.get('user-agent') || undefined

    return await RedirectTracking.findOne({ clientIp, userAgent, appliedCoupon: null })
  } catch (error) {
    console.error('Error fetching tracking data from cookie:', error)
    return null
  }
}

/**
 * Clear tracking cookie (for logout or privacy)
 */
export function createClearTrackingCookieHeader(): string {
  return [
    `${TRACKING_COOKIE_NAME}=`,
    'expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'path=/',
    'httponly',
    'samesite=lax',
  ].join('; ')
}

/**
 * Create new tracking cookie header
 */
export function createTrackingCookieHeader(trackingId: string, daysToExpire: number = 30): string {
  const cookieExpires = new Date()
  cookieExpires.setDate(cookieExpires.getDate() + daysToExpire)

  return [
    `${TRACKING_COOKIE_NAME}=${trackingId}`,
    `expires=${cookieExpires.toUTCString()}`,
    'path=/',
    'httponly',
    'samesite=lax',
    'secure',
  ].join('; ')
}

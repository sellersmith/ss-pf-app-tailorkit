import type { ActionFunctionArgs } from '@remix-run/node'
import { authenticate } from '~/shopify/app.server'
import { saveWebVitalsData } from '~/models/WebVitals.server'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { json } from '~/bootstrap/fns/fetch.server'

/**
 * Handle POST requests to save web vitals data
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    const { session } = await authenticate.admin(request)
    const shopDomain = session.shop

    if (!shopDomain) {
      return json({ error: 'Shop domain not found' }, { status: 400 })
    }

    const body = await request.json()
    const { type, message, browserInfo, url, value, additionalMetrics } = body

    // Parse the URL to get pathname
    const urlObj = new URL(url)
    const pathname = urlObj.pathname

    // Parse the message to get detailed information
    let elementInfo = {}
    let navigationTiming: any = {}

    if (typeof message === 'string') {
      try {
        const parsedMessage = JSON.parse(message)

        // Extract element information for LCP
        if (type === 'LCP' && parsedMessage.entries?.[0]?.element) {
          const element = parsedMessage.entries[0].element
          elementInfo = {
            tagName: element.tagName,
            className: element.className,
            id: element.id,
          }
        }

        // Extract navigation timing
        if (parsedMessage.navigationType) {
          navigationTiming = {
            navigationType: parsedMessage.navigationType,
          }
        }
      } catch (e) {
        // If message parsing fails, continue without detailed info
        console.warn('Failed to parse web vitals message:', e)
      }
    }

    // Determine device type based on user agent
    const userAgent = request.headers.get('user-agent') || ''
    const deviceType = getDeviceType(userAgent)

    // Get viewport information if available
    const viewport = {
      width: additionalMetrics?.viewportWidth || 0,
      height: additionalMetrics?.viewportHeight || 0,
    }

    // Get connection information
    const connectionType = additionalMetrics?.connectionType || undefined

    // Generate session ID (you might want to implement a proper session tracking)
    const sessionId = generateSessionId(request)

    // Save web vitals data
    const webVitalsData = {
      shopDomain,
      type,
      value,
      url,
      pathname,
      browserInfo,
      userAgent,
      viewport,
      deviceType,
      connectionType,
      elementInfo,
      navigationTiming,
      sessionId,
      additionalMetrics: {
        memoryUsage: additionalMetrics?.memoryUsage,
        jsHeapSize: additionalMetrics?.jsHeapSize,
        totalJSHeapSize: additionalMetrics?.totalJSHeapSize,
      },
      timestamp: new Date(),
    }

    await saveWebVitalsData(webVitalsData)

    return json({ success: true, message: 'Web vitals data saved successfully' })
  } catch (error) {
    console.error('Error saving web vitals data:', formatErrorMessage(error))
    return json({ error: 'Failed to save web vitals data' }, { status: 500 })
  }
}

/**
 * Determine device type from user agent
 */
function getDeviceType(userAgent: string): 'mobile' | 'tablet' | 'desktop' {
  const mobileRegex
    = /Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/
  const tabletRegex = /Tablet|iPad|Playbook|Silk|Android(?!.*Mobile)/

  if (mobileRegex.test(userAgent)) {
    return 'mobile'
  }
  if (tabletRegex.test(userAgent)) {
    return 'tablet'
  }
  return 'desktop'
}

/**
 * Generate a session ID based on request information
 */
function generateSessionId(request: Request): string {
  const userAgent = request.headers.get('user-agent') || ''
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  const timestamp = Date.now()

  // Create a simple hash for session ID
  const sessionData = `${userAgent}-${ip}-${Math.floor(timestamp / (1000 * 60 * 30))}` // 30-minute sessions

  return Buffer.from(sessionData).toString('base64').slice(0, 16)
}

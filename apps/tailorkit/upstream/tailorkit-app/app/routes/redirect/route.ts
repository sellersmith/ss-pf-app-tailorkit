/* eslint-disable max-len */
import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import RedirectTracking from '~/models/RedirectTracking.server'
import { formatErrorMessage } from '~/utils/formatErrorMessage'
import { createTrackingCookieHeader, getClientIp } from '~/utils/trackingCookie.server'

/**
 * Redirect route that captures tracking data and redirects to specified URL
 *
 * Example URL: /redirect?url=https://apps.shopify.com/tailorkit&utm_source=partnership-seoant&utm_medium=seoant-bfcm&utm_campaign=app-partnership&utm_content=seoant-bfcm-landing&coupon=TKSAF1M
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url)
    const destinationUrl = url.searchParams.get('url')

    // Validate that destination URL is provided
    if (!destinationUrl) {
      throw new Error('Missing required "url" parameter')
    }

    // Validate that destination URL is a valid URL
    try {
      new URL(destinationUrl)
    } catch {
      throw new Error('Invalid destination URL provided')
    }

    // Extract all query parameters
    const queryParams: Record<string, string> = {}
    url.searchParams.forEach((value, key) => {
      queryParams[key] = value
    })

    // Extract tracking data
    const trackingData = {
      fullUrl: request.url,
      destinationUrl,
      queryParams,
      referer: request.headers.get('referer') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      clientIp: getClientIp(request),
      couponCode: url.searchParams.get('coupon') || undefined,
      utmSource: url.searchParams.get('utm_source') || undefined,
      utmMedium: url.searchParams.get('utm_medium') || undefined,
      utmCampaign: url.searchParams.get('utm_campaign') || undefined,
      utmContent: url.searchParams.get('utm_content') || undefined,
      timestamp: new Date(),
    }

    // Save tracking data to database
    let trackingId: string | null = null
    try {
      const savedTracking = await RedirectTracking.create(trackingData)
      trackingId = savedTracking._id.toString()
    } catch (dbError) {
      // Log database error but don't block the redirect
      console.error('Failed to save redirect tracking data:', formatErrorMessage(dbError))
    }

    // Construct destination URL with all original query parameters
    const destinationUrlObj = new URL(destinationUrl)

    // Add all query parameters from the redirect URL to the destination URL
    // Skip the 'url' parameter itself as it's not needed in the destination
    url.searchParams.forEach((value, key) => {
      if (key !== 'url') {
        destinationUrlObj.searchParams.set(key, value)
      }
    })

    // Prepare redirect headers
    const redirectHeaders: HeadersInit = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    }

    // Set tracking cookie if we successfully saved the tracking data
    if (trackingId) {
      // Set secure tracking cookie with 30-day expiration
      redirectHeaders['Set-Cookie'] = createTrackingCookieHeader(trackingId)
    }

    // Perform the redirect
    return redirect(destinationUrlObj.toString(), {
      status: 302, // Temporary redirect
      headers: redirectHeaders,
    })
  } catch (error) {
    console.error('Redirect route error:', formatErrorMessage(error))

    // Return a user-friendly error page instead of throwing
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Redirect Error</title>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 600px;
              margin: 100px auto;
              padding: 20px;
              text-align: center;
            }
            .error {
              color: #d32f2f;
              margin-bottom: 20px;
            }
            .back-link {
              color: #1976d2;
              text-decoration: none;
            }
            .back-link:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <h1>Redirect Error</h1>
          <p class="error">${error instanceof Error ? error.message : 'An unexpected error occurred'}</p>
          <p>Please check the URL and try again.</p>
          <a href="/" class="back-link">← Return to Homepage</a>
        </body>
      </html>
      `,
      {
        status: 400,
        headers: {
          'Content-Type': 'text/html',
        },
      }
    )
  }
}

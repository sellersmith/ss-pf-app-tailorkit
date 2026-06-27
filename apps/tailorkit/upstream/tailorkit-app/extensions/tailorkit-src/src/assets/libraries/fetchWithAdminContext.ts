import { APP_PROXY_ORIGIN, APP_PROXY_PATH } from '../constants'

/**
 * Check if current window is inside TailorKit admin app iframe
 * This checks for a specific data attribute instead of title to make it more reliable
 */
export const isInTailorKitAdminFrame = (): { isInAdminApp: boolean; idToken: string } => {
  try {
    // First check if we're in an iframe
    const isInIframe = window !== window.top
    if (!isInIframe) {
      return { isInAdminApp: false, idToken: '' }
    }

    // Then try to access frameElement
    const frameElement = window.frameElement

    // Check if it's an iframe by checking tagName instead of using instanceof
    const isIframeElement = frameElement?.tagName?.toUpperCase() === 'IFRAME'

    if (!isIframeElement) {
      return { isInAdminApp: false, idToken: '' }
    }

    // Finally check for our attribute
    const hasAttribute = frameElement.hasAttribute('data-page-in-admin-app')
    const idToken = frameElement.getAttribute('data-id-token') || ''

    return { isInAdminApp: hasAttribute, idToken }
  } catch (e) {
    return { isInAdminApp: false, idToken: '' }
  }
}

/**
 * Fetch wrapper that prevents CORS issues when making API calls from within TailorKit admin iframe
 *
 * @description
 * When making API calls from within an iframe in the admin app, direct fetch calls will fail due to
 * CORS (Cross-Origin Resource Sharing) restrictions. This wrapper solves this by:
 *
 * 1. Detecting if the call is made from within the admin iframe
 * 2. If in admin iframe:
 *    - Converts APP_PROXY_PATH to '/api' for proper routing through the parent app
 *    - Adds 'in-admin-app=true' parameter to ensure correct request handling
 *    - Adds 'shop-domain' parameter to ensure correct request handling
 * 3. If not in admin iframe: makes a normal fetch call
 *
 * This ensures that API calls work correctly regardless of whether they're made from:
 * - The main admin app
 * - Inside an iframe within the admin app
 * - Other contexts
 *
 * @example
 * ```typescript
 * // Basic usage
 * const response = await fetchWithAdminContext('/api/app_proxy/storefront');
 *
 * // With options
 * const response = await fetchWithAdminContext('/api/app_proxy/storefront', {
 *   method: 'POST',
 *   body: JSON.stringify(data)
 * });
 * ```
 *
 * @throws {Error} If URL is invalid
 * @param url - The URL to fetch
 * @param options - Optional fetch options
 * @returns Promise<Response>
 */
export const fetchWithAdminContext = async (url: string, options?: RequestInit): Promise<Response> => {
  let targetUrl = url
  const { isInAdminApp, idToken } = isInTailorKitAdminFrame()

  if (isInAdminApp) {
    const _url = `${APP_PROXY_ORIGIN}${url.replace(APP_PROXY_PATH, '/api')}`
    targetUrl = `${_url}${_url.includes('?') ? '&' : '?'}in-admin-app=true`

    return fetch(targetUrl, {
      ...options,
      headers: {
        ...(options?.headers || {}),
        Authorization: `Bearer ${idToken}`,
      },
    })
  }

  return fetch(targetUrl, options)
}

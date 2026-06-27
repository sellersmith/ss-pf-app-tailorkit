import { handleAddProductToCartByFormData } from '../../../handlers/addProductToCartMiddleware'
import { windowFunctionCustom } from '../../windowFunction'
import { CART_API_URL } from '../constant'
import { type FetchInterceptor } from '../interceptorTypes'
import { processJsonCartBody, processUrlEncodedCartBody, readTailorKitPropertiesFromDOM } from '../json-cart-helpers'

/**
 * @description
 * Interceptor for handling Add-to-Cart (ATC) requests with addon product functionality.
 * This interceptor monitors cart/add requests and processes addon products from checkboxes.
 *
 * Current implementation:
 *    1. Intercepts /cart/add requests to monitor ATC actions
 *    2. Parses request body to extract variant and product information
 *    3. Handles different request formats (JSON, FormData, URL-encoded)
 *    4. Logs request/response data for debugging and processing
 *    5. Supports both request-time and response-time processing modes
 */
export const handleAddToCartInterceptor: FetchInterceptor = {
  async request(input, init) {
    try {
      if (!windowFunctionCustom().ADD_PRODUCT_FROM_TAILORKIT_PERSONALIZER_WITH_RESPONSE) {
        if (typeof input !== 'string') return [input, init || {}]

        // Skip internal TK requests (pricing product, charm items) to avoid infinite loop.
        // These are fire-and-forget calls from addAdditionalItemsToCart / cart-form-sync
        // that must NOT be re-processed by this interceptor.
        const headers = init?.headers as Record<string, string> | undefined
        if (headers?.['X-TailorKit-Internal'] === '1') {
          return [input, init || {}]
        }

        // Skip bulk personalize requests. The bulk path builds its own per-item
        // properties for N distinct line items. Re-injecting DOM properties here
        // would corrupt items[1..N] because readTailorKitPropertiesFromDOM only
        // sees the active unit's hidden inputs. The bulk fetcher carries
        // `X-Tailorkit-Bulk: 1` as a sentinel header to opt out.
        if (headers?.['X-Tailorkit-Bulk'] === '1') {
          return [input, init || {}]
        }

        // Handle for add to cart request
        if (input.includes(CART_API_URL.cartAdd) && init && init.body) {
          const contentType = (init.headers as Record<string, string>)?.['Content-Type']

          if (contentType?.includes('application/x-www-form-urlencoded') && typeof init.body === 'string') {
            // URL-encoded string body — some themes use this format
            try {
              const processed = await processUrlEncodedCartBody(init.body)
              if (processed !== null) {
                init.body = processed
              }
            } catch (err) {
              console.error('[TailorKit] Error processing URL-encoded cart add:', err)
            }
          } else if (typeof init.body === 'string') {
            // JSON body — Dawn and modern themes send fetch with JSON
            try {
              const processed = await processJsonCartBody(init.body)
              if (processed !== null) {
                init.body = processed
              }
            } catch (err) {
              console.error('[TailorKit] Error processing JSON cart add:', err)
            }
          } else if (init.body instanceof FormData) {
            // Handle for add to cart request by FormData
            console.log('[TailorKit]: Handle for add to cart request by FormData and init.body is FormData')
            const formData = init.body

            // Some merchant themes (sticky bars, quick-add, custom ATC buttons) build
            // FormData manually with only {id, quantity} — TailorKit inputs from the
            // main product form are missing. Mirror the JSON-body path: read properties
            // from the DOM and inject them so personalization and pricing are preserved.
            const hasTkProps = Array.from(formData.keys()).some(k => k.includes('_PF') || k.includes('_TLK'))
            if (!hasTkProps) {
              const variantId = (formData.get('id') as string) ?? undefined
              const domProperties = readTailorKitPropertiesFromDOM(variantId)
              for (const [key, value] of Object.entries(domProperties)) {
                formData.set(`properties[${key}]`, value)
              }
              console.log(
                `[TailorKit] FormData missing TK props — injected ${Object.keys(domProperties).length} from DOM`
              )
            }

            init.body = await handleAddProductToCartByFormData(formData)
          }
        }
      }
    } catch (err) {
      console.error('[TailorKit handleAddToCartInterceptor] Error reading request:', err)
    }

    return [input, init || {}]
  },

  async response(response) {
    if (windowFunctionCustom().ADD_PRODUCT_FROM_TAILORKIT_PERSONALIZER_WITH_RESPONSE) {
      try {
        if (response.url.includes(CART_API_URL.cartAdd)) {
          const clonedResponse = response.clone()
          const jsonData = await clonedResponse.json()
          console.log('[TailorKit]: Handle for add to cart request by JSON', jsonData)
          return response
        }
      } catch (error) {
        console.log('[TailorKit handleAddToCartInterceptor] Error reading response:', error)
      }
    }
    return response
  },
}

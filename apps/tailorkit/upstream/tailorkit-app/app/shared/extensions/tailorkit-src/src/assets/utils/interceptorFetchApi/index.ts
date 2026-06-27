import { windowFunctionCustom } from '../../utils/windowFunction'
import { createFetchProxy } from './createFetchProxy'
import { handleAddToCartInterceptor } from './interceptors/handlerATCInterceptor'

const interceptors: any[] = []

interceptors.push(handleAddToCartInterceptor)

/**
 * @description
 * - Inherited from OneTick's project
 * - Apply proxy for fetch API to enable TailorKit interceptors
 * - This replaces the global fetch function with a proxied version
 * - This is used to intercept the add to cart request and add custom behavior to it
 */
export const applyProxyForFetchApi = () => {
  // Guard: prevent double-wrapping when multiple TailorKit instances are on the same page
  if ((window as any).__tlk_fetch_wrapped__) return

  // Create a fetch function that uses the above interceptors
  const myProxiedFetch = createFetchProxy(interceptors)

  // Optionally overwrite the global fetch
  window.fetch = myProxiedFetch

  // Mark fetch as wrapped so subsequent instances skip re-wrapping
  ;(window as any).__tlk_fetch_wrapped__ = true

  // Backup reset the interceptor when myProxiedFetch be overwrite
  if (typeof windowFunctionCustom().RESET_INTERCEPTOR_FETCH_API === 'function') {
    windowFunctionCustom().RESET_INTERCEPTOR_FETCH_API(myProxiedFetch)
  }

  console.log('[TailorKit] Fetch API interceptors applied successfully')
}

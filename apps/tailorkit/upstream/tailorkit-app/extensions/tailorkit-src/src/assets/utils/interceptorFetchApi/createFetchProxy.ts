import { type FetchInterceptor } from './interceptorTypes'

// const originalFetch: typeof fetch = window.fetch

/**
 * createFetchProxy(interceptors)
 *
 * @param interceptors - an array of FetchInterceptor objects
 * @returns A function that acts like fetch but runs all interceptors.
 */
export function createFetchProxy(
  interceptors: FetchInterceptor[] = []
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  console.log('[TailorKit] Creating fetch proxy with interceptors')
  try {
    // Create a Proxy handler
    const handler: ProxyHandler<typeof fetch> = {
      apply: async (target, thisArg, args) => {
        let [input, init] = args as [RequestInfo, RequestInit | undefined]

        // Pass through all interceptors' request hooks ---
        for (const interceptor of interceptors) {
          if (typeof interceptor.request === 'function') {
            const result = await interceptor.request(input, init)

            if (Array.isArray(result)) {
              // If the interceptor returned something like [newInput, newInit],
              // or [newInput], handle it accordingly.
              const [newInput, newInit] = result
              input = newInput
              if (typeof newInit !== 'undefined') {
                init = newInit
              }
            }
            // If the interceptor did not return anything, we assume no changes.
          }
        }

        // Perform the actual fetch ---
        let response = await Reflect.apply(target, thisArg, [input, init])

        // Pass the response through all interceptors' response hooks ---
        for (const interceptor of interceptors) {
          if (typeof interceptor.response === 'function') {
            const newResponse = await interceptor.response(response, { input, init })

            if (newResponse) {
              response = newResponse
            }
          }
        }

        return response
      },
    }

    // Return the Proxy-wrapped fetch function
    return new Proxy(window.fetch, handler)
  } catch (err) {
    console.error('[TailorKit createFetchProxy] Error creating proxy:', err)
    return window.fetch
  }
}

import { t } from 'i18next'
import { sleep } from '~/utils/sleep'

// Define variable to hold URLs that are requesting
const requesting: { [key: string]: boolean } = {}

// Define variable to cache responses
const cachedResponses: { [key: string]: any } = {}

type FetchOptions = RequestInit & {
  preferCache?: boolean
}

export async function authenticatedFetch(url: string, opts?: FetchOptions) {
  // Declare key outside try so it's accessible in catch for cleanup
  const key = ['GET', undefined].includes(opts?.method) && url

  try {
    // Do not request the same URL with the same method and the same payload more than one time
    if (key) {
      if (requesting[key]) {
        await sleep(100)
        return authenticatedFetch(url, opts)
      }

      requesting[key] = true
    }

    const shopify = window.opener?.shopify ?? window.shopify
    const idToken = await shopify.idToken()

    const headers = {
      ...opts?.headers,
      Authorization: `Bearer ${idToken}`,
    }

    const shouldCache = opts?.preferCache && cachedResponses[url]
    const result = shouldCache
      ? cachedResponses[url]
      : await fetch(url, { ...opts, headers })
          .then(async res => {
            if (!res.ok) {
              throw new Error(`HTTP error! Status: ${res.status}`)
            }
            // Attempt to parse JSON if content length is greater than zero
            const text = await res.text()
            return text ? JSON.parse(text) : null
          })
          .catch(error => {
            console.error('Error fetching or parsing JSON:', error)
            return null
          })

    if (opts?.preferCache && !cachedResponses[url]) {
      cachedResponses[url] = result
    }

    if (key) {
      // Clear requesting state
      delete requesting[key]
    }

    // Translate server message
    const message = result?.message

    if (result && message) {
      result.message
        = typeof message === 'string' ? t(message) : message.text ? t(message.text, message.params) : message
    }

    return result
  } catch (e: any) {
    // Clean up dedup flag on error to prevent infinite retry loops
    if (key) {
      delete requesting[key]
    }

    if ((e.message || e).includes('aborted')) {
      return { success: false, message: 'aborted' }
    }

    console.error(e)
  }
}

export function clearAuthenticatedFetchCache(cacheKeys: string[]) {
  cacheKeys.forEach(key => delete cachedResponses[key])
}

import { useState } from 'react'
import { RemixQueryClient } from '~/libs/remix-query/query-client'
import { useInitEventsTracking } from '~/bootstrap/hooks/useEventsTracking'

interface AppInitializationOptions {
  /** Shop domain for user identification in analytics (e.g., "my-shop.myshopify.com") */
  shopDomain?: string | null
}

/**
 * Hook to handle app initialization
 * Initializes query client and events tracking
 *
 * @param {AppInitializationOptions} options - Configuration options
 * @param {string | null} options.shopDomain - Shop domain for user identification in analytics
 */
export function useAppInitialization(options: AppInitializationOptions = {}) {
  const { shopDomain } = options
  const [remixQueryClient] = useState(() => new RemixQueryClient())

  // Initialize events tracking with shop domain for user identification
  useInitEventsTracking({ shopDomain })

  return { remixQueryClient }
}

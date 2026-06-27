import { useSearchParams } from '@remix-run/react'
import { useMemo } from 'react'

/**
 * Retrieves the Shopify shop domain from the search params.
 *
 * @returns {string} Shopify Shop Domain
 */
export function useShopDomain() {
  const [searchParams] = useSearchParams()
  const shopDomain = useMemo(() => searchParams.get('shop') || shopify.config.shop!, [searchParams])
  return shopDomain
}

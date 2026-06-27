import { useCallback, useEffect, useState } from 'react'
import { authenticatedFetch } from '~/shopify/fns.client'

interface UseProductIntegrationStatusReturn {
  isIntegrated: boolean
  isLoading: boolean
  error: string | null
}

interface IntegratedVariant {
  id: string
  productId: string
  [key: string]: any
}

/**
 * Hook to check if a product or its variants are integrated
 * @param productId - GraphQL global product ID or Shopify product ID
 * @param variantIds - Array of variant IDs to check
 * @returns Object with isIntegrated status, loading state, and error
 */
export function useProductIntegrationStatus(
  productId?: string,
  variantIds?: string[]
): UseProductIntegrationStatusReturn {
  const [isIntegrated, setIsIntegrated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkIntegrationStatus = useCallback(async () => {
    // Skip check if no identifiers provided
    if (!productId && (!variantIds || variantIds.length === 0)) {
      setIsIntegrated(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Fetch integrated variants from API
      const response = await authenticatedFetch('/api/variants-integrations')

      if (!response.success || !response.variants) {
        throw new Error('Failed to fetch integration data')
      }

      const integratedVariants: IntegratedVariant[] = response.variants

      const stringProductId = productId !== undefined && productId !== null ? String(productId) : null
      // Extract Shopify product ID from GraphQL global ID if needed
      const shopifyProductId = stringProductId
        ? stringProductId.includes('gid://')
          ? stringProductId.split('/').pop()
          : stringProductId
        : null

      let hasIntegratedVariant = false

      if (variantIds && variantIds.length > 0) {
        // Check if any of the provided variant IDs are integrated
        const integratedVariantIds = integratedVariants.map(variant => variant.id)
        hasIntegratedVariant = variantIds.some(variantId => integratedVariantIds.includes(variantId))
      } else if (shopifyProductId) {
        // Check if any variants of this product are integrated
        hasIntegratedVariant = integratedVariants.some(variant => variant.productId === shopifyProductId)
      }

      setIsIntegrated(hasIntegratedVariant)
    } catch (err) {
      console.error('Error checking integration status:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setIsIntegrated(false)
    } finally {
      setIsLoading(false)
    }
  }, [productId, variantIds])

  useEffect(() => {
    checkIntegrationStatus()
  }, [checkIntegrationStatus])

  return { isIntegrated, isLoading, error }
}

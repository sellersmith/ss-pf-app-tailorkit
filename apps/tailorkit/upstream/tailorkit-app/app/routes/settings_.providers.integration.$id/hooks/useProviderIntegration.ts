import { useParams, useSearchParams } from '@remix-run/react'
import { useCallback, useEffect, useState } from 'react'
import { type ProviderDocument } from '~/models/Provider'
import { type TemporaryProduct } from '~/models/TemporaryFulfillmentProducts'
import { PROVIDER_INTEGRATION_ACTION } from '~/routes/api.providers-integration.$id/constants'
import { authenticatedFetch } from '~/shopify/fns.client'
import type { ProviderCapabilities } from '~/services/fulfillment/types'

interface SaveProductsParams {
  providerId: string
  productIds: string[]
}

interface ISelectedProductsState {
  selectedProducts: TemporaryProduct[]
  recentlyAddedProducts: TemporaryProduct[]
}

/**
 * @author KhanhNT
 * Custom hook for managing provider integration operations
 * Handles product importing, state management, and Shopify integration
 * @returns {Object} Object containing state and handler functions
 */
export const useProviderIntegration = () => {
  const { id: pIntegrationId } = useParams()
  const [searchParams] = useSearchParams()
  const autoSelect = searchParams.get('autoSelect') === 'true'

  const [providerInfo, setProviderInfo] = useState<ProviderDocument>({} as ProviderDocument)
  const [capabilities, setCapabilities] = useState<ProviderCapabilities | undefined>(undefined)
  const [selectedProductsState, setSelectedProductsState] = useState<ISelectedProductsState>({
    selectedProducts: [],
    recentlyAddedProducts: [],
  })
  const [confirmUsingPrintifyChoice, setConfirmUsingPrintifyChoice] = useState(false)
  const [fetching, setFetching] = useState(true)

  const setSelectedProducts = (
    productsOrUpdater: TemporaryProduct[] | ((prev: TemporaryProduct[]) => TemporaryProduct[]),
    recentlyAddedProducts: TemporaryProduct[] = []
  ) => {
    if (typeof productsOrUpdater === 'function') {
      // Functional update
      setSelectedProductsState(prev => ({
        selectedProducts: productsOrUpdater(prev.selectedProducts),
        recentlyAddedProducts: recentlyAddedProducts.length > 0 ? recentlyAddedProducts : prev.recentlyAddedProducts,
      }))
    } else {
      // Direct update
      setSelectedProductsState({ selectedProducts: productsOrUpdater, recentlyAddedProducts })
    }
  }

  /**
   * Fetches imported products from the API
   * Handles error cases and updates relevant state
   * @returns {Promise<void>}
   */
  const fetchImportedProducts = useCallback(async () => {
    if (!pIntegrationId) {
      setFetching(false)
      return
    }

    try {
      const response = await authenticatedFetch(`/api/providers-integration/${pIntegrationId}`)
      const { importedProducts } = response || {}

      if (!importedProducts) {
        return
      }

      const {
        providerInfo,
        capabilities: providerCapabilities,
        data: { products = [], confirmChoosePrintifyChoice = false },
      } = importedProducts

      setProviderInfo(providerInfo)
      setCapabilities(providerCapabilities)
      setSelectedProducts(products, autoSelect ? products : [])
      setConfirmUsingPrintifyChoice(confirmChoosePrintifyChoice)
    } catch (err) {
      console.error('Failed to fetch imported products:', err)
    } finally {
      setFetching(false)
    }
  }, [autoSelect, pIntegrationId])

  /**
   * Handles saving products to Shopify
   * @param {SaveProductsParams} params - Object containing provider ID
   * @throws {Error} If provider ID is missing or API call fails
   * @returns {Promise<Response>} API response
   */
  const handleSaveProductsToShopify = async ({ providerId, productIds }: SaveProductsParams) => {
    try {
      if (!providerId) {
        console.error('Provider ID is required')
      }

      const res = await authenticatedFetch(`/api/providers-integration/${providerId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: PROVIDER_INTEGRATION_ACTION.IMPORT_PRODUCTS_TO_SHOPIFY,
          productIds,
        }),
      })

      return res
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save products'
      console.error('Failed to save products:', errorMessage)
      return null
    }
  }

  useEffect(() => {
    if (pIntegrationId) {
      ;(async () => {
        await fetchImportedProducts()
      })()
    }
  }, [fetchImportedProducts, pIntegrationId])

  return {
    fetching,
    providerInfo,
    capabilities,
    selectedProducts: selectedProductsState.selectedProducts,
    recentlyAddedProducts: selectedProductsState.recentlyAddedProducts,
    confirmUsingPrintifyChoice,
    setSelectedProducts,
    setConfirmUsingPrintifyChoice,
    handleSaveProductsToShopify,
  }
}

import { useMemo } from 'react'
import type { ProviderDocument } from '~/models/Provider'
import { type TemporaryProduct } from '~/models/TemporaryFulfillmentProducts'
import { useFetchPrintifyProducts } from '~/modules/modals/PrintifyProductsSelector/hooks/useFetchPrintifyProducts'
import find from 'lodash/find'
import { type IBlueprintWithAdvanceInfo } from '~/routes/api.providers-connection.$id/Printify/types'
import { PRINTIFY_CHOICE_NAME_ID } from '~/routes/api.providers-integration.$id/constants'
import type { ProviderCapabilities } from '~/services/fulfillment/types'

export interface IProductsInfo {
  products: IBlueprintWithAdvanceInfo[]
  recentlyProductIds: string[]
}

export interface UseSelectedProductsDetailsOptions {
  selectedProducts: TemporaryProduct[]
  recentlyAddedProducts: TemporaryProduct[]
  providerInfo: ProviderDocument
  capabilities?: ProviderCapabilities
}

export interface UseSelectedProductsDetailsReturn {
  selectedProductsDetails: IBlueprintWithAdvanceInfo[]
  classifiedProviders: {
    productsPrintifyChoiceInfo: IProductsInfo
    productsOtherProvidersInfo: IProductsInfo
    [key: string]: IProductsInfo
  }
  isFetching: boolean
}

/**
 * Custom hook that provides selected products details with capability-based enhancements.
 * Replaces withSelectedProductsDetails HOC to enable granular re-renders.
 *
 * Uses capabilities flags instead of provider name checks:
 * - hasBlueprintCatalog: fetch Printify blueprints and classify by print provider
 * - all other providers: map TemporaryProduct[] directly to IBlueprintWithAdvanceInfo[]
 *
 * Time Complexity:
 * - classifiedProviders: O(n) where n is number of blueprints
 * - recentlyAddedProductIds: O(m) where m is number of recently added products
 *
 * @param options - Configuration object with selectedProducts, recentlyAddedProducts, providerInfo, and capabilities
 * @returns Object containing selectedProductsDetails, classifiedProviders, and isFetching state
 */
export function useSelectedProductsDetails(
  options: UseSelectedProductsDetailsOptions
): UseSelectedProductsDetailsReturn {
  const { selectedProducts, recentlyAddedProducts, providerInfo, capabilities } = options
  const { name: providerName = '', _id: providerId } = providerInfo || {}

  const hasBlueprintCatalog = capabilities?.hasBlueprintCatalog ?? false

  // Only fetch Printify blueprints for providers with blueprint catalog
  const { isFetching, blueprints } = useFetchPrintifyProducts({
    providerId,
    selectedProducts: hasBlueprintCatalog ? selectedProducts : [],
  })

  // Generic product mapping for ALL non-catalog providers (ShineOn, PrintWay, future providers)
  const genericProducts: IBlueprintWithAdvanceInfo[] = useMemo(() => {
    if (hasBlueprintCatalog) return []
    return selectedProducts.map(product => ({
      id: product.productId as unknown as number,
      title: product.title || '',
      description: product.description || '',
      brand: '',
      model: '',
      images: product.images || [],
      baseProfitMargin: product.baseProfitMargin || 0,
      productProviderId: providerName?.toLowerCase() || '',
    }))
  }, [hasBlueprintCatalog, selectedProducts, providerName])

  // Memoize recently added product IDs for O(1) lookup
  const recentlyAddedProductIds = useMemo(
    () => recentlyAddedProducts.map(product => product.productId),
    [recentlyAddedProducts]
  )

  // Classify blueprints into Printify Choice vs Other Providers
  const classifiedProviders = useMemo(() => {
    // Non-catalog providers: all products go into productsOtherProvidersInfo
    if (!hasBlueprintCatalog) {
      return {
        productsPrintifyChoiceInfo: {
          products: [] as IBlueprintWithAdvanceInfo[],
          recentlyProductIds: [] as string[],
        },
        productsOtherProvidersInfo: {
          products: genericProducts,
          recentlyProductIds: recentlyAddedProductIds.filter(id => genericProducts.some(p => String(p.id) === id)),
        },
      }
    }

    if (!blueprints || blueprints.length === 0) {
      return {
        productsPrintifyChoiceInfo: {
          products: [] as IBlueprintWithAdvanceInfo[],
          recentlyProductIds: [] as string[],
        },
        productsOtherProvidersInfo: {
          products: [] as IBlueprintWithAdvanceInfo[],
          recentlyProductIds: [] as string[],
        },
      }
    }

    // Use reduce to classify products in a single pass (O(n))
    return blueprints.reduce(
      (result, blueprint) => {
        // Convert blueprint ID to string for comparison
        const blueprintIdStr = String(blueprint.id)

        // Check if this blueprint has Printify Choice provider
        const isPrintifyProduct = blueprint.providerList && find(blueprint.providerList, PRINTIFY_CHOICE_NAME_ID)

        // Determine category
        const category = isPrintifyProduct ? 'productsPrintifyChoiceInfo' : 'productsOtherProvidersInfo'

        return {
          ...result,
          [category]: {
            products: [...result[category].products, blueprint],
            recentlyProductIds: recentlyAddedProductIds.includes(blueprintIdStr)
              ? [...result[category].recentlyProductIds, blueprintIdStr]
              : result[category].recentlyProductIds,
          },
        }
      },
      {
        productsPrintifyChoiceInfo: {
          products: [] as IBlueprintWithAdvanceInfo[],
          recentlyProductIds: [] as string[],
        },
        productsOtherProvidersInfo: {
          products: [] as IBlueprintWithAdvanceInfo[],
          recentlyProductIds: [] as string[],
        },
      }
    )
  }, [blueprints, recentlyAddedProductIds, hasBlueprintCatalog, genericProducts])

  return {
    selectedProductsDetails: hasBlueprintCatalog ? blueprints : genericProducts,
    classifiedProviders,
    isFetching: hasBlueprintCatalog ? isFetching : false,
  }
}

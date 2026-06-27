import { useMemo } from 'react'
import { useStore } from '~/libs/external-store'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { FontCombinationSuggestionsStore } from '~/stores/modules/font-combination-suggestions'

/**
 * Hook to get AI-suggested font combinations based on the current variant
 * Data is prefetched when entering Product Editor - this hook just reads from store
 */
export function useSuggestedFontCombinations() {
  // Get data from prefetched store
  const cliparts = useStore(FontCombinationSuggestionsStore, state => state.cliparts)
  const isLoading = useStore(FontCombinationSuggestionsStore, state => state.isLoading)
  const fromCache = useStore(FontCombinationSuggestionsStore, state => state.fromCache)
  const error = useStore(FontCombinationSuggestionsStore, state => state.error)

  // Get current product from IntegrationStore to check hasProduct
  const variants = useStore(IntegrationStore, state => state.variants)
  const selectedTab = useStore(IntegrationStore, state => state.selectedTab)

  const hasProduct = useMemo(() => {
    const currentVariant = variants?.[selectedTab] || variants?.[0]
    return Boolean(currentVariant?.product?.id)
  }, [variants, selectedTab])

  return {
    cliparts,
    isLoading,
    fromCache,
    error,
    hasProduct,
  }
}

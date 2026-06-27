import { useEffect, useRef } from 'react'
import { useParams } from '@remix-run/react'
import { useStore } from '~/libs/external-store'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { prefetchFontCombinationSuggestions } from '~/stores/modules/font-combination-suggestions'
import { useEditorParams } from './useEditorParams'
import { generateVariantHash } from '~/routes/api.ai-assistant.suggest-font-combinations/variantHash'

/**
 * Hook to prefetch data when entering Product Editor
 * Only triggers ONCE per integration/mockup/product/variant combo
 *
 * Note: Stores are reset in ProductEditor/index.tsx when integrationId changes
 */
export function usePrefetchOnEditorLoad() {
  const params = useParams()
  const integrationId = params.id || ''
  const { mockupId } = useEditorParams()
  const variants = useStore(IntegrationStore, state => state.variants)

  // Track the last prefetched key to prevent duplicate calls
  const lastPrefetchedKeyRef = useRef<string | null>(null)
  // Track if we've seen empty variants after integrationId change (ensures data is reset)
  const hasSeenEmptyVariantsRef = useRef<boolean>(false)

  useEffect(() => {
    // Skip if no variants (during RESET phase or still loading)
    if (!variants || variants.length === 0) {
      hasSeenEmptyVariantsRef.current = true // Mark that reset happened
      return
    }

    // CRITICAL: When integrationId changes, variants should be reset to empty array first.
    // Only prefetch after we've seen empty variants (hasSeenEmptyVariantsRef = true),
    // which ensures variants are fresh for current integration.
    if (!hasSeenEmptyVariantsRef.current) {
      return // Skip stale variants from previous integration
    }

    // Active variant = the variant matching current mockupId in URL; fallback to first variant
    const selectedVariant = (mockupId ? variants.find(v => v.mockup?._id === mockupId) : undefined) || variants[0]
    const selectedMockupId = selectedVariant?.mockup?._id
    const product = selectedVariant?.product

    // Skip if missing required data (still loading/initializing)
    if (!selectedMockupId || !product?.id || !product?.title) {
      return
    }

    const variantTitles = product.hasOnlyDefaultVariant
      ? []
      : variants.map(v => v.title || v.displayName || '').filter(Boolean)

    const variantsForMockup = selectedMockupId ? variants.filter(v => v.mockup?._id === selectedMockupId) : variants
    const firstVariantForMockup = variantsForMockup[0] || variants[0]
    const isFirstVariant = selectedVariant === firstVariantForMockup

    const variantsForMockupIds = variantsForMockup.map(v => v.id || v._id)
    const variantHash = generateVariantHash(variantsForMockupIds)

    // Generate unique key for this integration/mockup/product/variant combo
    const prefetchKey = `${integrationId}:${selectedMockupId}:${product.id}:${variantHash}`

    // Skip if already prefetched this exact combo
    if (lastPrefetchedKeyRef.current === prefetchKey) {
      return
    }

    // Mark as prefetched BEFORE calling to prevent race conditions
    lastPrefetchedKeyRef.current = prefetchKey

    const context = {
      integrationId,
      mockupId: selectedMockupId,
      variantTitles,
      productId: product.id,
      productTitle: product.title,
      isFirstVariant,
      variantHash,
    }

    // Trigger prefetch
    triggerPrefetchFunctions(context)
  }, [variants, mockupId, integrationId])

  // Reset refs when integrationId changes (stores are reset in ProductEditor/index.tsx)
  useEffect(() => {
    lastPrefetchedKeyRef.current = null
    hasSeenEmptyVariantsRef.current = false // Wait for variants to be reset to empty array
  }, [integrationId])
}

/**
 * Context passed to prefetch functions
 * Uses currently selected variant title for variant-specific suggestions
 */
interface PrefetchContext {
  integrationId: string // Integration ID to ensure uniqueness per integration
  mockupId: string
  variantTitles: string[] // Current variant: ["Gold"] for variant-specific suggestions
  productId: string
  productTitle: string
  isFirstVariant: boolean // true iff selectedVariant === variants[0]
  variantHash: string // hash of currently integrated variant set
}

/**
 * Trigger all prefetch functions
 * Add new prefetch calls here as needed
 */
function triggerPrefetchFunctions(context: PrefetchContext) {
  // Font combination suggestions
  prefetchFontCombinationSuggestions(context).catch(err => {
    console.error('[usePrefetchOnEditorLoad] Font combinations error:', err)
  })

  // Add more prefetch functions here in the future:
  // prefetchRelatedCliparts(context).catch(...)
  // prefetchProductRecommendations(context).catch(...)
}

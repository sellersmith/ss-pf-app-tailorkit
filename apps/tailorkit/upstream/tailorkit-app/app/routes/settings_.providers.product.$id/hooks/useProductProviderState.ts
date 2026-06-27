import { useMemo } from 'react'
import { useStore } from '~/libs/external-store'
import isEqual from 'lodash/isEqual'
import type { TemporaryProduct } from '~/models/TemporaryFulfillmentProducts'
import { ProductProviderStore } from '../stores/productProviderStore'

/**
 * Normalize HTML description to prevent false positives from RichTextEditor formatting
 * RichTextEditor (react-quill) converts <div> to <p>, <br /> to <br>, and normalizes whitespace
 */
function normalizeDescription(html: string): string {
  if (!html) return ''

  // Replace block-level tags with space to preserve word boundaries
  // <div>word</div><div>word2</div> → "word word2" not "wordword2"
  let normalized = html.replace(/<\/(div|p|br|h[1-6]|li|tr|td|th)>/gi, ' ')

  // Remove all remaining HTML tags
  normalized = normalized.replace(/<[^>]+>/g, '')

  // Decode HTML entities
  const temp = document.createElement('div')
  temp.innerHTML = normalized
  const text = temp.textContent || temp.innerText || ''

  // Normalize whitespace: replace multiple spaces/newlines/tabs with single space
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Custom hook for managing product provider state with 2-state comparison pattern
 *
 * Similar to useGlobalStylingHistory, maintains:
 * - savedProductData: Immutable baseline (from server OR after save)
 * - currentProductData: Built from store selectors (real-time working state)
 *
 * This provides accurate change detection while keeping store as source of truth.
 *
 * @param initialProductData - The baseline product data from server/after save
 * @returns Object containing current/saved states, isChanged flag, and disabledSave flag
 *
 * @see useGlobalStylingHistory for similar 2-state pattern
 */
export function useProductProviderState(
  initialProductData: TemporaryProduct,
  options?: { requireProviderId?: boolean }
) {
  const { requireProviderId = true } = options || {}
  // Extract current working state from store
  const title = useStore(ProductProviderStore, state => state.title)
  const description = useStore(ProductProviderStore, state => state.description)
  const productProviderId = useStore(ProductProviderStore, state => state.productProviderId)
  const variants = useStore(ProductProviderStore, state => state.variants)

  // Build current product data from store state
  const currentProductData = useMemo(
    () => ({
      title,
      description,
      productProviderId,
      variants,
    }),
    [title, description, productProviderId, variants]
  )

  // Extract relevant fields from saved state for comparison
  const savedProductData = useMemo(
    () => ({
      title: initialProductData.title,
      description: initialProductData.description,
      productProviderId: initialProductData.productProviderId,
      variants: initialProductData.variants,
    }),
    [initialProductData]
  )

  // Normalize descriptions for comparison (RichTextEditor changes HTML structure)
  const normalizedCurrentData = useMemo(
    () => ({
      ...currentProductData,
      description: normalizeDescription(currentProductData.description),
    }),
    [currentProductData]
  )

  const normalizedSavedData = useMemo(
    () => ({
      ...savedProductData,
      description: normalizeDescription(savedProductData.description),
    }),
    [savedProductData]
  )

  // Disable save if no variants, or no provider when required (Printify needs provider selection, ShineOn doesn't)
  const disabledSave = (requireProviderId && !productProviderId) || !variants.length

  // Deep equality check with proper memoization (using normalized data)
  const isChanged = useMemo(() => {
    // Prevent false positive when initialProductData hasn't loaded yet
    if (requireProviderId && !savedProductData.productProviderId && !currentProductData.productProviderId) {
      return false
    }
    // For providers that don't require productProviderId, check if variants are loaded
    if (!requireProviderId && !variants.length) {
      return false
    }

    return !isEqual(normalizedCurrentData, normalizedSavedData)
  }, [
    normalizedCurrentData,
    normalizedSavedData,
    savedProductData.productProviderId,
    currentProductData.productProviderId,
    requireProviderId,
    variants.length,
  ])

  return {
    currentProductData,
    savedProductData,
    isChanged,
    disabledSave,
  }
}

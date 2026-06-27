import { createStore } from '~/libs/external-store'
import { authenticatedFetch } from '~/shopify/fns.client'

// Clipart detail from API
interface ClipartItem {
  _id: string
  name: string
  thumbnailUrl: string
  type: string
  clickCount: number
}

interface SuggestionsResponse {
  success: boolean
  cliparts?: ClipartItem[]
  fromCache?: boolean
  error?: string
}

// State for font combination suggestions
interface FontCombinationSuggestionsState {
  cliparts: ClipartItem[]
  isLoading: boolean
  error: string | null
  fromCache: boolean
  // Track which mockup was fetched to avoid duplicate fetches
  fetchedKey: string | null
}

type Action =
  | { type: 'FETCH_START'; payload: { key: string } }
  | { type: 'FETCH_SUCCESS'; payload: { cliparts: ClipartItem[]; fromCache: boolean } }
  | { type: 'FETCH_ERROR'; payload: { error: string } }
  | { type: 'RESET' }

const initialState: FontCombinationSuggestionsState = {
  cliparts: [],
  isLoading: false,
  error: null,
  fromCache: false,
  fetchedKey: null,
}

const reducer = (state: FontCombinationSuggestionsState, action: Action): FontCombinationSuggestionsState => {
  switch (action.type) {
    case 'FETCH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
        fetchedKey: action.payload.key,
      }

    case 'FETCH_SUCCESS':
      return {
        ...state,
        isLoading: false,
        cliparts: action.payload.cliparts,
        fromCache: action.payload.fromCache,
        error: null,
        // Keep fetchedKey to track which variant's data is currently stored
        // This allows checking if we need to fetch again when variant changes
      }

    case 'FETCH_ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.payload.error,
      }

    case 'RESET':
      // Clear currentFetchKey to prevent memory leak when navigating away
      currentFetchKey = null
      return initialState

    default:
      return state
  }
}

export const FontCombinationSuggestionsStore = createStore(reducer, initialState)

// Track in-flight requests to prevent duplicates across RESET cycles
let currentFetchKey: string | null = null

/**
 * Reset the in-flight tracking key
 * Call this when navigating away from Product Editor to allow new mockup fetch
 */
export function resetFetchKey(): void {
  currentFetchKey = null
}

/**
 * Generate fetch key from integrationId + mockupId + productId + variantHash
 * This is used to track which integration/variant's data is currently in the store
 * Different integrations need different fetchKeys even if same mockup/product/variant
 *
 * Example:
 * - Integration A, Default variant: "integration-A:mockup-123:product-456:_default_"
 * - Integration B, Default variant: "integration-B:mockup-123:product-456:_default_"
 * - Integration A, Gold variant: "integration-A:mockup-123:product-456:Gold"
 */
function generateFetchKey(integrationId: string, mockupId: string, productId: string, variantHash: string): string {
  return `${integrationId}:${mockupId}:${productId}:${variantHash || '_default_'}`
}

/**
 * Prefetch font combination suggestions
 * Call this when entering Product Editor to load suggestions in background
 *
 * IMPORTANT: fetchKey includes variantTitles to track which variant is currently displayed
 * This allows fetching again when switching variants, even if same product
 * Server-side cache only stores default variant, but client needs to fetch for each variant
 */
export async function prefetchFontCombinationSuggestions(params: {
  integrationId: string // Integration ID to ensure uniqueness per integration
  mockupId: string
  variantTitles: string[] // Used for query generation AND fetchKey tracking
  productId: string
  productTitle: string
  isFirstVariant: boolean // true iff selectedVariant === variants[0]
  variantHash: string // hash of currently integrated variant set
}): Promise<void> {
  const { integrationId, mockupId, variantTitles, productId, productTitle, isFirstVariant, variantHash } = params

  // Fetch key includes integrationId to differentiate between integrations
  // This ensures we can fetch again when switching integrations, even if same mockup/product/variant
  const fetchKey = generateFetchKey(integrationId, mockupId, productId, variantHash)

  // Skip if already fetching THIS EXACT variant (same mockup + same product + same variant)
  if (currentFetchKey === fetchKey) {
    return
  }

  // Skip if already fetched for THIS EXACT variant (store still has data for this variant)
  const currentState = FontCombinationSuggestionsStore.getState()

  if (currentState.fetchedKey === fetchKey && (currentState.isLoading || currentState.cliparts.length > 0)) {
    return
  }

  // If variant changed (different fetchKey), fetch new suggestions
  // Each variant gets its own fetch, even though server only caches default variant

  // Mark as in-flight
  currentFetchKey = fetchKey

  // Start fetch
  FontCombinationSuggestionsStore.dispatch({
    type: 'FETCH_START',
    payload: { key: fetchKey },
  })

  try {
    const response = (await authenticatedFetch('/api/ai-assistant/suggest-font-combinations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mockupId,
        variantTitles, // Used for query generation
        productId,
        productTitle,
        isFirstVariant, // server caches ONLY when this is true (variants[0])
        variantHash, // invalidates cache when integrated variant set changes
      }),
    })) as SuggestionsResponse

    // Reset currentFetchKey after fetch completes (success or error)
    // This allows fetching different variants even if previous fetch is still in progress
    currentFetchKey = null

    if (response?.success) {
      FontCombinationSuggestionsStore.dispatch({
        type: 'FETCH_SUCCESS',
        payload: {
          cliparts: response.cliparts || [],
          fromCache: response.fromCache || false,
        },
      })
    } else {
      FontCombinationSuggestionsStore.dispatch({
        type: 'FETCH_ERROR',
        payload: { error: response?.error || 'Failed to fetch suggestions' },
      })
    }
  } catch (err: any) {
    // Reset currentFetchKey on error too
    currentFetchKey = null
    console.error('[FontCombinationSuggestions] Prefetch error:', err)
    FontCombinationSuggestionsStore.dispatch({
      type: 'FETCH_ERROR',
      payload: { error: err.message || 'An error occurred' },
    })
  }
}

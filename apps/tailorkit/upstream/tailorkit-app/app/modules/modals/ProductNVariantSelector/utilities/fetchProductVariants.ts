import { INTEGRATION_ACTION } from '~/routes/api.integrations/constants'
import { authenticatedFetch } from '~/shopify/fns.client'
import type { IPageInfo, IProduct } from '~/types/shopify-product'
import { asyncThrottle } from '~/utils/asyncThrottle'
import { decompressData } from '~/utils/file-types/zip'

// Configuration constants
const MAX_RESPONSE_CACHE = 20
const MAX_ABORT_CONTROLLERS = 50
const FORM_DATA_CACHE_SIZE = 10
const CACHE_TTL_MS = 3 * 60 * 1000 // 3 minutes cache TTL
const REQUEST_TIMEOUT_MS = 30000 // 30 seconds
const MAX_RETRY_ATTEMPTS = 2

// Response type definition
interface ProductsResponse {
  productsList: any[]
  pageInfo: IPageInfo
}

// Request parameters type
interface FetchProductVariantsParams {
  pageInfo: IPageInfo
  isFetchNextPage?: boolean
  productName?: string
  variantName?: string
  queryString?: string
  productId?: string
  withArchived?: boolean
  requestId?: string
}

/**
 * Creates a stable string representation of an object for caching purposes
 */
function stableStringify(obj: Record<string, any>): string {
  try {
    return Object.entries(obj)
      .filter(([_, v]) => v !== undefined) // Exclude undefined values
      .sort()
      .map(([k, v]) => `${k}:${v === null ? 'null' : v}`)
      .join('|')
  } catch (error) {
    console.error('Error creating stable string:', error)
    // Fallback to a simpler but less optimal solution
    return JSON.stringify(Object.entries(obj).sort())
  }
}

/**
 * Fetches Shopify product variants from the backend with built-in support for:
 * - Throttling (to prevent excessive API calls)
 * - Request cancellation using AbortController (with LRU cleanup)
 * - Response memoization for identical non-pagination queries
 * - Handling compressed payloads and decompressing data efficiently
 * - Automatic retry for transient network failures
 * - Cache TTL management and proper memory cleanup
 *
 * @param params - Object containing all the filtering and pagination info
 * @param params.pageInfo - Pagination cursor information
 * @param [params.isFetchNextPage=false] - Indicates if it's a "load more" request
 * @param [params.productName] - Filter by product name (case-insensitive substring match)
 * @param [params.variantName] - Filter by variant name (case-insensitive substring match)
 * @param [params.queryString] - Raw search query (from user input)
 * @param [params.productId] - Shopify product ID (used when filtering by ID)
 * @param [params.withArchived=false] - Whether to include archived products
 * @param [params.requestId] - Optional custom request ID (used to scope and abort duplicate requests)
 *
 * @returns A Promise resolving to an object:
 * - `productsList`: an array of filtered variants, enriched with parent product
 * - `pageInfo`: pagination information if available
 *
 * @throws AbortError - If the request is explicitly aborted via AbortController
 * @throws Error - For any other fetch or decompression failures (logged internally)
 */
const fetchProductVariants = asyncThrottle(async (params: FetchProductVariantsParams): Promise<ProductsResponse> => {
  const {
    pageInfo,
    isFetchNextPage = false,
    productName = '',
    variantName = '',
    queryString = '',
    productId = '',
    withArchived = false,
    requestId = Date.now().toString(),
  } = params

  const requestIdentifierName = createRequestIdentifier({
    productName,
    variantName,
    queryString,
    productId,
    isFetchNextPage,
    pageInfo,
  })

  // Generate a unique identifier for this request
  const requestIdentifier = `${requestId}-${requestIdentifierName}`

  // Check response cache for identical non-pagination requests
  const responseCacheKey = isFetchNextPage
    ? ''
    : stableStringify({ productName, variantName, queryString, productId, withArchived })

  // Check cache and its freshness
  if (!isFetchNextPage && responseCacheKey && responseCache.has(responseCacheKey)) {
    const cachedResponse = responseCache.get(responseCacheKey)
    if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL_MS) {
      return cachedResponse.data
    }

    // Cache expired, remove it
    responseCache.delete(responseCacheKey)
  }

  let retryCount = 0
  let lastError: Error | null = null

  while (retryCount <= MAX_RETRY_ATTEMPTS) {
    try {
      // Check if we need to clean up old controllers
      cleanupAbortControllers()

      // Use optimized form data creation
      const formData = getFormData({
        pageInfo,
        isFetchNextPage,
        productName: productName || '',
        variantName: variantName || '',
        queryString: queryString || '',
        productId: productId || '',
        withArchived,
      })

      // Abort previous requests with the same identifier
      abortRelatedRequests(requestIdentifier, requestIdentifierName, isFetchNextPage)

      // Create a new abort controller for this request
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

      abortControllerMap.set(requestIdentifier, {
        controller,
        timestamp: Date.now(),
        timeoutId,
      })
      const signal = controller.signal

      const res = await authenticatedFetch(
        `/api/integrations?action=${INTEGRATION_ACTION.FETCH_ALL_PRODUCT_VARIANTS}`,
        {
          method: 'POST',
          body: formData,
          signal,
        }
      )

      // Clear timeout and clean up the controller once request is complete
      clearTimeout(timeoutId)
      abortControllerMap.delete(requestIdentifier)

      if (!res) {
        throw new Error('Empty response received')
      }

      if (!res.success) {
        throw new Error(res.error || 'Unknown error occurred')
      }

      // Handle compressed data if it exists
      let productsList: IProduct[] = []
      if (res.isCompressed && res.compressedProductsList) {
        try {
          // Convert the Base64 string to Uint8Array using optimized method
          const compressedData = base64ToUint8Array(res.compressedProductsList)
          const decompressedData = decompressData(compressedData)

          if (!Array.isArray(decompressedData)) {
            throw new Error('Decompressed data is not an array')
          }

          productsList = decompressedData
        } catch (decompressError) {
          console.error('Error decompressing data:', decompressError)
          throw new Error('Failed to decompress product data')
        }
      } else {
        productsList = Array.isArray(res.productsList) ? res.productsList : []
      }

      // Process data once and memoize the transformed result
      const transformedResult = processProductData(productsList, productName, variantName, res.pageInfo)

      // Cache successful non-pagination responses with timestamp
      if (!isFetchNextPage && responseCacheKey) {
        // Implement LRU for response cache
        if (responseCache.size >= MAX_RESPONSE_CACHE) {
          const oldestEntry = [...responseCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0]

          if (oldestEntry) {
            responseCache.delete(oldestEntry[0])
          }
        }

        responseCache.set(responseCacheKey, {
          data: transformedResult,
          timestamp: Date.now(),
        })
      }
      return transformedResult
    } catch (err) {
      // Clear any existing timeout
      const entry = abortControllerMap.get(requestIdentifier)
      if (entry && entry.timeoutId) {
        clearTimeout(entry.timeoutId)
      }

      // Clean up the controller if there was an error
      abortControllerMap.delete(requestIdentifier)

      // Explicitly check for AbortError and re-throw it so it can be handled by the caller
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err
      }

      // Network or server errors might be transient - retry those
      const isNetworkError
        = err instanceof Error
        && (err.message.includes('network') || err.message.includes('timeout') || err.message.includes('failed to fetch'))

      if (isNetworkError && retryCount < MAX_RETRY_ATTEMPTS) {
        lastError = err as Error
        retryCount++
        // Exponential backoff with proper closure
        const currentRetry = retryCount
        await new Promise(resolve => setTimeout(resolve, 2 ** currentRetry * 500))
        continue
      }

      console.error('Error in fetchProductVariants:', err)
      throw err instanceof Error ? err : new Error(String(err))
    }
  }

  console.error(`Failed after ${MAX_RETRY_ATTEMPTS} retry attempts:`, lastError)
  return { productsList: [], pageInfo: {} as IPageInfo }
})

// Response cache to avoid redundant processing of identical responses
interface CacheEntry<T> {
  data: T
  timestamp: number
}

const responseCache = new Map<string, CacheEntry<ProductsResponse>>()

// Use a Map to track AbortControllers by request ID with LRU logic
interface AbortControllerEntry {
  controller: AbortController
  timestamp: number
  timeoutId: ReturnType<typeof setTimeout>
}

const abortControllerMap = new Map<string, AbortControllerEntry>()

// Performance optimization: create a shared, reusable FormData cache
interface FormDataCacheEntry {
  formData: FormData
  timestamp: number
}

const formDataCache = new Map<string, FormDataCacheEntry>()

/**
 * Aborts related requests based on request identifier and pagination status
 */
const abortRelatedRequests = (requestIdentifier: string, requestIdentifierName: string, isFetchNextPage: boolean) => {
  // Find all controllers that match this request pattern
  Array.from(abortControllerMap.keys())
    .filter(key => {
      if (key === requestIdentifier) return false

      if (!isFetchNextPage) {
        // For new searches, abort all non-pagination requests with same base identifier
        return key.includes(requestIdentifierName) && !key.includes('-next-')
      }
      // For pagination, only abort other pagination requests for the same query
      return key.includes(requestIdentifierName) && key.includes('-next-')
    })
    .forEach(key => {
      const entry = abortControllerMap.get(key)
      if (entry) {
        if (entry.timeoutId) {
          clearTimeout(entry.timeoutId)
        }
        entry.controller.abort()
        abortControllerMap.delete(key)
      }
    })
}

/**
 * Cleanup function to prevent memory leaks by implementing LRU (Least Recently Used) strategy
 * and TTL-based expiration
 */
const cleanupAbortControllers = () => {
  const now = Date.now()

  // Clean up expired form data cache entries
  Array.from(formDataCache.entries())
    .filter(([_, entry]) => now - entry.timestamp > CACHE_TTL_MS)
    .forEach(([key]) => formDataCache.delete(key))

  // Clean up expired response cache entries
  Array.from(responseCache.entries())
    .filter(([_, entry]) => now - entry.timestamp > CACHE_TTL_MS)
    .forEach(([key]) => responseCache.delete(key))

  if (abortControllerMap.size > MAX_ABORT_CONTROLLERS) {
    // Sort controllers by timestamp and keep only the most recent ones
    const entries = Array.from(abortControllerMap.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)

    // Remove oldest controllers
    const keysToDelete = entries.slice(0, Math.floor(MAX_ABORT_CONTROLLERS / 2)).map(([key]) => key)

    keysToDelete.forEach(key => {
      const entry = abortControllerMap.get(key)
      if (entry) {
        if (entry.timeoutId) {
          clearTimeout(entry.timeoutId)
        }
        entry.controller.abort()
        abortControllerMap.delete(key)
      }
    })
  }
}

/**
 * Safely converts a Base64 string to a Uint8Array
 * @param base64 - Base64 encoded string
 * @returns Uint8Array containing decoded data
 * @throws Error if the input is not valid base64
 */
const base64ToUint8Array = (base64: string): Uint8Array => {
  try {
    // Validate base64 string format
    if (!/^[A-Za-z0-9+/=]+$/.test(base64)) {
      throw new Error('Invalid base64 format')
    }

    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)

    // Use typed arrays for better performance
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    return bytes
  } catch (error) {
    console.error('Error converting base64 to Uint8Array:', error)
    throw new Error('Failed to decode base64 data')
  }
}

/**
 * Creates a unique identifier for a request based on its parameters
 */
const createRequestIdentifier = (params: {
  productName?: string
  variantName?: string
  queryString?: string
  productId?: string
  isFetchNextPage?: boolean
  pageInfo?: IPageInfo
}) => {
  const { productName, variantName, queryString, productId, isFetchNextPage, pageInfo } = params

  // For pagination requests, include endCursor in the identifier
  const pageInfoPart = isFetchNextPage && pageInfo ? `-cursor:${pageInfo.endCursor || ''}` : ''

  return `${productName || ''}-${variantName || ''}-${queryString || ''}-${productId || ''}-${isFetchNextPage ? 'next-' : 'first'}${pageInfoPart}`
}

/**
 * Processes product data efficiently by properly handling filtering and transformations
 */
function processProductData(
  productsList: IProduct[],
  productName = '',
  variantName = '',
  responsePageInfo: IPageInfo = {} as IPageInfo
): ProductsResponse {
  // Safely handle null or undefined productsList
  if (!Array.isArray(productsList)) {
    return { productsList: [], pageInfo: responsePageInfo || {} }
  }

  // Pre-compute search terms once outside the loop
  const hasSearchTerms = !!productName || !!variantName
  const _productName = productName ? productName.toLowerCase() : ''
  const _variantName = variantName ? variantName.toLowerCase() : ''

  return {
    productsList: productsList.map((product: IProduct) => {
      // Defensive programming: ensure product has expected structure
      if (!product || !product.variants || !Array.isArray(product.variants.nodes)) {
        return { ...product, variants: [] }
      }

      // Precompute product title once per product
      const productTitle = hasSearchTerms ? product.title.toLowerCase() : ''
      const productMatchesName = hasSearchTerms && _productName && productTitle.includes(_productName)

      // Skip filtering if no search terms are provided
      if (!hasSearchTerms) {
        return {
          ...product,
          variants: product.variants.nodes.map(v => ({ ...v, product })),
        }
      }

      // Filter variants that match the search criteria with optimized logic
      const filteredVariants = (product.variants.nodes || [])
        .filter(pVariant => {
          if (!pVariant || typeof pVariant.displayName !== 'string') return false

          // If product title already matches the product name search, no need to check variants
          if (productMatchesName && !_variantName) return true

          const displayNameVariant = pVariant.displayName.toLowerCase()

          // Check if variant matches any search criteria
          return (
            (_productName && displayNameVariant.includes(_productName))
            || (_variantName && displayNameVariant.includes(_variantName))
            || productMatchesName
            || (_variantName && productTitle.includes(_variantName))
          )
        })
        .map(pVariant => ({
          ...pVariant,
          product,
        }))

      return {
        ...product,
        variants: filteredVariants,
      }
    }),
    pageInfo: responsePageInfo || {},
  }
}

/**
 * Creates or retrieves cached FormData for the request
 */
const getFormData = (params: {
  pageInfo: IPageInfo
  isFetchNextPage: boolean
  productName?: string
  variantName?: string
  queryString?: string
  productId?: string
  withArchived: boolean
}): FormData => {
  const cacheKey = stableStringify(params)
  const now = Date.now()

  if (formDataCache.has(cacheKey)) {
    const entry = formDataCache.get(cacheKey)
    if (entry && now - entry.timestamp < CACHE_TTL_MS) {
      return entry.formData
    }
    // Remove expired entry
    formDataCache.delete(cacheKey)
  }

  const formData = new FormData()
  formData.append('pageInfo', JSON.stringify(params.pageInfo || {}))
  formData.append('isFetchNextPage', params.isFetchNextPage.toString())
  formData.append('productName', (params.productName || '').trim())
  formData.append('variantName', (params.variantName || '').trim())
  formData.append('queryString', (params.queryString || '').trim())
  formData.append('productId', params.productId || '')
  formData.append('withArchived', params.withArchived.toString())

  // Only cache form data for non-pagination requests to avoid memory bloat
  if (!params.isFetchNextPage) {
    // Implement LRU for form data cache
    if (formDataCache.size >= FORM_DATA_CACHE_SIZE) {
      const oldestEntry = [...formDataCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0]

      if (oldestEntry) {
        formDataCache.delete(oldestEntry[0])
      }
    }

    formDataCache.set(cacheKey, {
      formData,
      timestamp: now,
    })
  }

  return formData
}

export default fetchProductVariants

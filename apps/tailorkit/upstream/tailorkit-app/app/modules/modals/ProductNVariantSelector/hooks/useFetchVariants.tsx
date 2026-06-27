import { useState, useMemo, useCallback, useRef } from 'react'
import uniqBy from 'lodash/uniqBy'
import fetchProductVariants from '../utilities/fetchProductVariants'
import type { IProductWithVariants } from '~/types/shopify-product'
import { useProductVariantsLoad } from './useProductVariantsLoad'

const defaultPageInfo = { hasNextPage: false, endCursor: '', hasPreviousPage: false, startCursor: '' }

/**
 * Custom hook to fetch and manage product variants with pagination
 * @returns {Object} Variants state and handlers
 */
export const useFetchVariants = () => {
  const { initializeProduct } = useProductVariantsLoad()

  // Use a single loading state with different statuses for better performance
  const [loadingState, setLoadingState] = useState({
    isLoading: false,
    isFetchingNextPage: false,
  })

  const [variantPageInfo, setVariantPageInfo] = useState(defaultPageInfo)
  const [productsList, setProductsList] = useState<IProductWithVariants[]>([])
  const [hasProducts, setHasProducts] = useState(false)

  // Refs for tracking request state
  const activeRequestRef = useRef<string>('')
  const pendingRequestsCount = useRef(0)
  const initializeProductRef = useRef(initializeProduct)

  // Cache the last request parameters to avoid duplicate requests
  const lastRequestParamsRef = useRef<string>('')

  // Memoize getters for better performance
  const { isLoading, isFetchingNextPage } = loadingState

  /**
   * Efficiently updates loading state with batched updates
   */
  const updateLoadingState = useCallback((updates: Partial<typeof loadingState>) => {
    setLoadingState(prev => ({ ...prev, ...updates }))
  }, [])

  /**
   * Core fetch function that handles API calls to retrieve product variants
   */
  const fetchFn = useCallback(
    async (params: {
      productName?: string
      variantName?: string
      queryString?: string
      productId?: string
      forceFetch: boolean
      variantPageInfo?: any
      requestId?: string
    }) => {
      try {
        const {
          productName,
          variantName,
          queryString,
          productId,
          forceFetch,
          variantPageInfo = defaultPageInfo,
          requestId,
        } = params

        if (requestId) {
          activeRequestRef.current = requestId
        }

        // Create a cache key for this request
        const requestCacheKey = JSON.stringify({
          productName,
          variantName,
          queryString,
          productId,
          pageInfo: forceFetch ? null : variantPageInfo,
        })

        // Skip duplicate requests unless forced
        if (!forceFetch && requestCacheKey === lastRequestParamsRef.current) {
          return null
        }

        lastRequestParamsRef.current = requestCacheKey

        const isFetchNextPage = !forceFetch
        const { productsList: newProductsList, pageInfo } = (await fetchProductVariants({
          pageInfo: variantPageInfo,
          isFetchNextPage,
          productName,
          variantName,
          queryString,
          productId,
        })) || { productsList: [], pageInfo: defaultPageInfo }

        // If this is not the active request anymore, ignore the results
        if (requestId && activeRequestRef.current !== requestId) {
          return null
        }

        // Process products in batches to improve performance
        if (newProductsList) {
          // Use memoization technique for combining lists
          const combinedProductsList = productsList?.length
            ? uniqBy([...productsList, ...newProductsList], 'id')
            : newProductsList

          // Process in batches if the list is large
          const batchSize = 10
          const processProductBatch = (startIndex: number) => {
            const endIndex = Math.min(startIndex + batchSize, newProductsList.length)
            for (let i = startIndex; i < endIndex; i++) {
              initializeProductRef.current(newProductsList[i])
            }

            // Process next batch if needed
            if (endIndex < newProductsList.length) {
              setTimeout(() => processProductBatch(endIndex), 0)
            }
          }

          // Start processing the first batch
          processProductBatch(0)

          setProductsList(forceFetch ? newProductsList : combinedProductsList)
          setVariantPageInfo(pageInfo || defaultPageInfo)

          if (!hasProducts && newProductsList.length > 0) {
            setHasProducts(true)
          }
        }

        return newProductsList
      } catch (error) {
        // Check if error is an AbortError
        if (error instanceof DOMException && error.name === 'AbortError') {
          // Don't handle aborted requests as errors
          return null
        }
        console.error('Error fetching variants:', error)
        return null
      }
    },
    [productsList, hasProducts]
  )

  /**
   * Handles fetching more variants for pagination
   */
  const handleFetchMoreVariants = useCallback(
    async (params: { productName?: string; variantName?: string; queryString?: string; productId?: string }) => {
      try {
        const { hasNextPage } = variantPageInfo

        if (hasNextPage && !isFetchingNextPage) {
          // Update loading state in a single operation
          updateLoadingState({ isFetchingNextPage: true })

          // Create a unique request ID for this pagination request
          const paginationRequestId = `pagination-${Date.now()}`

          await fetchFn({
            ...params,
            forceFetch: false,
            variantPageInfo: variantPageInfo,
            requestId: paginationRequestId,
          })
        }
      } catch (error) {
        console.error('Error fetching more variants:', error)
      } finally {
        updateLoadingState({ isFetchingNextPage: false })
      }
    },
    [fetchFn, variantPageInfo, isFetchingNextPage, updateLoadingState]
  )

  /**
   * Main fetch data function that manages loading states and request tracking
   */
  const fetchData = useCallback(
    async (params: {
      productName?: string
      variantName?: string
      queryString?: string
      productId?: string
      forceFetch: boolean
    }) => {
      try {
        // Create a unique request ID
        const requestId = Date.now().toString()

        // Count pending requests
        pendingRequestsCount.current += 1

        // Always show loading state when starting a request
        updateLoadingState({ isLoading: true })

        await fetchFn({
          ...params,
          requestId,
        })

        // Decrease pending requests count
        pendingRequestsCount.current -= 1

        // Only turn off loading state if there are no pending requests
        if (pendingRequestsCount.current === 0) {
          updateLoadingState({ isLoading: false })
        }
      } catch (error) {
        // Decrease pending requests count
        pendingRequestsCount.current -= 1

        if (error instanceof DOMException && error.name === 'AbortError') {
          // If this is an aborted request, only update loading state if no other requests are pending
          if (pendingRequestsCount.current === 0) {
            updateLoadingState({ isLoading: false })
          }
          return
        }

        console.error('Error fetching variants:', error)

        // Only turn off loading state if there are no pending requests
        if (pendingRequestsCount.current === 0) {
          updateLoadingState({ isLoading: false })
        }
      }
    },
    [fetchFn, updateLoadingState]
  )

  // Memoize derived value
  const hasNextPage = useMemo(() => variantPageInfo.hasNextPage, [variantPageInfo])

  return {
    productsList,
    isFetching: isLoading,
    hasNextPage,
    isFetchingNextPage,
    hasProducts,
    setIsLoadingVariants: (isLoading: boolean) => updateLoadingState({ isLoading }),
    fetchData,
    handleFetchMoreVariants,
  }
}

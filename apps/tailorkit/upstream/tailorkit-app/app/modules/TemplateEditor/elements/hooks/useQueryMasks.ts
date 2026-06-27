import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react'
import { authenticatedFetch } from '~/shopify/fns.client'
import { FILE_ACTIONS } from '~/routes/api.files/constants'
import { escapeRegExp } from '~/utils/escapeRegex'
import type { MaskShape } from '~/bootstrap/constants/mask-option-sets'
import { PRE_MADE_MASK_OPTION_SET } from '~/bootstrap/constants/mask-option-sets'

const ITEMS_PER_LOAD = 25
export const FONT_KIND = {
  PRE_MADE_MASK: 'pre-made-masks',
  CUSTOM_MASK: 'custom-masks',
}

/**
 * Fetch Pre-Made Masks
 * @param _controller - AbortController instance to abort the request
 * @returns {Promise<MaskShape[] | null>} - Array of Pre-Made Masks or null if error occurs
 */
export function getAllPreMadeMasks(): MaskShape[] | null {
  try {
    return PRE_MADE_MASK_OPTION_SET
  } catch (e) {
    console.error('Error fetching Pre-Made Masks:', e)

    return null
  }
}

/**
 * Custom hook to fetch and filter Pre-Made Masks
 * @param {Object} props - Hook properties
 * @param {string} props.queryString - Search query to filter masks
 * @param {string[]} props.ratioFilters - Array of ratio values to filter masks
 * @returns {Object} Object containing:
 *  - fetching: boolean indicating if masks are being fetched
 *  - preMadeMasks: array of filtered Pre-Made Masks
 *  - handleFetchNextPage: function to load more masks
 *  - handleFilters: function to apply filters to masks
 */
export const useFetchAllPreMadeMasks = (props: { queryString: string; ratioFilters?: string[] }) => {
  const { queryString, ratioFilters = [] } = props
  const [fetching, setFetching] = useState(false)
  const [preMadeMasks, setPreMadeMasks] = useState<MaskShape[]>([])
  const [hasNextPage, setHasNextPage] = useState(false)

  const allPreMadeMasks: MaskShape[] = useMemo(() => getAllPreMadeMasks() || [], [])

  // Function to fetch all Pre-made Masks data
  const fetchPreMadeMasks = useCallback(async () => {
    // Use functional state update to avoid dependency on fetching state
    setFetching(prevFetching => {
      if (prevFetching) return prevFetching // Early return if already fetching

      // Start fetching in next tick to avoid state update during render
      Promise.resolve().then(async () => {
        try {
          const allPreMadeMasks = await getAllPreMadeMasks()

          if (allPreMadeMasks) {
            setPreMadeMasks(allPreMadeMasks.slice(0, ITEMS_PER_LOAD)) // Initial masks to display
            setHasNextPage(allPreMadeMasks.length > ITEMS_PER_LOAD)
          }
        } catch (error: any) {
          console.error('Failed to fetch Pre-Made Masks:', error)
        } finally {
          setFetching(false)
        }
      })

      return true // Set fetching to true
    })
  }, []) // Remove fetching dependency

  // Apply search and ratio filters based on the query string and ratio filters
  const applyFilters = useCallback(() => {
    let filteredMasks = allPreMadeMasks

    // Apply text search filter
    if (queryString) {
      filteredMasks = filteredMasks.filter(mask => mask.name.toLowerCase().includes(queryString.toLowerCase()))
    }

    // Apply ratio filter
    if (ratioFilters.length > 0) {
      filteredMasks = filteredMasks.filter(mask => ratioFilters.includes(mask.ratio))
    }

    return filteredMasks
  }, [allPreMadeMasks, queryString, ratioFilters])

  // Fetch the next page of filtered masks
  const handleFetchNextPage = useCallback(async () => {
    setFetching(true)
    const masksFiltered = applyFilters()

    // Get the next page of masks to load
    const nextPage = masksFiltered.slice(preMadeMasks.length, preMadeMasks.length + ITEMS_PER_LOAD)
    setPreMadeMasks(prevMasks => [...prevMasks, ...nextPage])
    setHasNextPage(masksFiltered.length > preMadeMasks.length + ITEMS_PER_LOAD)
    setFetching(false)
  }, [applyFilters, preMadeMasks.length])

  // Handle initial filtering or re-filtering when queryString or ratioFilters change
  const handleFilters = useCallback(() => {
    const masksFiltered = applyFilters()
    setPreMadeMasks(masksFiltered.slice(0, ITEMS_PER_LOAD))
    setHasNextPage(masksFiltered.length > ITEMS_PER_LOAD)
  }, [applyFilters])

  // Fetch all masks initially - use ref to track if initial fetch is done
  const initialFetchDone = useRef(false)
  useEffect(() => {
    if (!initialFetchDone.current) {
      fetchPreMadeMasks()
      initialFetchDone.current = true
    }
  }, [fetchPreMadeMasks])

  // Re-filter masks when the query string or ratio filters change
  useEffect(() => {
    handleFilters()
  }, [handleFilters])

  return {
    fetching,
    preMadeMasks,
    hasNextPage,
    handleFetchNextPage,
    handleFilters,
  }
}

/**
 * Query custom masks from Shopify files collection with pagination
 * @param page - Page number to fetch
 * @param query - Search query to filter custom masks
 * @param matchExact - Whether to match exact query
 * @returns {Object} Object containing:
 *  - masks: array of custom masks
 *  - pageInfo: object containing pagination information
 */
export const queryMasks = async (
  page: number = 1,
  query: string,
  preferCache: boolean = false
): Promise<{ maskFiles: any[]; pageInfo: { hasNextPage: boolean } }> => {
  try {
    const formData = new FormData()
    formData.append('queryValue', escapeRegExp(query))
    formData.append('page', page.toString())

    const response = await authenticatedFetch(`/api/files?action=${FILE_ACTIONS.QUERY_MASK_FILES}`, {
      method: 'POST',
      body: formData,
      preferCache,
    })

    if (!response?.success) {
      throw new Error(response?.message || 'Failed to fetch masks')
    }

    return response.data
  } catch (e) {
    console.error('Error fetching masks:', e)
    throw e
  }
}

/**
 * Custom hook to query custom masks from Shopify files collection with pagination
 * @param {string} query - Search query to filter custom masks
 * @returns {Object} Object containing:
 *  - masks: array of custom masks
 *  - loading: boolean indicating if masks are being loaded
 *  - error: error message if fetch fails
 *  - hasNextPage: boolean indicating if there are more masks to load
 *  - fetchMasks: function to fetch masks
 *  - handleFetchNextPage: function to load the next page of masks
 */
export const useQueryMasks = (query: string) => {
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)
  const [masks, setMasks] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(false)

  const fetchMasks = useCallback(
    async (page: number = 1, append: boolean = false, preferCache: boolean = false) => {
      setLoading(true)
      setError(null)

      try {
        const formData = new FormData()
        formData.append('queryValue', escapeRegExp(query))
        formData.append('page', page.toString())

        const data = await queryMasks(page, query, preferCache)

        const newMasks = data.maskFiles || []
        setMasks(prev => (append ? [...prev, ...newMasks] : newMasks))
        setHasNextPage(data.pageInfo?.hasNextPage || false)
        setCurrentPage(page)
      } catch (err: any) {
        setError(err.message || 'An error occurred while fetching masks')
      } finally {
        setLoading(false)
      }
    },
    [query]
  )

  const handleFetchNextPage = useCallback(async () => {
    if (hasNextPage && !loading) {
      await fetchMasks(currentPage + 1, true)
    }
  }, [currentPage, fetchMasks, hasNextPage, loading])

  useLayoutEffect(() => {
    // Query custom masks even if query is empty
    // Always fetch masks, regardless of query value
    fetchMasks(1, false)

    setFetched(true)
  }, [query, fetchMasks])

  return { masks, fetched, loading, error, hasNextPage, fetchMasks, handleFetchNextPage }
}

/**
 * Combined hook to fetch and manage both custom masks and pre-made masks
 * This hook combines the functionality of useQueryMasks and useFetchAllPreMadeMasks
 * to provide a unified interface for accessing both mask types.
 *
 * @param {Object} props - Hook properties
 * @param {string} props.textFieldValue - Search query to filter both custom and pre-made masks
 * @param {string[]} props.ratioFilters - Array of ratio values to filter pre-made masks
 * @returns {Object} Object containing:
 *  - customMasks: array of custom masks from Shopify files
 *  - preMadeMasks: array of pre-made masks
 *  - customMasksLoading: boolean indicating if custom masks are loading
 *  - preMadeMasksLoading: boolean indicating if pre-made masks are loading
 *  - error: error message from custom masks fetch
 *  - customMasksNextPage: boolean indicating if there are more custom masks to load
 *  - fetchCustomMasks: function to fetch custom masks
 *  - handleCustomMasksFetchNextPage: function to load more custom masks
 *  - preMadeMasksNextPage: boolean indicating if there are more pre-made masks to load
 *  - handlePreMadeMasksFetchNextPage: function to load more pre-made masks
 *  - handleFilters: function to apply filters to pre-made masks
 *
 * @example
 * const {
 *   customMasks,
 *   preMadeMasks,
 *   loading,
 *   handleCustomMasksFetchNextPage,
 *   handlePreMadeMasksFetchNextPage
 * } = useMasks({ textFieldValue: "Roboto", ratioFilters: ["1:1", "4:3"] });
 */
export const useMasks = ({ textFieldValue, ratioFilters }: { textFieldValue: string; ratioFilters?: string[] }) => {
  // Custom masks from Shopify files
  const {
    masks: customMasks,
    fetched: customMasksFetched,
    loading: customMasksLoading,
    error: customMasksError,
    hasNextPage: customMasksNextPage,
    fetchMasks: fetchCustomMasks,
    handleFetchNextPage: handleCustomMasksFetchNextPage,
  } = useQueryMasks(textFieldValue)

  // Pre-made masks
  const {
    preMadeMasks,
    fetching: preMadeMasksLoading,
    hasNextPage: preMadeMasksNextPage,
    handleFetchNextPage: handlePreMadeMasksFetchNextPage,
    handleFilters,
  } = useFetchAllPreMadeMasks({
    queryString: textFieldValue,
    ratioFilters,
  })

  return {
    customMasks,
    preMadeMasks,
    customMasksFetched,
    customMasksLoading,
    preMadeMasksLoading,
    error: customMasksError,
    customMasksNextPage,
    fetchCustomMasks,
    handleCustomMasksFetchNextPage,
    preMadeMasksNextPage,
    handlePreMadeMasksFetchNextPage,
    handleFilters,
  }
}

import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, useTransition } from 'react'
import { EFetcherKeys } from '~/constants/fetcher-keys'
import { RemixQueryClientProvider } from '~/libs/remix-query/context-provider'
import objectToQueryString from '~/utils/objectToQueryString'
import { authenticatedFetch } from '~/shopify/fns.client'
import { FILE_ACTIONS } from '~/routes/api.files/constants'
import { escapeRegExp } from '~/utils/escapeRegex'
import type { GoogleFontsFiltersValue } from '~/components/GoogleFontsFilters/GoogleFontsFilters'
import { useGoogleFontsFiltersDataInternal } from '~/components/GoogleFontsFilters/useGoogleFontsFiltersData'
import { applyGoogleFontsFilters } from '~/utils/googleFontsFilters'

const ITEMS_PER_LOAD = 30
export const FONT_KIND = {
  GOOGLE_FONTS: 'google-fonts',
  CUSTOM_FONTS: 'custom-fonts',
}

/**
 * Interface representing a Google Font with its properties
 * @interface IGoogleFont
 * @property {string} family - The font family name
 * @property {string[]} variants - Available font weight and style variations
 * @property {string[]} subsets - Supported character sets/languages
 * @property {Object.<string, string>} files - URLs to font files for each variant
 * @property {string} category - Font category (e.g., 'serif', 'sans-serif', etc.)
 * @property {string} menu - URL to the font preview image
 * @property {string} svgString - SVG representation of the font preview
 */
export interface IGoogleFont {
  family: string
  variants: string[]
  subsets: string[]
  files: {
    [key: string]: string
  }
  category: string
  menu: string
  svgString: string
  /**
   * Optional tags from Google Fonts Developer API when fetched with `capability=FAMILY_TAGS`.
   * @see https://developers.google.com/fonts/docs/developer_api
   */
  tags?: Array<{ name?: string; tag?: string; weight?: number }>
}

let GoogleFontsCache: IGoogleFont[] = []

/**
 * Fetch Google Fonts from the server
 * @param _controller - AbortController instance to abort the request
 * @returns {Promise<IGoogleFont[] | null>} - Array of Google Fonts or null if error occurs
 */
export async function fetchAllGoogleFonts(_controller?: AbortController): Promise<IGoogleFont[] | null> {
  try {
    const controller = _controller || new AbortController()

    if (GoogleFontsCache.length > 0) {
      return GoogleFontsCache
    }

    // Preferred artifact name (correctly indicates gzip), with legacy fallback.
    const tryFetch = async (url: string) =>
      fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal })

    const preferredUrl = `${window.PUBLIC_ENV.BASE_URL}fonts/google-fonts-svg.json.gz`
    const response = await tryFetch(preferredUrl)

    if (!response.ok) {
      console.error('Failed to fetch the fonts')
      return null
    }

    if (response.body) {
      // Decompress the GZIP compressed response body
      const decompressor = new DecompressionStream('gzip')
      const stream = response.body.pipeThrough(decompressor)
      const text = await new Response(stream).text()

      // Now that we have the decompressed data, process it
      const fontsData = JSON.parse(text)
      const allGoogleFonts: IGoogleFont[] = Object.values(fontsData)

      GoogleFontsCache = allGoogleFonts

      return allGoogleFonts
    }

    return null
  } catch (e) {
    console.error('Error fetching Google fonts:', e)

    return null
  }
}

/**
 * Custom hook to fetch and filter Google Fonts
 * @param {Object} props - Hook properties
 * @param {string} props.queryString - Search query to filter fonts
 * @param {Function} props.setFetchNextPage - Callback to update loading state when fetching next page
 * @returns {Object} Object containing:
 *  - fetching: boolean indicating if fonts are being fetched
 *  - googleFonts: array of filtered Google fonts
 *  - handleFetchNextPage: function to load more fonts
 *  - handleFilters: function to apply filters to fonts
 */
export const useFetchAllGoogleFonts = (props: { queryString: string; filters?: GoogleFontsFiltersValue }) => {
  const { queryString, filters } = props
  const [fetching, setFetching] = useState(false)
  const [googleFonts, setGoogleFonts] = useState<IGoogleFont[]>([])
  const [hasNextPage, setHasNextPage] = useState(false)
  const [isPending, startTransition] = useTransition()
  const hasLanguageFilter = Boolean(
    (filters?.subsetKeys && filters.subsetKeys.length > 0) || (filters?.languageIds && filters.languageIds.length > 0)
  )
  const { languages } = useGoogleFontsFiltersDataInternal({ enabled: hasLanguageFilter })

  // Access the RemixQueryClient context
  const { remixQueryClient } = useContext(RemixQueryClientProvider)

  // Create a unique cache key for storing Google Fonts
  const cachedKey = useMemo(() => objectToQueryString({ [EFetcherKeys.ALL_GOOGLE_FONTS]: true }), [])

  // Retrieve cached data if available
  const cachedData = remixQueryClient.getQueryData(cachedKey)
  const allGoogleFonts: IGoogleFont[] = useMemo(() => cachedData?.allGoogleFonts || [], [cachedData])

  const languageSubsetsById = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const lang of languages) {
      map.set(lang.id, lang.subsetKeys)
    }
    return map
  }, [languages])

  const selectedSubsetKeys = useMemo(() => {
    // Direct subset keys take precedence
    if (filters?.subsetKeys && filters.subsetKeys.length > 0) return filters.subsetKeys

    // Derive from selected language IDs
    const languageIds = filters?.languageIds || []
    if (languageIds.length === 0) return null

    // OR semantics across selections: union all subsetKeys.
    const union = new Set<string>()
    for (const id of languageIds) {
      const subsets = languageSubsetsById.get(id) || []
      for (const s of subsets) union.add(s)
    }

    return union.size ? [...union] : null
  }, [languageSubsetsById, filters?.languageIds, filters?.subsetKeys])

  const selectedStyleTagPaths = useMemo(() => {
    const raw = filters?.styleTagPaths || []
    return raw.length ? new Set(raw) : null
  }, [filters?.styleTagPaths])

  // Function to fetch all Google Fonts data
  const fetchGoogleFonts = useCallback(async () => {
    if (fetching || cachedData !== undefined) return // Avoid refetching if data is cached

    setFetching(true)
    const controller = new AbortController()

    try {
      const allGoogleFonts = await fetchAllGoogleFonts()

      if (allGoogleFonts) {
        // Cache the fetched fonts data
        remixQueryClient.setQueryData(cachedKey, { allGoogleFonts })

        // Update state only if data was fetched (not from cache)
        if (!cachedData) {
          setGoogleFonts(allGoogleFonts.slice(0, ITEMS_PER_LOAD)) // Initial fonts to display
          setHasNextPage(allGoogleFonts.length > ITEMS_PER_LOAD)
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Failed to fetch Google fonts:', error)
      }
    } finally {
      setFetching(false)
    }

    return () => controller.abort() // Cleanup fetch request if component unmounts
  }, [fetching, cachedData, cachedKey, remixQueryClient])

  // Apply search filters based on the query string
  const applyFilters = useCallback(() => {
    return applyGoogleFontsFilters(allGoogleFonts, {
      query: queryString,
      styleTagPaths: selectedStyleTagPaths ? Array.from(selectedStyleTagPaths) : undefined,
      subsetKeys: selectedSubsetKeys || undefined,
    })
  }, [allGoogleFonts, queryString, selectedSubsetKeys, selectedStyleTagPaths])

  // Fetch the next page of filtered fonts
  const handleFetchNextPage = useCallback(async () => {
    setFetching(true)
    const fontsFiltered = applyFilters()

    // Get the next page of fonts to load
    const nextPage = fontsFiltered.slice(googleFonts.length, googleFonts.length + ITEMS_PER_LOAD)
    setGoogleFonts(prevFonts => [...prevFonts, ...nextPage])
    setHasNextPage(fontsFiltered.length > googleFonts.length + ITEMS_PER_LOAD)
    setFetching(false)
  }, [applyFilters, googleFonts.length])

  // Total count of filtered fonts (before pagination)
  const [totalFilteredFonts, setTotalFilteredFonts] = useState(0)

  // Handle initial filtering or re-filtering when queryString changes
  // Use startTransition to defer heavy filtering and avoid blocking checkbox UI updates
  const handleFilters = useCallback(() => {
    startTransition(() => {
      const fontsFiltered = applyFilters()
      setGoogleFonts(fontsFiltered.slice(0, ITEMS_PER_LOAD))
      setHasNextPage(fontsFiltered.length > ITEMS_PER_LOAD)
      setTotalFilteredFonts(fontsFiltered.length)
    })
  }, [applyFilters, startTransition])

  // Fetch all fonts initially
  useEffect(() => {
    fetchGoogleFonts()
  }, [fetchGoogleFonts])

  // Re-filter fonts when the query string changes
  useEffect(() => {
    handleFilters()
  }, [handleFilters])

  return {
    fetching,
    googleFonts,
    hasNextPage,
    totalFilteredFonts,
    handleFetchNextPage,
    handleFilters,
    isFiltering: isPending,
  }
}

/**
 * Query custom fonts from Shopify files collection with pagination
 * @param page - Page number to fetch
 * @param query - Search query to filter custom fonts
 * @param matchExact - Whether to match exact query
 * @returns {Object} Object containing:
 *  - fonts: array of custom fonts
 *  - pageInfo: object containing pagination information
 */
export const queryFonts = async (
  page: number = 1,
  query: string,
  preferCache: boolean = false
): Promise<{ fontFiles: any[]; pageInfo: { hasNextPage: boolean } }> => {
  try {
    const formData = new FormData()
    formData.append('queryValue', escapeRegExp(query))
    formData.append('page', page.toString())

    const response = await authenticatedFetch(`/api/files?action=${FILE_ACTIONS.QUERY_FONT_FILES}`, {
      method: 'POST',
      body: formData,
      preferCache,
    })

    if (!response?.success) {
      throw new Error(response?.message || 'Failed to fetch fonts')
    }

    return response.data
  } catch (e) {
    console.error('Error fetching fonts:', e)
    throw e
  }
}

/**
 * Custom hook to query custom fonts from Shopify files collection with pagination
 * @param {string} query - Search query to filter custom fonts
 * @returns {Object} Object containing:
 *  - fonts: array of custom fonts
 *  - loading: boolean indicating if fonts are being loaded
 *  - error: error message if fetch fails
 *  - hasNextPage: boolean indicating if there are more fonts to load
 *  - fetchFonts: function to fetch fonts
 *  - handleFetchNextPage: function to load the next page of fonts
 */
export const useQueryFonts = (query: string) => {
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)
  const [fonts, setFonts] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(false)

  const fetchFonts = useCallback(
    async (page: number = 1, append: boolean = false, preferCache: boolean = false) => {
      setLoading(true)
      setError(null)

      try {
        const formData = new FormData()
        formData.append('queryValue', escapeRegExp(query))
        formData.append('page', page.toString())

        const data = await queryFonts(page, query, preferCache)

        const newFonts = data.fontFiles || []
        setFonts(prev => (append ? [...prev, ...newFonts] : newFonts))
        setHasNextPage(data.pageInfo?.hasNextPage || false)
        setCurrentPage(page)
      } catch (err: any) {
        setError(err.message || 'An error occurred while fetching fonts')
      } finally {
        setLoading(false)
      }
    },
    [query]
  )

  const handleFetchNextPage = useCallback(async () => {
    if (hasNextPage && !loading) {
      await fetchFonts(currentPage + 1, true)
    }
  }, [currentPage, fetchFonts, hasNextPage, loading])

  useLayoutEffect(() => {
    // Query custom fonts even if query is empty
    // Always fetch fonts, regardless of query value
    fetchFonts(1, false)

    setFetched(true)
  }, [query, fetchFonts])

  return { fonts, fetched, loading, error, hasNextPage, fetchFonts, handleFetchNextPage }
}

/**
 * Combined hook to fetch and manage both custom fonts and Google fonts
 * This hook combines the functionality of useQueryFonts and useFetchAllGoogleFonts
 * to provide a unified interface for accessing both font types.
 *
 * @param {string} query - Search query to filter both custom and Google fonts
 * @returns {Object} Object containing:
 *  - customFonts: array of custom fonts from Shopify files
 *  - googleFonts: array of Google fonts
 *  - customFontsLoading: boolean indicating if custom fonts are loading
 *  - googleFontsLoading: boolean indicating if Google fonts are loading
 *  - error: error message from custom fonts fetch
 *  - customFontsNextPage: boolean indicating if there are more custom fonts to load
 *  - fetchCustomFonts: function to fetch custom fonts
 *  - handleCustomFontsFetchNextPage: function to load more custom fonts
 *  - googleFontsNextPage: boolean indicating if there are more Google fonts to load
 *  - handleGoogleFontsFetchNextPage: function to load more Google fonts
 *  - handleFilters: function to apply filters to Google fonts
 *
 * @example
 * const {
 *   customFonts,
 *   googleFonts,
 *   loading,
 *   handleCustomFontsFetchNextPage,
 *   handleGoogleFontsFetchNextPage
 * } = useFonts("Roboto");
 */
export const useFonts = (query: string, options?: { googleFontsFilters?: GoogleFontsFiltersValue }) => {
  // Custom fonts from Shopify files
  const {
    fonts: customFonts,
    fetched: customFontsFetched,
    loading: customFontsLoading,
    error: customFontsError,
    hasNextPage: customFontsNextPage,
    fetchFonts: fetchCustomFonts,
    handleFetchNextPage: handleCustomFontsFetchNextPage,
  } = useQueryFonts(query)

  // Google fonts
  const {
    googleFonts,
    fetching: googleFontsLoading,
    hasNextPage: googleFontsNextPage,
    totalFilteredFonts: totalFilteredGoogleFonts,
    handleFetchNextPage: handleGoogleFontsFetchNextPage,
    handleFilters,
    isFiltering: isFilteringGoogleFonts,
  } = useFetchAllGoogleFonts({
    queryString: query,
    filters: options?.googleFontsFilters,
  })

  return {
    customFonts,
    googleFonts,
    customFontsFetched,
    customFontsLoading,
    googleFontsLoading,
    error: customFontsError,
    customFontsNextPage,
    fetchCustomFonts,
    handleCustomFontsFetchNextPage,
    googleFontsNextPage,
    totalFilteredGoogleFonts,
    handleGoogleFontsFetchNextPage,
    handleFilters,
    isFilteringGoogleFonts,
  }
}

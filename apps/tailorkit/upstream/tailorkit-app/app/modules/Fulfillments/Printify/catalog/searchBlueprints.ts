import type { FetchDataFunc } from '..'

export interface SearchBlueprintResult {
  blueprintId: number
  name: string
  brandName: string
  tags: string[]
  hiddenTags?: string[]
  managed_tags?: string[]
  images?: Array<{
    url?: string
    src?: string
  }>
  minPrice?: number
  minPriceSubscription?: number
  printProviderName?: string
}

export interface SearchBlueprintsResponse {
  current_page: number | null
  last_page: number | null
  from: number
  to: number
  total: number
  per_page: number | null
  data: SearchBlueprintResult[]
}

export interface SearchBlueprintsFilters {
  category?: string[]
  tags?: string[]
}

export interface SearchBlueprintsOptions {
  searchKey?: string
  limit?: number
  offset?: number
  filters?: SearchBlueprintsFilters
}

export type SearchBlueprintsFunc = (options?: SearchBlueprintsOptions) => Promise<SearchBlueprintResult[]>

/**
 * Builds URL parameters for filters
 * @param {SearchBlueprintsFilters} filters - Filter options
 * @param {URLSearchParams} params - URL parameters object
 */
const appendFilters = (filters: SearchBlueprintsFilters, params: URLSearchParams): void => {
  if (!filters) return

  // Append categories efficiently using type-safe check
  if (Array.isArray(filters.category) && filters.category.length > 0) {
    filters.category.forEach(cat => {
      if (typeof cat === 'string' && cat.trim()) {
        params.append('filters[category][]', cat.trim())
      }
    })
  }

  // Append tags efficiently using type-safe check
  if (Array.isArray(filters.tags) && filters.tags.length > 0) {
    filters.tags.forEach(tag => {
      if (typeof tag === 'string' && tag.trim()) {
        params.append('filters[tags][]', tag.trim())
      }
    })
  }
}

/**
 * Search blueprints in the Printify catalog
 *
 * @param {SearchBlueprintsOptions} options - Search options
 * @returns {Promise<SearchBlueprintResult[]>}
 *
 * @example
 * // Search for phone cases
 * const results = await printify.catalog.searchBlueprints({ searchKey: 'phone case', limit: 5 });
 *
 * // Search with category filter
 * const results = await printify.catalog.searchBlueprints({
 *   searchKey: 'shirt',
 *   limit: 10,
 *   filters: { category: ['apparel'] }
 * });
 */
const searchBlueprints
  = (fetchData: FetchDataFunc): SearchBlueprintsFunc =>
  async (options: SearchBlueprintsOptions = {}): Promise<SearchBlueprintResult[]> => {
    const params = new URLSearchParams()

    if (options.searchKey) {
      params.append('searchKey', options.searchKey)
    }

    if (options.limit) {
      params.append('limit', options.limit.toString())
    }

    if (options.offset) {
      params.append('offset', options.offset.toString())
    }

    // Append filters using the dedicated function
    if (options.filters) {
      appendFilters(options.filters, params)
    }

    // Note: This uses the product-catalog-service which is a different service than the main API
    // We'll need to override the base URL for this specific call
    const searchUrl = `https://printify.com/product-catalog-service/api/v1/blueprints/search?${params.toString()}`

    try {
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`)
      }

      const data: SearchBlueprintsResponse = await response.json()
      return data.data || []
    } catch (error) {
      console.error('Printify search error:', error)
      return []
    }
  }

export default searchBlueprints

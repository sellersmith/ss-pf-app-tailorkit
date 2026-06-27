/* eslint-disable max-len */
import Printify from '~/modules/Fulfillments/Printify'
import type { SearchBlueprintResult } from '~/modules/Fulfillments/Printify/catalog/searchBlueprints'
import type { ChatInvoker } from './ProductIntentAnalyzer'

// Configuration constants
const SEARCH_CONFIG = {
  MAX_PARALLEL_SEARCHES: 3,
  SEARCH_TIMEOUT_MS: 5000,
  CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes
  MAX_RETRIES: 3,
  BASE_RETRY_DELAY_MS: 1000,
  PRINTIFY_IMAGE_BASE_URL: 'https://images.printify.com/api/catalog',
  FALLBACK_SEARCH_TERMS: ['t-shirt', 'mug', 'hoodie', 'poster', 'canvas', 'sticker'] as const,
} as const

type PrintifyProduct = SearchBlueprintResult

interface SearchResult {
  product: PrintifyProduct
  searchTerm: string
  priority: number
}

export interface ShopProductAnalysis {
  productTypes: string[]
  categories: string[]
  primaryFocus: string
  confidence: number
}

/**
 * Service responsible for all Printify-related operations
 */
export class PrintifyService {
  private printifySDK: Printify | null = null
  private searchCache = new Map<string, PrintifyProduct[]>()
  private cacheTimestamps = new Map<string, number>()

  constructor(private chatInvoker: ChatInvoker) {
    this.initializePrintifySDK()
  }

  /**
   * Initialize the Printify SDK
   */
  private initializePrintifySDK(): void {
    try {
      this.printifySDK = new Printify({
        shopId: 'search',
        accessToken: 'public',
        enableLogging: false,
      })
    } catch (error) {
      console.error('Failed to initialize Printify SDK:', error)
    }
  }

  /**
   * Search Printify products intelligently based on query and shop context
   */
  async searchPrintifyProducts(userQuery: string, shopDescription: string): Promise<any> {
    try {
      // Analyze the shop description to extract product types
      const shopAnalysis = await this.analyzeShopDescription(shopDescription)

      // Build search terms priority list with deduplication
      const searchTermsSet = new Set<string>()

      // 1. User query has highest priority
      if (userQuery && userQuery.trim()) {
        searchTermsSet.add(userQuery.trim().toLowerCase())
      }

      // 2. Specific product types from shop description
      shopAnalysis.productTypes.forEach(type => searchTermsSet.add(type.toLowerCase()))

      // 3. Categories from shop description
      shopAnalysis.categories.forEach(category => searchTermsSet.add(category.toLowerCase()))

      // 4. Common print-on-demand products as fallbacks
      SEARCH_CONFIG.FALLBACK_SEARCH_TERMS.forEach(fallback => searchTermsSet.add(fallback))

      const searchTerms = Array.from(searchTermsSet)

      // Parallel search for better performance - limit to avoid overwhelming API
      const topTerms = searchTerms.slice(0, SEARCH_CONFIG.MAX_PARALLEL_SEARCHES)
      const searchPromises = topTerms.map(term => this.searchSingleTerm(term))

      try {
        const results = await Promise.allSettled(searchPromises)

        // Collect all successful results
        const allProducts: SearchResult[] = []

        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value.length > 0) {
            // Add priority scoring based on search term position
            const priority = index === 0 ? 10 : index === 1 ? 8 : 5 // User query gets highest priority
            result.value.forEach(product => {
              allProducts.push({
                product,
                searchTerm: topTerms[index],
                priority,
              })
            })
          }
        })

        if (allProducts.length > 0) {
          // Sort by priority and take the best result
          allProducts.sort((a, b) => b.priority - a.priority)
          const bestProduct = allProducts[0]

          return this.formatPrintifyProduct(bestProduct.product)
        }
      } catch (error) {
        console.error('Parallel search failed, falling back to sequential:', error)
        // Fallback to sequential search if parallel fails
        return await this.searchSequentially(topTerms)
      }

      console.log('No Printify products found')
      return null
    } catch (error) {
      console.error('Error searching Printify products:', error)
      return null
    }
  }

  /**
   * Analyze shop description to extract product types
   */
  private async analyzeShopDescription(shopDescription: string): Promise<ShopProductAnalysis> {
    if (!shopDescription || shopDescription.trim().length === 0) {
      return {
        productTypes: [],
        categories: [],
        primaryFocus: '',
        confidence: 0,
      }
    }

    const analysisPrompt = `Analyze this shop description to extract product types: "${shopDescription}"

TASK: Extract potential product types and categories that would be suitable for print-on-demand/personalization.

OUTPUT FORMAT (JSON):
{
  "productTypes": ["specific product types"],
  "categories": ["broader categories"],
  "primaryFocus": "main product focus",
  "confidence": 0.0-1.0
}

RULES:
- productTypes: specific items like "t-shirt", "mug", "phone case", "poster", "hoodie"
- categories: broader categories like "apparel", "accessories", "home decor", "stationery"
- primaryFocus: the main business focus in 2-3 words
- confidence: how clear the description is about products (0.8+ for clear descriptions)

EXAMPLES:
"Custom phone cases for iPhone and Android" → {"productTypes": ["phone case"], "categories": ["accessories"], "primaryFocus": "phone accessories", "confidence": 0.95}
"Personalized gifts and home decor" → {"productTypes": ["poster", "mug"], "categories": ["home decor", "gifts"], "primaryFocus": "personalized gifts", "confidence": 0.7}
"" → {"productTypes": [], "categories": [], "primaryFocus": "", "confidence": 0}

Return only valid JSON.`

    try {
      const response = await this.chatInvoker.invokeChat(this.chatInvoker.buildMessages(analysisPrompt))
      const parsed = JSON.parse(response.trim())

      return {
        productTypes: Array.isArray(parsed.productTypes) ? parsed.productTypes : [],
        categories: Array.isArray(parsed.categories) ? parsed.categories : [],
        primaryFocus: String(parsed.primaryFocus || ''),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0))),
      }
    } catch (error) {
      console.error('Shop description analysis failed:', error)
      return {
        productTypes: [],
        categories: [],
        primaryFocus: '',
        confidence: 0,
      }
    }
  }

  /**
   * Search for a single term with timeout
   */
  private async searchSingleTerm(searchTerm: string): Promise<PrintifyProduct[]> {
    const timeoutPromise = new Promise<PrintifyProduct[]>((_, reject) => {
      setTimeout(() => reject(new Error('Search timeout')), SEARCH_CONFIG.SEARCH_TIMEOUT_MS)
    })

    const searchPromise = this.callPrintifyAPI(searchTerm)

    try {
      return await Promise.race([searchPromise, timeoutPromise])
    } catch (error) {
      console.warn(`Search failed for term "${searchTerm}":`, error)
      return []
    }
  }

  /**
   * Fallback sequential search method
   */
  private async searchSequentially(searchTerms: string[]): Promise<any> {
    for (const searchTerm of searchTerms) {
      try {
        const printifyResults = await this.callPrintifyAPI(searchTerm)

        if (printifyResults && printifyResults.length > 0) {
          const product = printifyResults[0]
          return this.formatPrintifyProduct(product)
        }
      } catch (error) {
        console.warn(`Sequential search failed for term "${searchTerm}":`, error)
        continue
      }
    }
    return null
  }

  /**
   * Search Printify using SDK with retry logic
   */
  private async callPrintifyAPI(searchQuery: string): Promise<PrintifyProduct[]> {
    try {
      // Check cache first
      const cacheKey = `printify_search_${searchQuery}`
      const cachedResults = this.getCacheEntry(cacheKey)
      if (cachedResults) {
        return cachedResults
      }

      if (!this.printifySDK) {
        console.error('Printify SDK not initialized.')
        return []
      }

      const results = await this.retryWithBackoff(async () => {
        return this.printifySDK!.catalog.searchBlueprints({
          searchKey: searchQuery,
          limit: 5,
        })
      }, SEARCH_CONFIG.MAX_RETRIES)

      // Cache the results
      this.setCacheEntry(cacheKey, results)
      return results
    } catch (error) {
      console.error('Printify SDK search failed:', error)
      return []
    }
  }

  /**
   * Helper method for exponential backoff retry
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    baseDelay: number = SEARCH_CONFIG.BASE_RETRY_DELAY_MS
  ): Promise<T> {
    let lastError: Error | unknown

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error

        if (attempt === maxRetries) {
          throw error // Final attempt failed
        }

        // Calculate exponential backoff delay
        const delay = baseDelay * Math.pow(2, attempt)
        console.warn(`API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`)

        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError
  }

  /**
   * Format Printify product to match Shopify format
   */
  private formatPrintifyProduct(printifyProduct: PrintifyProduct): any {
    let imageUrl = '/assets/product-placeholder.jpg'

    if (printifyProduct.images?.[0]) {
      const image = printifyProduct.images[0]

      // Try url first
      if (image.url && image.url.startsWith('https://')) {
        imageUrl = image.url
      }
      // Try src, check if it's already a full URL or just an ID
      else if (image.src) {
        if (image.src.startsWith('https://')) {
          imageUrl = image.src
        } else {
          // It's just an ID, construct the full URL using configuration
          imageUrl = `${SEARCH_CONFIG.PRINTIFY_IMAGE_BASE_URL}/${image.src}.jpg`
        }
      }
    }

    // Calculate price from minPrice (convert from cents to dollars)
    const priceInDollars = printifyProduct.minPrice ? (printifyProduct.minPrice / 100).toFixed(2) : '25.00'

    return {
      printifyProduct,
      id: printifyProduct.blueprintId,
      title: printifyProduct.name,
      description: `${printifyProduct.name} - Premium print-on-demand product from ${printifyProduct.brandName}`,
      source: 'printify',
      featuredImage: {
        url: imageUrl,
      },
      priceRange: {
        minVariantPrice: {
          amount: priceInDollars,
          currencyCode: 'USD',
        },
      },
      variants: {
        edges: [
          {
            node: {
              id: printifyProduct.blueprintId,
              title: 'Default Title',
              price: priceInDollars,
            },
          },
        ],
      },
      brand: printifyProduct.brandName,
      tags: printifyProduct.tags || [],
      printProviderName: printifyProduct.printProviderName,
    }
  }

  /**
   * Cache management methods
   */
  private isCacheValid(key: string): boolean {
    const timestamp = this.cacheTimestamps.get(key)
    if (!timestamp) return false
    return Date.now() - timestamp < SEARCH_CONFIG.CACHE_TTL_MS
  }

  private setCacheEntry(key: string, value: PrintifyProduct[]): void {
    this.searchCache.set(key, value)
    this.cacheTimestamps.set(key, Date.now())
  }

  private getCacheEntry(key: string): PrintifyProduct[] | null {
    if (this.isCacheValid(key)) {
      return this.searchCache.get(key) || null
    }
    // Clean up expired cache entries
    this.searchCache.delete(key)
    this.cacheTimestamps.delete(key)
    return null
  }
}

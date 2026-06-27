import { randomUUID, createHash } from 'crypto'
import supabaseClient from '~/utils/supabase-client.server'
import { generateEmbedding } from '~/utils/openai-client.server'
import { loadTemplatesIndex } from '~/services/cliparts.server'
import Mockup from '~/models/Mockup.server'
import TranslationService from '~/libs/translation/translate.service'
import {
  FONT_COMBINATIONS_CATEGORY,
  DEFAULT_MATCH_OPTIONS,
  DYNAMIC_FILTER_OPTIONS,
  FINAL_SUGGESTIONS_COUNT,
} from './constants'
import type { VariantDataSignals } from './queryBuilder.server'
import { buildSuggestionQueryText } from './queryBuilder.server'
import { mapFontCombinationDocsToTemplateIds } from './mapping.server'
import { BASE_CLICK_COUNT } from '../api.cliparts/constants'
import ShopAssetAnalyticsModel from '~/models/ShopAssetAnalytics.server'
import { getExcludedShopDomains } from '../api.cliparts/helpers.server'

// Lazy-initialized translation service
let translationService: TranslationService | null = null

function getTranslationService(): TranslationService | null {
  if (translationService) return translationService
  try {
    translationService = new TranslationService()
    return translationService
  } catch {
    // GOOGLE_AI_API_KEY not set - translation disabled
    return null
  }
}

// ============================================================================
// Types
// ============================================================================

type VariantData = VariantDataSignals

interface FontCombinationSuggestions {
  clipartIds: string[]
  generatedAt: number
  productId: string
  variantHash: string
  reasoning?: string
}

interface FontCombinationDocument {
  id: string
  clipart: string
  target_audience: string
  context: string
  user_style: string
  category: string
  product_type: string | null
  similarity: number
}

export interface ClipartDetail {
  _id: string
  name: string
  thumbnailUrl: string
  type: string
  clickCount: number
}

export type ConfidenceLevel = 'high' | 'low' | 'none'

export interface GenerateSuggestionsResult {
  clipartIds: string[]
  cliparts: ClipartDetail[]
  reasoning: string
  confidence: ConfidenceLevel
}

// ============================================================================
// Cache Key Generation
// ============================================================================

/**
 * Generate cache key from `mockupId` + `productId` + `productTitle` + `variantTitles`.
 *
 * Note: this key is stored under the *mockup document* (`Mockup.metadata.fontCombinationSuggestions`),
 * so it effectively represents "one cache entry per product (with title + variants) for a given mockup".
 *
 * We also store `variantHash` alongside the entry so callers can invalidate the cache when the
 * integrated variant set changes.
 *
 * Uses SHA-256 hashing to prevent cache key collisions from special characters.
 *
 * @param mockupId - Mockup ID
 * @param productId - Product ID
 * @param productTitle - Product title (hashed to avoid collisions)
 * @param variantTitles - Array of variant titles (e.g., ["Gold", "Silver"])
 * @returns Cache key string in format: `mockupId:productId:titleHash:variantHash`
 */
export function generateCacheKey(
  mockupId: string,
  productId: string,
  productTitle: string,
  variantTitles: string[] = []
): string {
  // Hash product title to prevent collisions from special characters
  // Example: "Test:Product" and "Test_Product" would have different hashes
  const titleHash = createHash('sha256')
    .update((productTitle || '').trim())
    .digest('hex')
    .slice(0, 16) // Use first 16 chars for shorter keys

  // Create a stable hash of variantTitles
  // Sort to ensure consistent key regardless of variant order
  const variantKey
    = variantTitles.length > 0
      ? createHash('sha256').update(variantTitles.sort().join('|')).digest('hex').slice(0, 16)
      : 'default'

  return `${mockupId}:${productId}:${titleHash}:${variantKey}`
}

// ============================================================================
// Cache Validation
// ============================================================================

/**
 * Validate if cached suggestions are still valid.
 *
 * Cache is keyed by (mockupId + productId + productTitle) and can be validated by:
 * - `productId` (webhook invalidation / product change)
 * - `variantHash` (integrated variant set change)
 *
 * IMPORTANT: validation is *conditional* — if `productId` / `variantHash` are not provided,
 * this function cannot validate those dimensions and will only validate "non-empty cache".
 *
 * @param cached - Cached suggestions from database
 * @param productId - Current productId to validate against
 * @param variantHash - Current integrated variant hash to validate against
 * @returns true if cache is valid and can be used
 */
export function isCacheValid(
  cached: FontCombinationSuggestions | undefined,
  productId?: string,
  variantHash?: string
): boolean {
  // No cache or empty cache → invalid
  if (!cached?.clipartIds?.length) return false

  // If productId is provided, validate it matches.
  // NOTE: Old cache entries may miss `productId`; when a `productId` is provided, such entries
  // must be treated as invalid.
  if (productId && cached.productId !== productId) {
    return false
  }

  // If variantHash is provided, validate it matches to avoid using stale cache after integrated
  // variants change.
  // NOTE: Old cache entries may miss `variantHash`; when a `variantHash` is provided, such entries
  // must be treated as invalid.
  if (variantHash && cached.variantHash !== variantHash) {
    return false
  }

  return true
}

// ============================================================================
// Query Building (multilingual-safe)
// ============================================================================

// ============================================================================
// Clipart Mapping
// ============================================================================

export async function getClipartDetailsFromIds(clipartIds: string[]): Promise<ClipartDetail[]> {
  const { index } = loadTemplatesIndex()
  if (!Array.isArray(index) || !index.length) return []

  const idMap = new Map(index.map(item => [String(item._id || item.id), item]))

  // Get basic details first
  const details = clipartIds
    .map(id => idMap.get(id))
    .filter(Boolean)
    .map(item => ({
      _id: String(item._id || item.id),
      name: item.name || '',
      thumbnailUrl: item.thumbnailUrl || item.previewUrl || '',
      type: item.type || 'clipart',
      clickCount: 100, // Will be updated with actual counts
    }))

  // Fetch click counts for all cliparts
  if (details.length > 0) {
    try {
      const clipartIds = details.map(item => item._id)

      // Get excluded shop domains (shops with internal email domains)
      const excludedShopDomains = await getExcludedShopDomains()

      // Aggregate clicks from ShopAssetAnalytics (sum across all shops)
      // EXCLUDE shops with emails ending with EMAIL_DOMAINS_TO_EXCLUDE_CLICK_COUNT
      const aggregates = await ShopAssetAnalyticsModel.aggregate([
        {
          $match: {
            assetId: { $in: clipartIds },
            assetType: 'clipart',
            shopDomain: { $nin: excludedShopDomains }, // Exclude internal shops
          },
        },
        {
          $group: {
            _id: '$assetId',
            totalClicks: { $sum: '$totalClicks' },
          },
        },
      ])

      // Convert to plain object with formula: 100 + actual clicks
      const clickCounts: Record<string, number> = {}

      // Fill in aggregated counts
      aggregates.forEach((agg: any) => {
        clickCounts[agg._id] = BASE_CLICK_COUNT + agg.totalClicks
      })

      // Ensure all requested IDs have a value (default to 100)
      clipartIds.forEach(id => {
        if (!clickCounts[id]) {
          clickCounts[id] = BASE_CLICK_COUNT
        }
      })

      // Merge click counts
      details.forEach(item => {
        item.clickCount = clickCounts[item._id] || BASE_CLICK_COUNT
      })
    } catch (error) {
      console.error('[getClipartDetailsFromIds] Failed to fetch click counts:', error)
      // Keep default 100 value
    }
  }

  return details
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Quick heuristic: treat ASCII-only text as "likely English".
 * We skip translation in that case to save ~1-2s latency.
 *
 * IMPORTANT: If ANY non-ASCII characters exist (Vietnamese, CJK, etc.),
 * we must translate to ensure embeddings understand the content correctly.
 */
function isLikelyEnglish(text: string): boolean {
  if (!text) return true
  // Check if there are ANY non-ASCII characters
  // eslint-disable-next-line no-control-regex
  const hasNonAscii = /[^\u0000-\u007F]/.test(text)
  // If there are any non-ASCII characters, need translation
  return !hasNonAscii
}

export async function generateFontCombinationSuggestions(args: {
  variantData: VariantData
  shopDomain: string
  shopData?: { _id?: string } | null
}): Promise<GenerateSuggestionsResult> {
  const { variantData, shopDomain, shopData } = args

  // Unique request ID for tracking this specific request through logs
  const requestId = randomUUID().slice(0, 8)

  const emptyResult = (reasoning: string): GenerateSuggestionsResult => ({
    clipartIds: [],
    cliparts: [],
    reasoning,
    confidence: 'none',
  })

  try {
    // 1. Build query from raw product data (NO inference, NO filtering)
    const rawQuery = buildSuggestionQueryText(variantData)
    if (!rawQuery.trim()) return emptyResult('No product information available')

    // 2. Translate query to English ONLY if non-English detected
    // Skip translation for English text to save ~1-2s latency
    let queryForEmbedding = rawQuery
    if (!isLikelyEnglish(rawQuery)) {
      const translator = getTranslationService()
      if (translator) {
        try {
          const translatedQuery = await translator.translateToEnglish(rawQuery)
          if (translatedQuery && translatedQuery !== rawQuery) {
            queryForEmbedding = translatedQuery
          }
        } catch (translationError) {
          // Translation failed, use raw query
        }
      }
    }

    // 3. Generate embedding & search
    const embedding = await generateEmbedding(queryForEmbedding, shopDomain, shopData?._id)

    // Pure semantic search - let RAG do the matching
    // RAG data has rich Context (e.g., "GOLD material only", "Perfect for jewelry")
    // Embeddings will naturally match based on semantic similarity
    const { data: docs, error } = await supabaseClient.rpc('match_clipart_documents_by_category', {
      query_embedding: embedding,
      match_threshold: DEFAULT_MATCH_OPTIONS.match_threshold,
      match_count: DEFAULT_MATCH_OPTIONS.match_count,
      target_category: FONT_COMBINATIONS_CATEGORY,
    })

    if (error) {
      console.error(`[FONT_SUGGESTIONS][${requestId}] RPC error:`, error)
      return emptyResult('Search error')
    }
    if (!docs?.length) {
      return emptyResult('No matches found')
    }

    // Results already sorted by similarity DESC in RPC
    const typedDocs = docs as FontCombinationDocument[]

    // 4. Determine confidence based on similarity
    const topScore = typedDocs[0].similarity
    const { high_confidence_threshold, low_confidence_threshold, best_effort_count } = DYNAMIC_FILTER_OPTIONS

    let confidence: ConfidenceLevel
    let maxResults: number

    if (topScore >= high_confidence_threshold) {
      confidence = 'high'
      maxResults = FINAL_SUGGESTIONS_COUNT
    } else if (topScore >= low_confidence_threshold) {
      confidence = 'low'
      maxResults = best_effort_count
    } else {
      return emptyResult(`Low score (${(topScore * 100).toFixed(1)}%)`)
    }

    // 5. Candidate selection based on similarity
    const candidates
      = confidence === 'low'
        ? typedDocs.slice(0, Math.max(DYNAMIC_FILTER_OPTIONS.best_effort_count, 12))
        : typedDocs.filter(d => d.similarity >= topScore * DYNAMIC_FILTER_OPTIONS.relative_threshold_ratio)

    // 6. Map docs -> template IDs (name-based)
    const allMappedIds = mapFontCombinationDocsToTemplateIds(candidates)
    const ids = allMappedIds.slice(0, maxResults)

    if (!ids.length) {
      return emptyResult(`No matching cliparts (found ${candidates.length} candidates but mapping failed)`)
    }

    // 7. Build reasoning with names and similarity scores
    const topScores = candidates
      .slice(0, ids.length)
      .map((d, i) => `#${i + 1} "${d.clipart}": ${(d.similarity * 100).toFixed(1)}%`)
      .join(', ')

    return {
      clipartIds: ids,
      cliparts: await getClipartDetailsFromIds(ids),
      reasoning: topScores,
      confidence,
    }
  } catch (err) {
    console.error(`[FONT_SUGGESTIONS][${requestId}] Error:`, err)
    return emptyResult('An error occurred')
  }
}

// ============================================================================
// Cache Functions
// ============================================================================

// Define proper type for Mockup metadata structure
interface MockupMetadata {
  fontCombinationSuggestions?: Map<string, FontCombinationSuggestions> | Record<string, FontCombinationSuggestions>
}

interface MockupDocument {
  metadata?: MockupMetadata
}

export async function getCachedSuggestions(
  mockupId: string,
  productId: string,
  productTitle: string,
  variantTitles: string[] = []
): Promise<FontCombinationSuggestions | null> {
  try {
    const cacheKey = generateCacheKey(mockupId, productId, productTitle, variantTitles)
    const mockup = (await Mockup.findOne({ _id: mockupId }, { metadata: 1 }).lean()) as MockupDocument | null

    // Mongoose Map is stored as object when lean()
    const mapData = mockup?.metadata?.fontCombinationSuggestions
    if (!mapData) {
      return null
    }

    // Safely access the cache value based on the data type
    let mapValue: FontCombinationSuggestions | undefined
    if (mapData instanceof Map) {
      mapValue = mapData.get(cacheKey)
    } else {
      // Type guard: Record<string, FontCombinationSuggestions>
      mapValue = (mapData as Record<string, FontCombinationSuggestions>)[cacheKey]
    }

    if (!mapValue) {
      return null
    }

    return {
      clipartIds: mapValue.clipartIds || [],
      generatedAt: mapValue.generatedAt || 0,
      productId: mapValue.productId || '',
      variantHash: mapValue.variantHash || '',
      reasoning: mapValue.reasoning, // Include reasoning if available
    }
  } catch (err) {
    console.error('[FONT_SUGGESTIONS] Cache read error:', err)
    return null
  }
}

export async function updateMockupSuggestions(
  mockupId: string,
  suggestions: FontCombinationSuggestions,
  productId: string,
  productTitle: string,
  variantTitles: string[] = []
): Promise<void> {
  try {
    // Skip persisting empty suggestions.
    // An empty array is a valid value for the schema, but storing it would act like "cached empty result"
    // and could hide later improvements (e.g., after data/index updates). Treat empty as "no cache".
    if (!suggestions.clipartIds || suggestions.clipartIds.length === 0) {
      return
    }

    const cacheKey = generateCacheKey(mockupId, productId, productTitle, variantTitles)
    const mapValue: {
      clipartIds: string[]
      generatedAt: number
      productId: string
      variantHash: string
      reasoning?: string
    } = {
      clipartIds: suggestions.clipartIds,
      generatedAt: suggestions.generatedAt,
      productId: suggestions.productId || productId,
      variantHash: suggestions.variantHash || '',
    }

    // Only include reasoning if it exists (optional field)
    if (suggestions.reasoning) {
      mapValue.reasoning = suggestions.reasoning
    }

    await Mockup.findOneAndUpdate(
      { _id: mockupId },
      { $set: { [`metadata.fontCombinationSuggestions.${cacheKey}`]: mapValue } },
      { timestamps: false }
    )
  } catch (err) {
    console.error('[FONT_SUGGESTIONS] Update error:', err)
  }
}

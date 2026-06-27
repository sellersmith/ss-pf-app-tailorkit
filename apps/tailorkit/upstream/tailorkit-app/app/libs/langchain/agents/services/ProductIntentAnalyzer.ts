import type { BaseChatOpenAICallOptions } from '@langchain/openai'

export interface ProductIntent {
  shouldRecommend: boolean
  searchQuery: string
  confidence: number
  needsClarification: boolean
  contextLevel: 'none' | 'partial' | 'sufficient'
}

export interface ChatInvoker {
  invokeChat: (messages: any[], options?: BaseChatOpenAICallOptions) => Promise<string>
  buildMessages: (prompt: string) => any[]
  streamChat?: (messages: any[]) => Promise<AsyncIterable<any>>
}

/**
 * Service responsible for analyzing user queries to determine product recommendation intent
 * and extracting specific product search terms
 */
export class ProductIntentAnalyzer {
  // Simple LRU cache for intent analysis (query -> ProductIntent)
  private static readonly _intentCache = new Map<string, ProductIntent>()
  private static readonly MAX_CACHE_ENTRIES = 50

  // eslint-disable-next-line no-useless-constructor
  constructor(private chatInvoker: ChatInvoker) {}

  /**
   * Analyzes a user query to determine if it requires product recommendation
   * and extracts specific product search terms
   */
  async analyzeProductIntent(query: string): Promise<ProductIntent> {
    // Check cache first
    const cacheKey = query.toLowerCase().trim()
    if (ProductIntentAnalyzer._intentCache.has(cacheKey)) {
      const cached = ProductIntentAnalyzer._intentCache.get(cacheKey)!
      // Move to end (LRU)
      ProductIntentAnalyzer._intentCache.delete(cacheKey)
      ProductIntentAnalyzer._intentCache.set(cacheKey, cached)
      return cached
    }

    const analysisPrompt = `Analyze this query for product recommendation intent: "${query}"

TASK: Determine if user wants product creation help, extract search terms, and assess context completeness.

OUTPUT FORMAT (JSON):
{
  "shouldRecommend": boolean,
  "searchQuery": "specific product name or empty string",
  "confidence": 0.0-1.0,
  "needsClarification": boolean,
  "contextLevel": "none|partial|sufficient"
}

RULES:
- shouldRecommend: true if asking for product creation/recommendation/personalization
- searchQuery: ONLY extract SPECIFIC product names (t-shirt, mug, phone case, etc.), NOT generic terms
- needsClarification: true if shouldRecommend is true but context is insufficient for product creation
- contextLevel: 
  * "sufficient": Has specific product type + clear context (target audience/occasion/style)
  * "partial": Has some context but missing key details
  * "none": Very vague onboarding request

EXAMPLES:
"Create a personalized t-shirt for my gaming team" → 
  {"shouldRecommend": true, "searchQuery": "t-shirt", "confidence": 0.9, "needsClarification": false, "contextLevel": "sufficient"}
"Make a coffee mug" → {"shouldRecommend": true, "searchQuery": "mug", "confidence": 0.8, "needsClarification": true, "contextLevel": "partial"}
"What should I sell?" → {"shouldRecommend": true, "searchQuery": "", "confidence": 0.7, "needsClarification": true, "contextLevel": "none"}
"Help me create something" → {"shouldRecommend": true, "searchQuery": "", "confidence": 0.7, "needsClarification": true, "contextLevel": "none"}
"How to install app?" → {"shouldRecommend": false, "searchQuery": "", "confidence": 0.95, "needsClarification": false, "contextLevel": "none"}

Return only valid JSON.`

    try {
      const response = await this.chatInvoker.invokeChat(this.chatInvoker.buildMessages(analysisPrompt))

      // Parse JSON response
      const parsed = JSON.parse(response.trim())
      const intent: ProductIntent = {
        shouldRecommend: Boolean(parsed.shouldRecommend),
        searchQuery: String(parsed.searchQuery || '').trim(),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0))),
        needsClarification: Boolean(parsed.needsClarification),
        contextLevel: ['none', 'partial', 'sufficient'].includes(parsed.contextLevel) ? parsed.contextLevel : 'none',
      }

      // Cache the result
      this.cacheIntent(cacheKey, intent)

      return intent
    } catch (error) {
      console.error('ProductIntentAnalyzer: intent analysis failed:', error)
      // Safe fallback with simple keyword detection
      const hasProductKeywords
        = /\b(create|make|design|build|personalize|custom|tạo|làm|thiết kế|shoe|shirt|mug|poster|hoodie)\b/i.test(query)
      return {
        shouldRecommend: hasProductKeywords,
        searchQuery: '',
        confidence: hasProductKeywords ? 0.5 : 0.1,
        needsClarification: hasProductKeywords,
        contextLevel: hasProductKeywords ? 'none' : 'none',
      }
    }
  }

  /**
   * Cache an intent analysis result with LRU eviction
   */
  private cacheIntent(key: string, intent: ProductIntent): void {
    ProductIntentAnalyzer._intentCache.set(key, intent)

    // Enforce cache size limit
    if (ProductIntentAnalyzer._intentCache.size > ProductIntentAnalyzer.MAX_CACHE_ENTRIES) {
      const firstKey = ProductIntentAnalyzer._intentCache.keys().next().value
      if (firstKey) ProductIntentAnalyzer._intentCache.delete(firstKey)
    }
  }

  /**
   * Clear the intent cache (useful for testing)
   */
  static clearCache(): void {
    ProductIntentAnalyzer._intentCache.clear()
  }
}

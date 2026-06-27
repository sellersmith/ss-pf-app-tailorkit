/* eslint-disable max-len */
/**
 * Analyzes user queries to determine template operation intent and context requirements.
 * Uses LLM analysis with caching for efficient intent classification.
 */

import type { ChatInvoker } from '../services/ProductIntentAnalyzer'
import { parseJsonFromLLM } from '../services/utils/json'
import type { TEMPLATE_INTENT_TYPES } from '../constants/templates'
import { TEMPLATE_INTENT_TYPES_MAP, normalizeTemplateIntentType } from '../constants/templates'
import type { AssistantResponse } from '../../assistant.service'
import { withRetry } from './utils/retry'
import { createCache } from './utils/LRUCache'
import { SchemaFactory } from './schemas/schema-registry'
import { IntentAnalysisError, ErrorUtils, ErrorReporter } from './utils/error-handling'

export interface TemplateIntent {
  intentType: (typeof TEMPLATE_INTENT_TYPES)[number]
  confidence: number
  operation: string
  needsContext: boolean
  contextLevel: 'none' | 'partial' | 'sufficient'
}

/**
 * Analyzes user queries to classify template operation intents (create, edit, delete).
 * Provides caching and error handling for consistent intent detection.
 */
export class TemplateIntentAnalyzer {
  /** LRU cache for intent analysis results with TTL */
  private static readonly _intentCache = createCache<string, TemplateIntent>('intent')

  // eslint-disable-next-line no-useless-constructor
  constructor(protected chatInvoker: ChatInvoker) {}

  /** Builds LLM prompt for template intent classification based on conversation history */
  classifyTemplateIntentPrompt(conversation: AssistantResponse[] = []) {
    const history = conversation.map(m => `${m.role}: ${typeof m.content === 'string' ? m.content : ''}`).join('\n')

    return `
    Analyze user intent for TailorKit template operations.

    INPUT: ${history}

    OUTPUT JSON:
    {
      "intentType": "...",
      "operation": "...",
      "needsContext": true|false,
      "confidence": 0.0-1.0
    }

    INTENT TYPES:
    - ${TEMPLATE_INTENT_TYPES_MAP.template_create}, ${TEMPLATE_INTENT_TYPES_MAP.template_edit}
    - ${TEMPLATE_INTENT_TYPES_MAP.layer_create}, ${TEMPLATE_INTENT_TYPES_MAP.layer_edit}, ${TEMPLATE_INTENT_TYPES_MAP.layer_delete}
    - ${TEMPLATE_INTENT_TYPES_MAP.option_set_create}, ${TEMPLATE_INTENT_TYPES_MAP.option_set_edit}, ${TEMPLATE_INTENT_TYPES_MAP.option_set_delete}
    - ${TEMPLATE_INTENT_TYPES_MAP.general_template}, ${TEMPLATE_INTENT_TYPES_MAP.unknown}

    RULES:
    1. **Domain Classification:**
      - template → template properties (name, size, category)
      - layer → canvas elements (text, image, shape)
      - option_set → choice collections (fonts, colors, variations)

    2. **Action Classification:**
      - *_create → adding new entity
      - *_edit → modifying existing entity
      - *_delete → removing entity

    3. **Operation Naming:**
      - Use target descriptor only: "text_content", "image_src", "template_name"
      - No action verbs in operation name

    4. **Context Requirements:**
      - needsContext = false if request is clear and specific
      - needsContext = true if missing details or vague

    EXAMPLES:
    "Change Happy Birthday to Happy children day"
    → {intentType:"layer_edit", operation:"text_content", needsContext:false, confidence:0.9}

    "Add font options for title"
    → {intentType:"option_set_create", operation:"text_font_choices", needsContext:true, confidence:0.8}

    "Rename template to BCD"
    → {intentType:"template_edit", operation:"template_name", needsContext:false, confidence:1.0}`
  }

  /**
   * Analyzes user query to determine template operation intent and context needs.
   * @param query User's message
   * @param conversationHistory Recent conversation context
   * @returns Template intent with confidence and context requirements
   */
  async analyzeTemplateIntent(query: string, conversationHistory?: AssistantResponse[]): Promise<TemplateIntent> {
    // Check cache first
    const cacheKey = query.toLowerCase().trim()
    const cached = TemplateIntentAnalyzer._intentCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const currentConversation = [
      ...(conversationHistory || []),
      { role: 'user' as const, content: query, timestamp: new Date() },
    ]
    const analysisPrompt = this.classifyTemplateIntentPrompt(currentConversation)

    try {
      const response = await withRetry(
        () =>
          this.chatInvoker.invokeChat(this.chatInvoker.buildMessages(analysisPrompt), {
            response_format: SchemaFactory.createResponseFormat('templateIntentAnalysis'),
          }),
        'Template intent analysis'
      )

      const parsed = parseJsonFromLLM<any>(response)
      const intent: TemplateIntent = {
        intentType: normalizeTemplateIntentType(parsed.intentType),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0))),
        operation: String(parsed.operation || '').trim(),
        needsContext: Boolean(parsed.needsContext),
        contextLevel: ['none', 'partial', 'sufficient'].includes(parsed.contextLevel) ? parsed.contextLevel : 'none',
      }

      // Cache the result
      TemplateIntentAnalyzer._intentCache.set(cacheKey, intent)

      return intent
    } catch (error) {
      const context = ErrorUtils.createContext('analyzeTemplateIntent', 'TemplateIntentAnalyzer', {
        query: query.slice(0, 100),
        hasHistory: !!conversationHistory?.length,
      })

      const intentError = new IntentAnalysisError(
        'Failed to analyze template intent from user query',
        context,
        error instanceof Error ? error : undefined
      )

      ErrorReporter.getInstance().reportError(intentError)
      console.error('TemplateIntentAnalyzer: intent analysis failed:', intentError.message)

      return {
        intentType: TEMPLATE_INTENT_TYPES_MAP.unknown,
        confidence: 0.05,
        operation: '',
        needsContext: true,
        contextLevel: 'none',
      }
    }
  }

  /** Clears the intent cache (useful for testing) */
  static clearCache(): void {
    TemplateIntentAnalyzer._intentCache.clear()
  }

  /** Returns cache statistics for monitoring */
  static getCacheStats() {
    return TemplateIntentAnalyzer._intentCache.getStats()
  }
}

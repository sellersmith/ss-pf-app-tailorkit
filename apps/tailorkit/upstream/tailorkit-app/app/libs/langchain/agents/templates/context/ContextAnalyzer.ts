/* eslint-disable max-len */
/**
 * Analyzes user prompts to extract structured context for template creation.
 * Extracts product, style, and purpose information using AI to guide template generation.
 */

import type { AssistantResponse } from '~/libs/langchain/assistant.service'
import type { ChatInvoker } from '../../services/ProductIntentAnalyzer'
import type { MEASUREMENT_UNIT } from '~/constants/measurement-units'
import type { RESOLUTION } from '~/constants/resolution'
import { parseJsonOrThrow } from '../utils/prompt'
import { lengthUnitToPixels } from '~/utils/lengthUnitToPixels'
import { withRetry } from '../utils/retry'
import { ContextAnalysisError, ErrorUtils, ErrorReporter } from '../utils/error-handling'
import { SchemaFactory } from '../schemas/schema-registry'
import { createCache } from '../utils/LRUCache'

export const DEFAULT_RESOLUTION: RESOLUTION = 300

/** Product-related context extracted from user prompts */
export interface ProductContext {
  type: string
  category: string
  printableAreas: {
    width: number
    height: number
    measurementUnit: MEASUREMENT_UNIT
    resolution: RESOLUTION
  }
}

/** Style and visual context extracted from user prompts */
export interface StyleContext {
  originalRequest: string
  theme: string
  mood: string[]
  colorScheme: {
    primary: string[]
    secondary: string[]
    accent: string[]
  }
  typography: {
    headingStyle: string
    bodyStyle: string
    recommended: string[]
  }
  visualElements: {
    shapes: string[]
    patterns: string[]
    icons: string[]
  }
  /** Optional rich extraction of subjects for downstream engines */
  extractedSubjects?: ExtractedSubjects
}

/** Purpose and usage context extracted from user prompts */
export interface PurposeContext {
  type: 'gift' | 'business' | 'personal' | 'event' | 'other'
  occasion: string
  audience: string[]
  requirements: string[]
}

/** Complete template context combining product, style, and purpose information */
export interface TemplateContextAnalyze {
  product: ProductContext
  style: StyleContext
  purpose: PurposeContext
  confidence: number
  templateName: string
}

/** Structured subject extraction for improved layer-specific prompts */
export interface ExtractedSubjects {
  mainSubjects: Array<{
    id: string
    label: string
    type: string
    description: string
    keyPhrases?: string[]
  }>
  supportingElements: Array<{
    id: string
    label: string
    type: string
    description: string
    keyPhrases?: string[]
  }>
  textContents: Array<{
    id: string
    role: string
    content: string
  }>
}

/** Analyzes user prompts to extract comprehensive template creation context */
export class ContextAnalyzer {
  // Optimized LRU cache for context analysis with TTL
  private static readonly _contextCache = createCache<string, TemplateContextAnalyze>('context')

  /** @param chatInvoker AI chat service for context analysis */
  // eslint-disable-next-line no-useless-constructor
  constructor(private chatInvoker: ChatInvoker) {}

  /** Extracts comprehensive template context from prompt with dimension normalization to pixels. */
  async analyzeContext(prompt: string, conversationHistory?: AssistantResponse[]): Promise<TemplateContextAnalyze> {
    // Create cache key from prompt and conversation history
    const conversationContext
      = conversationHistory?.map(m => `${m.role}: ${typeof m.content === 'string' ? m.content : ''}`).join('\n') || ''
    const cacheKey = `${prompt.toLowerCase().trim()}|${conversationContext}`.slice(0, 200)

    // Check cache first
    const cached = ContextAnalyzer._contextCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const analysisPrompt = `Extract template creation context from user request.

REQUEST: "${prompt}"
${conversationContext ? `CONTEXT: ${conversationContext}` : ''}

EXTRACTION RULES (low-latency, concise):
• Extract only explicitly mentioned information. Avoid inference beyond common-sense.
• Required: product.type, style.theme, purpose.type, purpose.occasion (use "missing" or "general" if unclear).
• DIMENSIONS: Precedence → (1) user-specified size or aspect/shape: honor exactly, never normalize to product defaults; (2) recognized product: infer typical print-on-demand printable area; (3) unknown: set width=500 and height=500.
• When only aspect/shape is provided (no absolute size), choose width/height that preserve that ratio; if product is recognized, fit within its printable area; otherwise return a reasonable proportional pair and keep measurementUnit.
• Never override a user-stated aspect/shape or target layout; if conflicting with product norms, keep the user's intent.
• TEMPLATE NAME: Meaningful, ≤ 50 chars, derived from actual context (avoid generic names).
• Colors: Hex only (#000000). Arrays: ≤ 5 items. Keep strings short (≤ 12 words). No prose.
• Fill style details only when clearly implied. Avoid unnecessary decorations.

CONFIDENCE:
• Provide a numeric confidence between 0 and 1 indicating how complete and reliable the extracted context is.
• 0.8–1.0: product type + style/theme + clear purpose + non-zero dimensions or known printable area
• 0.5–0.79: partial info (some key fields missing or generic) but still actionable with assumptions
• 0.1–0.49: vague, mostly missing, requires clarification before proceeding

OUTPUT:
• Return ONLY valid JSON aligned with the provided schema (no markdown fences, no comments).
`

    try {
      const response = await withRetry(
        () =>
          this.chatInvoker.invokeChat([{ role: 'user', content: analysisPrompt }], {
            response_format: SchemaFactory.createResponseFormat('templateContextAnalysis'),
          }),
        'Context analysis'
      )

      const result = parseJsonOrThrow<TemplateContextAnalyze>(response, 'Context analysis')

      // Basic presence validation (keep lightweight here; deep checks in validateContext)
      if (!result.product || !result.style || !result.purpose) {
        throw new Error('Missing required context fields')
      }

      // Add original request to StyleContext so CanvasStyleEngine can access it
      result.style.originalRequest = prompt

      // SECOND PASS (fast): extract concrete subjects to guide later layers
      try {
        const subjects = await this.extractSubjects(prompt)
        if (subjects) {
          result.style.extractedSubjects = subjects
        }
      } catch (e) {
        // Non-fatal: keep going with baseline context
        console.warn('Subject extraction skipped due to error:', e)
      }

      const productContext = {
        ...result.product,
        printableAreas: {
          ...result.product.printableAreas,
          measurementUnit: 'px' as MEASUREMENT_UNIT,
          width: lengthUnitToPixels(
            result.product.printableAreas.width,
            result.product.printableAreas.measurementUnit,
            DEFAULT_RESOLUTION
          ),
          height: lengthUnitToPixels(
            result.product.printableAreas.height,
            result.product.printableAreas.measurementUnit,
            DEFAULT_RESOLUTION
          ),
          resolution: DEFAULT_RESOLUTION,
        },
      }
      const finalContext = { ...result, product: productContext }

      // Cache the result
      ContextAnalyzer._contextCache.set(cacheKey, finalContext)

      return finalContext
    } catch (error) {
      const context = ErrorUtils.createContext('analyzeContext', 'ContextAnalyzer', {
        prompt: prompt.slice(0, 100),
        hasHistory: !!conversationHistory?.length,
      })

      const analysisError = new ContextAnalysisError(
        'Failed to analyze template context from user prompt',
        context,
        error instanceof Error ? error : undefined
      )

      ErrorReporter.getInstance().reportError(analysisError)
      throw analysisError
    }
  }

  /** Extracts visual subjects and elements from prompt for layer-specific guidance. */
  private async extractSubjects(originalPrompt: string): Promise<ExtractedSubjects> {
    const subjectPrompt = `Extract distinct visual subjects and their relationships from this prompt as structured JSON.

PROMPT: "${originalPrompt}"

RULES:
1. Main Subjects:
   • Extract primary subjects that need their own layers
   • Include detailed descriptions but avoid cross-references
   • Assign meaningful IDs (e.g., "child_1", "dog_1")
   • Keep type generic (e.g., "person", "animal", "object")
   • Add key descriptive phrases that define this subject

2. Supporting Elements:
   • Extract secondary visuals that enhance the scene
   • Include decorative or background elements
   • Avoid relationship-dependent descriptions
   • Focus on standalone visual characteristics

3. Text Content:
   • Extract any explicit text to be rendered
   • Assign appropriate roles (heading, caption, detail)
   • Keep content exactly as specified in prompt

4. General Guidelines:
   • Do not infer or add details not in prompt
   • Keep descriptions focused on visual aspects
   • Avoid references between subjects
   • Use neutral, factual language

Example structure (DO NOT COPY CONTENT):
{
  "mainSubjects": [{
    "id": "child_1",
    "label": "Happy Child",
    "type": "person",
    "description": "Young child with bright smile, casual clothing",
    "keyPhrases": ["bright smile", "casual outfit", "playful pose"]
  }],
  "supportingElements": [{
    "id": "decor_1",
    "label": "Stars Pattern",
    "type": "decoration",
    "description": "Scattered star shapes in background",
    "keyPhrases": ["scattered", "star-shaped", "decorative"]
  }],
  "textContents": [{
    "id": "text_1",
    "role": "heading",
    "content": "Birthday Fun"
  }]
}`

    const response = await withRetry(
      () =>
        this.chatInvoker.invokeChat([{ role: 'user', content: subjectPrompt }], {
          response_format: SchemaFactory.createResponseFormat('subjectExtraction'),
        }),
      'Subject extraction'
    )

    return parseJsonOrThrow<ExtractedSubjects>(response, 'Subject extraction')
  }

  /** Clear the context analysis cache (useful for testing) */
  static clearCache(): void {
    ContextAnalyzer._contextCache.clear()
  }

  /** @returns Cache statistics for monitoring */
  static getCacheStats() {
    return ContextAnalyzer._contextCache.getStats()
  }

  /** Validates and enhances context with product-specific constraints. */
  async validateContext(context: TemplateContextAnalyze): Promise<TemplateContextAnalyze> {
    // Implement context validation and enhancement
    // - Verify product constraints
    // - Validate color schemes
    // - Check style-product compatibility
    return context
  }
}

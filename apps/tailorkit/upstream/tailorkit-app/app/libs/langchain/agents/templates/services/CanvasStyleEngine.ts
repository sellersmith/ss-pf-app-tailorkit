/**
 * Translates abstract style context into canvas-ready elements with composition guidance.
 * Uses AI to convert design intent into specific visual elements with caching optimization.
 */

import type { ChatInvoker } from '../../services/ProductIntentAnalyzer'
import type { StyleContext } from '../context/ContextAnalyzer'
import type { ELayerType } from '~/types/psd'
import { parseJsonOrThrow } from '../utils/prompt'
import { SchemaFactory } from '../schemas/schema-registry'
import { createCache } from '../utils/LRUCache'
import { withRetry } from '../utils/retry'

import type {
  TEXT_STYLE_CONSTANTS,
  DESIGN_INTENT,
  CANVAS_PROPERTIES,
  SemanticContext,
} from '../constants/style.constants'
import { CACHE_CONFIG } from '../constants/style.constants'
import { STYLE_PROMPTS } from '../constants/prompts.constants'

/** Canvas-ready style element with settings, design intent, and properties. */
export interface CanvasElement {
  id: string
  type: ELayerType
  styleSettings: {
    storefrontLabel: string
    content?: string
    fontFamily?: { family: string; src: string }
    fontSize?: number
    textStyle?: Array<(typeof TEXT_STYLE_CONSTANTS.TEXT)[number]>
    textColor?: string
    textAlign?: (typeof TEXT_STYLE_CONSTANTS.ALIGN)[number]
    textShape?: (typeof TEXT_STYLE_CONSTANTS.SHAPE)[number]
    curvePeaks?: number
    curveBend?: number
    circleStartAngle?: number
    circleEndAngle?: number
    imageType?: string
    imagePrompt?: string
    imageStyle?: string
    opacity?: number
    shadowColor?: string
    shadowBlur?: number
    shadowOffset?: { x: number; y: number }
    /** Auto fit text to the container, defaults to true */
    autoFitToContainer?: boolean
    /** Optional stylistic enrichments to preserve */
    styleCase?: (typeof TEXT_STYLE_CONSTANTS.CASE)[number]
    verticalAlign?: (typeof TEXT_STYLE_CONSTANTS.VERTICAL_ALIGN)[number]
    strokeColor?: string
    strokeWeight?: number
    neonMode?: (typeof TEXT_STYLE_CONSTANTS.NEON_MODE)[number]
    neonIntensity?: number
  }
  designIntent: {
    purpose: (typeof DESIGN_INTENT.PURPOSE)[number]
    visualWeight: number
    preferredPosition: (typeof DESIGN_INTENT.POSITION)[number]
    scalingBehavior: (typeof DESIGN_INTENT.SCALING)[number]
  }
  canvasProperties: {
    layerType: (typeof CANVAS_PROPERTIES.LAYER_TYPE)[number]
    zIndexRange: { min: number; max: number }
    blendMode: (typeof CANVAS_PROPERTIES.BLEND_MODE)[number]
    allowOverlap: boolean
  }
  // NEW: Semantic relationships for better positioning
  semanticContext?: SemanticContext
}

/** Complete style mapping with elements, characteristics, and composition guidelines. */
export interface StyleMapping {
  /** Array of canvas elements with complete styling and semantic context */
  elements: CanvasElement[]

  /** Overall visual characteristics of the design composition */
  styleCharacteristics: {
    /** Visual complexity level of the design */
    visualDensity: 'minimal' | 'balanced' | 'rich' | 'maximalist'
    /** Color relationship strategy */
    colorHarmony: 'monochromatic' | 'analogous' | 'complementary' | 'triadic'
    /** Typography sizing system with base size and scaling ratio */
    typographyScale: { base: number; ratio: number }
    /** How visual elements flow and guide the eye */
    visualFlow: 'linear' | 'circular' | 'scattered' | 'hierarchical'
  }

  /** Guidelines for arranging elements in the composition */
  compositionGuidelines: {
    /** Visual balance approach */
    balance: 'symmetric' | 'asymmetric' | 'radial' | 'dynamic'
    /** Strategy for directing viewer attention */
    focusStrategy: 'single-point' | 'multi-focal' | 'distributed'
    /** Level of visual depth and layering */
    layerDepth: 'flat' | 'subtle' | 'pronounced'
    /** How elements can overlap or interact spatially */
    overlapStrategy: 'avoid' | 'minimal' | 'artistic' | 'intentional'
  }

  /** Scene context for dynamic positioning and mood */
  sceneContext?: {
    /** Type of scene or environment (e.g., "urban", "natural", "abstract") */
    sceneType: string
    /** How elements are arranged spatially */
    spatialArrangement: string
    /** Overall energy or activity level */
    energyLevel: string
    /** Dominant emotional tones */
    dominantMood: string[]
  }
}

/** Core style translation engine with caching and semantic relationship mapping. */
export class CanvasStyleEngine {
  /** Lightweight LRU cache to avoid repeated LLM calls for similar style contexts */
  private static readonly _styleCache = createCache<string, StyleMapping>('style', {
    maxSize: CACHE_CONFIG.STYLE_CACHE_SIZE,
  })

  // eslint-disable-next-line no-useless-constructor
  constructor(private chatInvoker: ChatInvoker) {}

  /** Builds concise prompt context for efficient LLM processing. */
  private buildCondensedContext(styleContext: StyleContext): string {
    const theme = String(styleContext?.theme || '').trim()
    const original = String((styleContext as any)?.originalRequest || '').trim()
    const mood = (styleContext?.mood || []).filter(Boolean).join(', ')
    const colorsPrimary = (styleContext?.colorScheme?.primary || []).filter(Boolean).join(', ')
    const colorsSecondary = (styleContext?.colorScheme?.secondary || []).filter(Boolean).join(', ')
    const colorsAccent = (styleContext?.colorScheme?.accent || []).filter(Boolean).join(', ')
    const headingStyle = String(styleContext?.typography?.headingStyle || '').trim()
    const bodyStyle = String(styleContext?.typography?.bodyStyle || '').trim()
    const icons = (styleContext?.visualElements?.icons || []).filter(Boolean).join(', ')
    const shapes = (styleContext?.visualElements?.shapes || []).filter(Boolean).join(', ')
    const patterns = (styleContext?.visualElements?.patterns || []).filter(Boolean).join(', ')

    return [
      theme && `Theme: ${theme}`,
      original && `Original request: ${original}`,
      mood && `Mood: ${mood}`,
      colorsPrimary && `Colors primary: ${colorsPrimary}`,
      colorsSecondary && `Colors secondary: ${colorsSecondary}`,
      colorsAccent && `Colors accent: ${colorsAccent}`,
      headingStyle && `Typography heading: ${headingStyle}`,
      bodyStyle && `Typography body: ${bodyStyle}`,
      icons && `Icons: ${icons}`,
      shapes && `Shapes: ${shapes}`,
      patterns && `Patterns: ${patterns}`,
    ]
      .filter(Boolean)
      .join('\n')
  }

  /**
   * Creates a deterministic cache key capturing the essential parts of the input request.
   * Ensures consistent caching behavior for similar style contexts while avoiding
   * cache misses due to irrelevant variations.
   *
   * @private
   * @param styleContext - The style context to create a cache key for
   * @returns Deterministic cache key string (truncated to 500 chars)
   */
  private createCacheKey(styleContext: StyleContext): string {
    const keyObj = {
      original: String((styleContext as any)?.originalRequest || '').toLowerCase(),
      theme: String(styleContext?.theme || '').toLowerCase(),
      mood: (styleContext?.mood || []).map(m => String(m).toLowerCase()),
      colors: styleContext?.colorScheme,
      typography: {
        h: styleContext?.typography?.headingStyle,
        b: styleContext?.typography?.bodyStyle,
      },
      visuals: styleContext?.visualElements,
      // Include extracted subjects in cache key for better differentiation
      subjects: styleContext?.extractedSubjects
        ? {
            main: styleContext.extractedSubjects.mainSubjects.map(s => s.label),
            support: styleContext.extractedSubjects.supportingElements.map(s => s.label),
            text: styleContext.extractedSubjects.textContents.map(t => t.content),
          }
        : undefined,
    }
    return JSON.stringify(keyObj).slice(0, 500)
  }

  /** Maps style context to canvas elements with AI processing and caching. */
  async mapStyleToCanvasElements(styleContext: StyleContext): Promise<StyleMapping> {
    const originalRequest = styleContext.originalRequest || 'No original request available'
    const condensed = this.buildCondensedContext(styleContext)
    const extractedSubjects = styleContext.extractedSubjects

    // Enrich prompt with extracted subjects if available
    const subjectsContext = extractedSubjects
      ? `\nEXTRACTED SUBJECTS:
Main Subjects: ${extractedSubjects.mainSubjects.map(s => `${s.label} (${s.description})`).join(', ')}
Supporting Elements: ${extractedSubjects.supportingElements.map(s => `${s.label} (${s.description})`).join(', ')}
Text Content: ${extractedSubjects.textContents.map(t => `${t.role}: "${t.content}"`).join(', ')}`
      : ''

    const stylePrompt = STYLE_PROMPTS.CANVAS_STYLE_DESIGNER.replace('{originalRequest}', originalRequest).replace(
      '{condensedContext}',
      `${condensed}${subjectsContext}`
    )

    // Check cache first
    const cacheKey = this.createCacheKey(styleContext)
    const cached = CanvasStyleEngine._styleCache.get(cacheKey)
    if (cached) {
      return cached
    }

    try {
      const response = await withRetry(
        () =>
          this.chatInvoker.invokeChat([{ role: 'user', content: stylePrompt }], {
            response_format: SchemaFactory.createResponseFormat('canvasStyleMapping'),
          }),
        'Canvas style mapping'
      )

      const result = parseJsonOrThrow<StyleMapping>(response, 'Canvas style mapping')

      // Cache and return
      CanvasStyleEngine._styleCache.set(cacheKey, result)
      return result
    } catch (error: any) {
      console.error('❌ ERROR in Canvas Style Engine LLM call:', JSON.stringify(error, null, 2))
      throw error
    }
  }

  /** Clears the internal style cache. */
  static clearCache(): void {
    CanvasStyleEngine._styleCache.clear()
  }

  /** Gets cache statistics for monitoring and performance analysis. */
  static getCacheStats() {
    return CanvasStyleEngine._styleCache.getStats()
  }
}

/**
 * Adapts canvas style elements into product-constrained composition with production validation.
 */

/* eslint-disable max-len */
import type { ChatInvoker } from '../../services/ProductIntentAnalyzer'
import type { ProductContext } from '../context/ContextAnalyzer'
import { ELayerType } from '~/types/psd'
import { parseJsonOrThrow } from '../utils/prompt'
import type { CanvasElement, StyleMapping } from './CanvasStyleEngine'
import type { MEASUREMENT_UNIT } from '~/constants/measurement-units'
import { adjustTextFontSizeToFit as adjustTextFontSizeToFitUtil } from '../utils/textLayout'
import { FontService, type FontResolution } from './FontService'
import { createCache } from '../utils/LRUCache'
import { withRetry } from '../utils/retry'
import { SchemaFactory } from '../schemas/schema-registry'
import { ErrorUtils, ErrorReporter, BaseTemplateError, ErrorCategory, ErrorSeverity } from '../utils/error-handling'
import type { RESOLUTION } from '~/constants/resolution'
import { CACHE_CONFIG } from '../constants/style.constants'
import { STYLE_PROMPTS } from '../constants/prompts.constants'

/** Canvas element adapted for product constraints and production requirements. */
export interface AdaptedCanvasElement {
  /** Unique element identifier */
  id: string
  /** Human-readable element label for UI display */
  label: string
  /** Layer type (text or image) */
  type: ELayerType

  /** Extended style settings including product-specific options */
  settings: CanvasElement['styleSettings'] & {
    /** Whether text should auto-fit to its container */
    autoFitToContainer?: boolean
    /** Placeholder text for customer input fields */
    placeholder?: string
    /** Whether this element is required for order completion */
    required?: boolean
    /** Who can edit this element's content */
    textCreatedBy?: 'merchant' | 'customers'
    /** Maximum characters allowed for customer input */
    characterLimit?: number
    /** Instructions or notes for customers */
    notesForCustomers?: string
    /** Whether element meets production safety requirements */
    productionSafe?: boolean
    /** Whether element has been scaled for product dimensions */
    scaledForProduct?: boolean
    /** AI prompt for image generation (image elements only) */
    imagePrompt?: string
  }

  /** Element positioning and sizing information */
  transform: {
    /** X coordinate in pixels */
    x: number
    /** Y coordinate in pixels */
    y: number
    /** Width in pixels */
    width: number
    /** Height in pixels */
    height: number
    /** Rotation in degrees (optional) */
    rotation?: number
    /** Horizontal scale factor (optional) */
    scaleX?: number
    /** Vertical scale factor (optional) */
    scaleY?: number
  }

  /** Layer stacking and visual effects */
  layering: {
    /** Z-index for layer ordering */
    zIndex: number
    /** CSS blend mode for layer interaction */
    blendMode: string
    /** Optional mask configuration */
    mask?: string
  }

  /** Element interaction and constraint behavior */
  behavior: {
    /** Whether customers can interact with this element */
    isInteractive: boolean
    /** Whether element position/size is locked */
    isLocked: boolean
    /** Whether to maintain aspect ratio during resizing */
    maintainAspectRatio: boolean
  }

  /** Design intent information preserved from original element */
  designIntent: CanvasElement['designIntent']
}

/** Complete product canvas composition with adapted elements and production metadata. */
export interface ProductCanvasComposition {
  /** Array of adapted canvas elements with product constraints applied */
  elements: AdaptedCanvasElement[]

  /** Canvas properties and constraints */
  canvasProperties: {
    /** Canvas dimensions and measurement specifications */
    dimension: { width: number; height: number; measurementUnit: MEASUREMENT_UNIT; resolution: RESOLUTION }
    /** Safe printing zones (margins from edges) */
    safeZone: { top: number; right: number; bottom: number; left: number }
    /** Optional background color for the canvas */
    backgroundColor?: string
    /** Background rendering type */
    backgroundType: 'solid' | 'gradient' | 'transparent'
  }

  /** Visual composition and layout information */
  composition: {
    /** Primary focal point for visual attention */
    focalPoint: { x: number; y: number }
    /** Description of visual flow pattern */
    visualFlow: string
    /** Information about element interactions and overlaps */
    layerInteractions: {
      /** Whether any elements overlap */
      hasOverlaps: boolean
      /** Intentionally designed overlaps between specific elements */
      intentionalOverlaps: Array<{ element1: string; element2: string }>
    }
  }

  /** Production and print requirements */
  productionGuidelines: {
    /** Printing method constraints and limitations */
    printingConstraints: string[]
    /** Quality standards that must be met */
    qualityRequirements: string[]
    /** Safety checks required before production */
    safetyChecks: string[]
  }
}

/** Adapter that translates canvas elements into product-specific layouts with constraints. */
export class ProductCanvasAdapter {
  /** LRU cache for product composition results to optimize repeated requests */
  private static readonly _compositionCache = createCache<string, ProductCanvasComposition>('product', {
    maxSize: CACHE_CONFIG.PRODUCT_CACHE_SIZE,
  })

  /** Font service instance for Google Fonts resolution */
  private fontService: FontService

  /** Creates a new ProductCanvasAdapter instance. */
  constructor(private chatInvoker: ChatInvoker) {
    this.fontService = FontService.getInstance()
  }

  /** Resolves Google Font using FontService with Latin subset for production. */
  private async resolveGoogleFont(settings: AdaptedCanvasElement['settings']): Promise<FontResolution | null> {
    const requested = String(settings?.fontFamily?.family || '').trim()
    return this.fontService.resolveGoogleFont(requested, {
      variant: 'regular',
      requireLatinSubset: true,
    })
  }

  /** Adapts canvas style mapping to product composition with AI layout and validation. */
  async adaptStyleToProduct(
    styleMapping: StyleMapping,
    productContext: ProductContext
  ): Promise<ProductCanvasComposition> {
    const cacheKey = this.createCacheKey(styleMapping, productContext)
    const cached = ProductCanvasAdapter._compositionCache.get(cacheKey)
    if (cached) return cached

    try {
      // Let LLM propose initial layout based on semantic relationships
      const response = await withRetry(
        () =>
          this.chatInvoker.invokeChat(
            [{ role: 'user', content: this.buildAdaptationPrompt(styleMapping, productContext) }],
            {
              response_format: SchemaFactory.createResponseFormat('productCanvasComposition'),
            }
          ),
        'Product canvas adaptation'
      )

      const result = parseJsonOrThrow<ProductCanvasComposition>(response, 'Product canvas adaptation')

      // Validate element preservation
      this.validateElementPreservation(result, styleMapping)

      // Gentle optimization that respects LLM's semantic choices
      const optimizedResult = await this.validateAndOptimize(result, productContext)

      ProductCanvasAdapter._compositionCache.set(cacheKey, optimizedResult)
      return optimizedResult
    } catch (error: any) {
      const context = ErrorUtils.createContext('adaptStyleToProduct', 'ProductCanvasAdapter', {
        productType: productContext.type,
        canvasSize: `${productContext.printableAreas.width}x${productContext.printableAreas.height}`,
      })

      const adaptationError = new BaseTemplateError(
        'Failed to adapt style mapping to product canvas composition',
        'CANVAS_ADAPTATION_FAILED',
        ErrorCategory.LLM_API,
        ErrorSeverity.HIGH,
        context,
        { originalError: error instanceof Error ? error : undefined }
      )

      ErrorReporter.getInstance().reportError(adaptationError)
      throw adaptationError
    }
  }

  private buildAdaptationPrompt(styleMapping: StyleMapping, productContext: ProductContext): string {
    // Extract subject relationships from semantic context
    const elementRelationships = styleMapping.elements
      .map(e => {
        const connections = e.semanticContext?.connectionTo || []
        if (connections.length === 0) return null

        const connectedElements = connections
          .map(id => styleMapping.elements.find(other => other.id === id))
          .filter(Boolean)
          .map(other => other?.styleSettings?.storefrontLabel || other?.id)

        return {
          subject: e.styleSettings?.storefrontLabel || e.id,
          role: e.semanticContext?.role,
          connections: connectedElements,
          spatialHints: e.semanticContext?.spatialHints,
        }
      })
      .filter(Boolean)

    const relationshipContext = elementRelationships.length
      ? `\nRELATIONSHIP CONTEXT:
${elementRelationships
  .map(rel =>
    rel
      ? `${rel.subject} (${rel.role}):
  - Connected to: ${rel.connections.join(', ')}
  - Spatial hints: ${JSON.stringify(rel.spatialHints)}`
      : null
  )
  .filter(Boolean)
  .join('\n')}`
      : ''

    // Build element summary for clear reference
    const elementSummary = styleMapping.elements.map(e => ({
      id: e.id,
      type: e.type,
      label: e.styleSettings?.storefrontLabel || e.id,
      role: e.semanticContext?.role,
      purpose: e.designIntent?.purpose,
      weight: e.designIntent?.visualWeight,
      position: e.designIntent?.preferredPosition,
    }))

    // Build concise element list
    const elementList = elementSummary.map(e => `${e.id} (${e.type}): ${e.label}`).join('\n')

    return `Create ${productContext?.type || 'product'} design (${productContext.printableAreas.width}x${productContext.printableAreas.height}px).

ELEMENTS TO PRESERVE (ALL REQUIRED):
${elementList}

STYLE: ${styleMapping.styleCharacteristics?.visualDensity || 'balanced'} density, ${styleMapping.styleCharacteristics?.colorHarmony || 'default'} colors
${relationshipContext}

RULES:
1. Keep ALL elements with EXACT IDs and types
2. Stay within canvas (0,0 to ${productContext.printableAreas.width},${productContext.printableAreas.height})
3. Required fields: transform{x,y,width,height}, layering{zIndex,blendMode}, behavior{isInteractive,isLocked,maintainAspectRatio}
4. Colors MUST be HEX strings only (e.g., #FFFFFF). Do NOT use gradients or CSS color expressions.
5. For ${ELayerType.IMAGE} elements, settings.imagePrompt MUST BE standalone and describe only that SINGLE SUBJECT and MUST NOT reference the labels or IDs of any other elements.
6. Output MUST be raw JSON only. No markdown fences, no comments, no extra prose.

Example (use YOUR IDs):
{
  "id": "your_id_here",
  "type": "${ELayerType.TEXT} or ${ELayerType.IMAGE}",
  "transform": {"x": 100, "y": 100, "width": 200, "height": 200, "rotation": 0, "scaleX": 1, "scaleY": 1},
  "layering": {"zIndex": 10, "blendMode": "normal", "mask": ""},
  "behavior": {"isInteractive": true, "isLocked": false, "maintainAspectRatio": true}
}`
  }

  private validateElementPreservation(result: ProductCanvasComposition, styleMapping: StyleMapping): void {
    const expectedIds = new Set(styleMapping.elements.map(e => e.id))
    const actualIds = new Set(result.elements.map(e => e.id))

    const missing = [...expectedIds].filter(id => !actualIds.has(id))
    if (missing.length > 0) {
      throw new Error(`Missing elements in adaptation result: ${missing.join(', ')}`)
    }
  }

  /** Validates image prompts for standalone, element-specific content. */
  private validateImagePrompts(elements: AdaptedCanvasElement[]): void {
    const imageElements = elements.filter(e => e.type === ELayerType.IMAGE)

    // Build a fast lookup of other labels and IDs (lowercased)
    const labelAndIdSet = new Map<string, Set<string>>()
    for (const el of imageElements) {
      const others = imageElements.filter(o => o.id !== el.id)
      const tokens = new Set<string>()
      for (const o of others) {
        if (o.label) tokens.add(o.label.toLowerCase())
        if (o.id) tokens.add(o.id.toLowerCase())
      }
      labelAndIdSet.set(el.id, tokens)
    }

    // // Helper: escape special regex chars in tokens to avoid invalid patterns
    // const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    for (const element of imageElements) {
      const prompt = String(element.settings.imagePrompt || '')
        .toLowerCase()
        .trim()
      if (!prompt) {
        throw new BaseTemplateError(
          STYLE_PROMPTS.VALIDATION_ERRORS.MISSING_PROMPT.replace('{label}', element.label),
          'MISSING_IMAGE_PROMPT',
          ErrorCategory.VALIDATION,
          ErrorSeverity.HIGH,
          ErrorUtils.createContext('validateImagePrompts', 'ProductCanvasAdapter')
        )
      }

      // const forbidden = labelAndIdSet.get(element.id) || new Set<string>()
      // const referenced: string[] = []
      // forbidden.forEach(rawToken => {
      //   const token = String(rawToken || '')
      //     .trim()
      //     .toLowerCase()
      //   if (!token || token.length < 2) return
      //   const escaped = escapeRegex(token)
      //   // Match whole-token boundaries with common separators
      //   const re = new RegExp(`(^|[\\n\\r\\t\\s])${escaped}([\\s\\.,!\\?]|$)`, 'i')
      //   if (re.test(prompt)) referenced.push(token)
      // })

      // if (referenced.length > 0) {
      //   throw new BaseTemplateError(
      //     STYLE_PROMPTS.VALIDATION_ERRORS.CROSS_REFERENCE.replace('{label}', element.label).replace(
      //       '{references}',
      //       Array.from(new Set(referenced)).join(', ')
      //     ),
      //     'CROSS_REFERENCED_ELEMENTS',
      //     ErrorCategory.VALIDATION,
      //     ErrorSeverity.HIGH,
      //     ErrorUtils.createContext('validateImagePrompts', 'ProductCanvasAdapter')
      //   )
      // }

      if (!element.designIntent?.purpose) {
        console.warn(`Warning: Image element "${element.label}" missing design purpose`)
      }
    }
  }

  private async validateAndOptimize(
    composition: ProductCanvasComposition,
    productContext: ProductContext
  ): Promise<ProductCanvasComposition> {
    const { width, height } = productContext.printableAreas

    // Validate image prompts first
    this.validateImagePrompts(composition.elements)

    // Process each element while preserving LLM's semantic choices
    composition.elements = await Promise.all(
      composition.elements.map(async element => {
        // Ensure minimum dimensions (dynamic based on canvas size, but never below schema min 16)
        const minByCanvas = Math.max(16, Math.floor(Math.min(width, height) * 0.02))
        element.transform.width = Math.max(minByCanvas, element.transform.width)
        element.transform.height = Math.max(minByCanvas, element.transform.height)

        // Ensure within printable area - center elements if out of bounds
        if (element.transform.x < 0 || element.transform.x + element.transform.width > width) {
          element.transform.x = Math.max(0, (width - element.transform.width) / 2)
        }
        if (element.transform.y < 0 || element.transform.y + element.transform.height > height) {
          element.transform.y = Math.max(0, (height - element.transform.height) / 2)
        }

        // Handle text elements
        if (element.type === ELayerType.TEXT) {
          element.settings.autoFitToContainer = true
          const resolvedFont = await this.resolveGoogleFont(element.settings)
          if (resolvedFont) {
            element.settings.fontFamily = resolvedFont
          }

          // Auto-fit if content exists
          const content = String(element?.settings?.content || '').trim()
          if (content) {
            const fitted = adjustTextFontSizeToFitUtil({
              transform: element.transform,
              settings: {
                fontSize: element.settings.fontSize,
                content: element.settings.content,
                textStyle: element.settings.textStyle as any,
                styleCase: element.settings.styleCase as any,
              },
            })
            if (fitted > 0) {
              element.settings.fontSize = fitted
            }
          }
        }

        element.settings.productionSafe = true
        return element
      })
    )

    return composition
  }

  private createCacheKey(styleMapping: StyleMapping, productContext: ProductContext): string {
    const elementsSignature = styleMapping.elements.map(e => ({
      id: e.id,
      type: e.type,
      label: e.styleSettings?.storefrontLabel,
      semanticRole: e.semanticContext?.role,
      relationships: e.semanticContext?.connectionTo,
    }))

    const styleHash = JSON.stringify({
      productType: productContext.type,
      canvas: {
        w: productContext.printableAreas.width,
        h: productContext.printableAreas.height,
      },
      style: styleMapping.styleCharacteristics,
      composition: styleMapping.compositionGuidelines,
      scene: styleMapping.sceneContext,
      elements: elementsSignature,
    })

    return styleHash.slice(0, 500)
  }

  /** Clears the internal composition cache. */
  static clearCache(): void {
    ProductCanvasAdapter._compositionCache.clear()
  }

  /** Gets cache statistics for monitoring and performance analysis. */
  static getCacheStats() {
    return ProductCanvasAdapter._compositionCache.getStats()
  }
}

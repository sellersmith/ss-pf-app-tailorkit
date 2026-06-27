/**
 * Provides template context data for AI operations without database dependencies.
 * Used by agents to understand current template state and structure.
 */

import type { LayerDocument } from '~/models/Layer.server'
import type { TemplateDimension } from '~/types/template'
import type { Template as TemplateDocument } from '~/types/psd'

/** Minimal operation type for recent operations log */
type EditOperation = {
  target: 'template' | 'layer' | 'option_set'
  action: string
  payload: unknown
}

/** Context data structure for template editing operations */
export interface TemplateContext {
  template: {
    _id: string
    name: string
    dimension: TemplateDimension
    shopDomain: string
  }
  layers: LayerDocument[]
  activeLayer?: LayerDocument
  /**
   * Explicit targets selected by the user in UI (mention → select template/layer).
   * If provided, downstream extractors/executors should prioritize these ids
   * over any LLM-based disambiguation.
   */
  selected?: {
    templateId?: string
    layerIds?: string[]
    allowCreate?: boolean
  }
  recentOperations: EditOperation[]
}

/** Builds template context from provided data without database queries */
export class TemplateContextProvider {
  private shopDomain: string

  /** @param shopDomain The Shopify domain for this context */
  constructor(shopDomain: string) {
    this.shopDomain = shopDomain
  }

  /**
   * Build template context from provided editor data without database fetch.
   * @param input Template document and optional layers
   * @returns Promise resolving to template context
   * @throws Error if template is missing _id
   */
  async getContextFromProvidedTemplate(input: {
    template: TemplateDocument
    layers?: LayerDocument[]
  }): Promise<TemplateContext> {
    const { template, layers } = input

    if (!template?._id) {
      throw new Error('Provided template is missing _id')
    }

    const resolvedLayers: LayerDocument[] = (layers as any) || (template as any).layers || []
    const activeLayer = this.determineActiveLayer(resolvedLayers)

    return {
      template: {
        _id: template._id,
        name: template.name,
        dimension: template.dimension,
        shopDomain: (template as any).shopDomain || this.shopDomain,
      },
      layers: resolvedLayers,
      activeLayer,
      recentOperations: [],
    }
  }

  /** @param layers Available layers array
   * @returns First layer as active layer, or undefined if empty */
  private determineActiveLayer(layers: LayerDocument[]): LayerDocument | undefined {
    return layers[0]
  }
}

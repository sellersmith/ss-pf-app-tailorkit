import type { PrintArea } from '~/types/integration'
import { DEFAULT_TEMPLATE_DIMENSION, DEFAULT_TEMPLATE_EDITOR_STORE } from '~/stores/modules/template'
import { generateDefaultTemplateName } from '../components/Canvas/components/PrintAreasBar/utils/generateDefaultTemplateName'
import { computePreviewProductImageFromLayer } from '../components/IntegrationInspector/Integrate/ModalTemplateSelection/previewPlacement'
import type { IProduct } from '~/types/shopify-product'
import { uuid } from '~/utils/uuid'
import type { TextSettings, Template } from '~/types/psd'
import { ELayerType, EOptionSet } from '~/types/psd'
import { DEFAULT_TEXT_STORE_FRONT_LABEL, DEFAULT_CURVE_BEND } from '~/constants/inspector/text'
import { createLayerStore } from '~/stores/modules/layer'
import type { TLayerStore } from '~/stores/modules/layer'

/**
 * Check if a print area has a valid template
 */
export function hasTemplate(template: unknown): boolean {
  if (!template) return false
  if (typeof template === 'string' && template.length > 0) return true
  if (typeof template === 'object' && template !== null && '_id' in template) return true
  return false
}

/**
 * Extract template ID from template (string or object)
 */
export function getTemplateId(template: unknown): string {
  if (typeof template === 'string') return template
  if (typeof template === 'object' && template !== null && '_id' in template) {
    return String((template as { _id: string })._id)
  }
  return ''
}

/**
 * Ensure template has preview product image
 */
export function ensureTemplateHasPreviewProductImage(
  featuredProductImage: IProduct['featuredImage'] | null,
  template: any
): any {
  if (template && !template?.previewProductImage && featuredProductImage) {
    template.previewProductImage = computePreviewProductImageFromLayer({
      previewSeed: {
        src: featuredProductImage?.url || '',
        altText: featuredProductImage?.altText || 'Product preview',
      },
      productImageDimension: {
        width: featuredProductImage?.width || 0,
        height: featuredProductImage?.height || 0,
      },
      canvas: {
        width: template?.dimension?.width || 0,
        height: template?.dimension?.height || 0,
      },
      skipLayerStoreCalculations: true,
    })
  }

  return template
}

/**
 * Create default text layer for template
 */
export function createDefaultTextLayerForTemplate(
  templateWidth: number,
  templateHeight: number,
  shopDomain: string
): TLayerStore {
  const layerId = uuid()
  const optionSetId = uuid()

  // Fixed text layer size: 716 x 306px, centered in template
  const width = 716
  const height = 306
  const top = Math.round((templateHeight - height) / 2)
  const left = Math.round((templateWidth - width) / 2)

  const layerDocument = {
    _id: layerId,
    type: ELayerType.TEXT,
    label: 'Text',
    top,
    left,
    width,
    height,
    rotate: 0,
    visible: true,
    parent: '',
    shopDomain,
    optionSet: [
      {
        _id: optionSetId,
        type: EOptionSet.TEXT_OPTION,
        data: null,
        label: '',
        labelOnStoreFront: DEFAULT_TEXT_STORE_FRONT_LABEL,
        shopDomain,
      },
    ],
    settings: {
      content: 'Custom text',
      fontFamily: {
        family: 'Special Elite',
        src: 'https://fonts.gstatic.com/s/specialelite/v19/XLYgIZbkc4JPUL5CVArUVL0nhncESXFtUsM.ttf',
      },
      fontSize: 75,
      textColor: '#000000',
      textShape: 'curve',
      curveBend: DEFAULT_CURVE_BEND,
    } as TextSettings,
  }

  return createLayerStore(layerDocument as any)
}

/**
 * Create default template for a variant/print area
 */
export function createDefaultTemplate(
  variant: any,
  defaultDimension: { width: number; height: number },
  allPrintAreas: PrintArea[] = [],
  featuredProductImage: IProduct['featuredImage'] | null = null,
  includeDefaultTextLayer: boolean = false,
  shopDomain: string = ''
): any {
  const defaultTemplate: Omit<Template, 'shopDomain' | 'psds' | 'previewUrl' | 'previewProductImage'> = {
    ...DEFAULT_TEMPLATE_EDITOR_STORE,
    _id: uuid(),
    dimension: {
      ...DEFAULT_TEMPLATE_DIMENSION,
      ...defaultDimension,
    },
    name: generateDefaultTemplateName(variant?.product?.title, variant?.title, allPrintAreas),
    layers: [],
  }

  /** Temporarily disable default text layer creation */
  // // Add default text layer if needed
  // if (includeDefaultTextLayer && shopDomain) {
  //   const textLayerStore = createDefaultTextLayerForTemplate(
  //     defaultTemplate.dimension.width,
  //     defaultTemplate.dimension.height,
  //     shopDomain
  //   )
  //   // Convert layer store to layer document for serialization
  //   const textLayerDocument = textLayerStore.getState() as any
  //   defaultTemplate.layers = [textLayerDocument]
  // }

  const finalTemplate = ensureTemplateHasPreviewProductImage(featuredProductImage, defaultTemplate)

  return finalTemplate
}

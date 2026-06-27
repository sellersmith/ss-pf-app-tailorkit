import fetchProductVariantsByIds from '~/modules/modals/ProductNVariantSelector/utilities/fetchProductVariantsByVariantIds'
import { IntegrationsService } from '~/api/services/integrations'
import { getIdNumberFromIdString } from '~/shopify/fns'
import type { TLayerIntegrationStore } from '~/stores/modules/integration/layerIntegration'
import {
  createLayerIntegrationStore,
  getLayerIntegrationStoreById,
} from '~/stores/modules/integration/layerIntegration'
import type { VariantIntegration } from '~/types/integration'
import { INTEGRATION_SCREEN_ERRORS } from '../constants'
import type { IProduct } from '~/types/shopify-product'
import { DEFAULT_TEMPLATE_DIMENSION } from '~/stores/modules/template'
import { ensureTemplateHasPreviewProductImage, hasTemplate, createDefaultTemplate } from './templateHelpers'
import { ensureLayerIntegrationHasTemplate } from './integrationHelpers'
import { markEditedTemplate, storeTemplateSnapshot } from '../hooks/editedTemplatesTracker'

/**
 * Fetch variants with product data, with fallback to product fetch
 */
export async function fetchVariantsWithProductData(
  variantIds: string[],
  currentVariants: VariantIntegration[]
): Promise<{ variants: any[]; fallbackProduct: IProduct | null }> {
  let variantsWithProductData = await fetchProductVariantsByIds({ variantIds })
  let fallbackProductData: IProduct | null = null

  // Fallback: fetch product by productId if variants not found
  if (!variantsWithProductData?.variants?.length && currentVariants.length > 0) {
    try {
      const productId = currentVariants[0].productId
      const numericProductId = getIdNumberFromIdString(productId)
      if (numericProductId) {
        const { product } = await IntegrationsService.getProductByProductId(String(numericProductId))
        fallbackProductData = product
      }
    } catch (error) {
      console.error('[variantProcessing] Error fetching product fallback:', error)
    }
    variantsWithProductData = { variants: [] }
  }

  return {
    variants: variantsWithProductData.variants || [],
    fallbackProduct: fallbackProductData,
  }
}

/**
 * Process layers for a variant
 */
export function processVariantLayers(
  layers: any[],
  actualProduct: any,
  mockupId: string,
  setValidationErrors?: (id: string, dataKey: string, error: Error | string | null) => void
): any[] {
  return layers.map((layerIntegration: any) => {
    if (typeof (layerIntegration as TLayerIntegrationStore).getState === 'function') {
      return layerIntegration
    }

    const layerId = layerIntegration._id
    const existingLayerStore = getLayerIntegrationStoreById(layerId)
    if (existingLayerStore) return existingLayerStore

    const templateData = layerIntegration.data?.template ?? layerIntegration.data?.templateId
    const _templateData = ensureTemplateHasPreviewProductImage(actualProduct?.featuredImage, templateData as any)

    if (templateData?.deletedAt && setValidationErrors) {
      setValidationErrors(
        mockupId,
        `${layerId}:${INTEGRATION_SCREEN_ERRORS.TEMPLATE_IS_NOT_AVAILABLE}`,
        INTEGRATION_SCREEN_ERRORS.TEMPLATE_IS_NOT_AVAILABLE
      )
    }

    return createLayerIntegrationStore({
      ...layerIntegration,
      data: {
        ...layerIntegration.data,
        ...(_templateData ? { template: _templateData } : {}),
      },
    })
  })
}

/**
 * Process print areas for a variant, ensuring all have templates
 */
export function processVariantPrintAreas(
  printAreas: any[],
  variant: VariantIntegration,
  actualProduct: any,
  layers: any[],
  selectedPrintAreaId?: string,
  shopDomain: string = ''
): any[] {
  const printAreasWithTemplate: any[] = []

  for (let index = 0; index < printAreas.length; index++) {
    const pa = printAreas[index]
    const _template = ensureTemplateHasPreviewProductImage(actualProduct?.featuredImage, pa?.template as any)
    pa.template = _template

    if (hasTemplate(pa?.template)) {
      printAreasWithTemplate.push(pa)
      ensureLayerIntegrationHasTemplate(layers, pa._id, pa.template)
      continue
    }

    // Check if this is the selected print area (for default text layer)
    const isSelectedPrintArea = selectedPrintAreaId ? pa._id === selectedPrintAreaId : false

    // Create default template for print area
    const templateForPrintArea = createDefaultTemplate(
      variant,
      {
        width: pa.width || actualProduct?.featuredImage?.width || DEFAULT_TEMPLATE_DIMENSION.width,
        height: pa.height || actualProduct?.featuredImage?.height || DEFAULT_TEMPLATE_DIMENSION.height,
      },
      printAreasWithTemplate,
      actualProduct?.featuredImage,
      isSelectedPrintArea,
      shopDomain
    )

    // Mark default template as edited so it gets saved
    markEditedTemplate(templateForPrintArea._id, variant.mockup._id, pa._id)

    // Store snapshot for fast save without switching
    storeTemplateSnapshot(
      templateForPrintArea._id,
      [], // Empty layers for default template
      templateForPrintArea, // Template editor state
      '' // No preview URL yet
    )

    // Ensure LayerIntegration has data.template for this print area
    ensureLayerIntegrationHasTemplate(layers, pa._id, templateForPrintArea as any)

    printAreasWithTemplate.push({ ...pa, template: templateForPrintArea })
  }

  return printAreasWithTemplate
}

/**
 * Format variant with layers and templates
 */
export async function formatVariant(
  variant: VariantIntegration,
  shopifyVariant: any,
  actualProduct: IProduct | null,
  setValidationErrors?: (id: string, dataKey: string, error: Error | string | null) => void,
  selectedPrintAreaId?: string,
  shopDomain: string = ''
): Promise<any> {
  const mockupId = variant.mockup._id

  // Process layers
  const layers = processVariantLayers(variant.mockup.layers, actualProduct, mockupId, setValidationErrors)

  // Process print areas
  const printAreasWithTemplate = processVariantPrintAreas(
    variant.printAreas || [],
    variant,
    actualProduct,
    layers,
    selectedPrintAreaId,
    shopDomain
  )

  const views = Array.isArray((variant.mockup as any).views) ? (variant.mockup as any).views : undefined

  return {
    ...variant,
    ...shopifyVariant,
    product: actualProduct,
    printAreas: printAreasWithTemplate,
    productActivated: true,
    mockup: {
      ...variant.mockup,
      layers,
      views,
      selectedViewId: views?.[0]?._id,
    },
  }
}

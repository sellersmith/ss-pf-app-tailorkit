import { uuid } from '~/utils/uuid'
import { DEFAULT_PRINT_AREA } from '~/stores/modules/integration/integration'
import { createTemplateLayerIntegration, validateClipartData } from './layerIntegrationFactory'
import { storeTemporaryIntegration } from './temporaryIntegration'
import fetchProductVariantsByIds from '~/modules/modals/ProductNVariantSelector/utilities/fetchProductVariantsByVariantIds'
import type { ProductRecommendationData } from '~/components/AIChat/fns'
import type { Template } from '~/types/psd'
// Types removed since we're only creating objects, not using type annotations
import { getVariantMetafields, checkIsImportedProduct } from '~/modules/ProductEditor/utilities/getVariantMetafields'
import { DEFAULT_LAYER_INTEGRATION } from '~/stores/modules/integration/layerIntegration'
import { evaluatePlaceholderDimensionPositionOnFeaturedImage } from '~/modules/ProductEditor/utilities/evaluatePlaceholderOnFeaturedImage'
import { NavMenuItems } from '~/bootstrap/app-config'

export interface IntegrationConfig {
  templateId: string
  templateDetail?: Template
  variantIds: string[]
  productId: string
  clipartData?: ProductRecommendationData['clipart']
  title?: string
}

/**
 * Create default print area and layer for non-imported products
 */
function createDefaultPrintAreaAndLayer(templateDetail: any, validated: any): { printAreas: any[]; layers: any[] } {
  const printAreaId = uuid()

  /** Temporarily disable default text layer creation */
  // Check if template is empty (no layers) and add default text layer if needed
  // let finalTemplate = templateDetail
  // const isTemplateEmpty = templateDetail && hasTemplate(templateDetail) && !templateDetail.layers?.length

  // if (isTemplateEmpty) {
  //   const shopDomain = shopifyGlobal?.config?.shop || ''

  //   if (shopDomain) {
  //     const templateWidth = validated?.dimensions.width || DEFAULT_PRINT_AREA.width
  //     const templateHeight = validated?.dimensions.height || DEFAULT_PRINT_AREA.height

  //     const textLayerStore = createDefaultTextLayerForTemplate(templateWidth, templateHeight, shopDomain)
  //     // Convert layer store to layer document for serialization
  //     const textLayerDocument = textLayerStore.getState() as any

  //     finalTemplate = {
  //       ...templateDetail,
  //       layers: [textLayerDocument],
  //     }
  //   }
  // }

  const defaultPrintArea = {
    ...DEFAULT_PRINT_AREA,
    _id: printAreaId,
    name: 'Front',
    width: validated?.dimensions.width || DEFAULT_PRINT_AREA.width,
    height: validated?.dimensions.height || DEFAULT_PRINT_AREA.height,
    template: templateDetail,
  }

  const defaultLayer = createTemplateLayerIntegration({
    printAreaId,
    x: validated?.position.x || 0,
    y: validated?.position.y || 0,
    width: validated?.dimensions.width || DEFAULT_PRINT_AREA.width,
    height: validated?.dimensions.height || DEFAULT_PRINT_AREA.height,
    rotation: validated?.rotation || 0,
    template: templateDetail,
  })

  return { printAreas: [defaultPrintArea], layers: [defaultLayer] }
}

/**
 * Create print area from Printify placeholder data
 */
function createPrintAreaFromPlaceholder(placeholder: any, index: number, templateDetail: any): any {
  const printAreaId = uuid()

  /** Temporarily disable default text layer creation */
  // // Only add template to first print area
  // let finalTemplate = index === 0 ? templateDetail : null

  // // Check if template is empty (no layers) and add default text layer if needed (only for first print area)
  // if (finalTemplate && index === 0) {
  //   const isTemplateEmpty = hasTemplate(finalTemplate) && !finalTemplate.layers?.length

  //   if (isTemplateEmpty) {
  //     const shopDomain = shopifyGlobal?.config?.shop || ''

  //     if (shopDomain) {
  //       const templateWidth = placeholder.width || DEFAULT_PRINT_AREA.width
  //       const templateHeight = placeholder.height || DEFAULT_PRINT_AREA.height

  //       const textLayerStore = createDefaultTextLayerForTemplate(templateWidth, templateHeight, shopDomain)
  //       // Convert layer store to layer document for serialization
  //       const textLayerDocument = textLayerStore.getState() as any

  //       finalTemplate = {
  //         ...finalTemplate,
  //         layers: [textLayerDocument],
  //       }
  //     }
  //   }
  // }

  return {
    printAreaId,
    printArea: {
      _id: printAreaId,
      name: placeholder.position || `Area ${index + 1}`,
      width: placeholder.width || DEFAULT_PRINT_AREA.width,
      height: placeholder.height || DEFAULT_PRINT_AREA.height,
      template: templateDetail,
    },
  }
}

/**
 * Create layer from Printify placeholder data
 */
function createLayerFromPlaceholder(
  placeholder: any,
  index: number,
  printAreaId: string,
  templateDetail: any,
  validated: any,
  product: any
): any {
  if (index === 0) {
    // For the first print area, create template layer with positioning
    return createTemplateLayerIntegration({
      printAreaId,
      x: validated?.position.x || 0,
      y: validated?.position.y || 0,
      width: validated?.dimensions.width || placeholder.width || DEFAULT_PRINT_AREA.width,
      height: validated?.dimensions.height || placeholder.height || DEFAULT_PRINT_AREA.height,
      rotation: validated?.rotation || 0,
      template: templateDetail,
    })
  }

  // For other print areas, create default layer
  const featuredImageWidth = product?.featuredImage?.width || DEFAULT_LAYER_INTEGRATION.width
  const featuredImageHeight = product?.featuredImage?.height || DEFAULT_LAYER_INTEGRATION.height

  const evaluatedPlaceholderDimensionPosition = evaluatePlaceholderDimensionPositionOnFeaturedImage(placeholder, {
    width: featuredImageWidth,
    height: featuredImageHeight,
  })

  return createTemplateLayerIntegration({
    printAreaId,
    x: evaluatedPlaceholderDimensionPosition.x || 0,
    y: evaluatedPlaceholderDimensionPosition.y || 0,
    width: evaluatedPlaceholderDimensionPosition.width || placeholder.width || DEFAULT_PRINT_AREA.width,
    height: evaluatedPlaceholderDimensionPosition.height || placeholder.height || DEFAULT_PRINT_AREA.height,
    rotation: 0, // No rotation for secondary print areas
    template: undefined, // No template for secondary print areas
  })
}

/**
 * Parse existing print areas from metafield data (similar to parseMetafieldLayersAndPrintAreas)
 */
async function parseExistingPrintAreasFromMetafields(
  variantIds: string[],
  product: any,
  templateDetail: any,
  validated: any
): Promise<{ printAreas: any[]; layers: any[] }> {
  const printAreas: any[] = []
  const layers: any[] = []

  // Check if this is an imported product
  const isImportedProduct = checkIsImportedProduct(product)

  if (!isImportedProduct) {
    // Not an imported product - create default print area
    return createDefaultPrintAreaAndLayer(templateDetail, validated)
  }

  // Get variant metafields for imported products (only fetch first variant since all have similar structure)
  try {
    const firstVariantId = variantIds[0]
    const groupVariantMetafields = await getVariantMetafields({ variantIds: [firstVariantId] })
    const metafield = groupVariantMetafields?.[firstVariantId]

    // Early return if no valid metafield data
    if (!metafield?.type || metafield.type !== 'json') {
      return createDefaultPrintAreaAndLayer(templateDetail, validated)
    }

    // Continue with metafield processing
    {
      // Parse existing print areas from metafield
      let parsedValue: any
      try {
        parsedValue = typeof metafield.value === 'string' ? JSON.parse(metafield.value) : metafield.value
      } catch (parseError) {
        console.error('Failed to parse metafield JSON value:', parseError, { metafieldValue: metafield.value })
        return createDefaultPrintAreaAndLayer(templateDetail, validated)
      }

      const placeholders = (parsedValue?.placeholders || []) as any[]

      // Early return if no placeholders found
      if (!placeholders.length) {
        return createDefaultPrintAreaAndLayer(templateDetail, validated)
      }

      // Create print areas and layers for each placeholder position
      placeholders.forEach((placeholder, index) => {
        // Create print area for this position (front, back, etc.)
        const { printAreaId, printArea } = createPrintAreaFromPlaceholder(placeholder, index, templateDetail)
        printAreas.push(printArea)

        // Create layer for the print area position
        const layer = createLayerFromPlaceholder(placeholder, index, printAreaId, templateDetail, validated, product)
        layers.push(layer)
      })
    }
  } catch (error: any) {
    // Handle specific error types with more context
    if (error instanceof SyntaxError) {
      console.error('Error parsing metafield JSON:', error.message)
    } else if (error?.name === 'TypeError') {
      console.error('Error accessing metafield properties:', error.message, { variantIds })
    } else {
      console.error('Error fetching or processing variant metafields:', error)
    }

    // Always return default on any error to ensure integration continues
    return createDefaultPrintAreaAndLayer(templateDetail, validated)
  }

  return { printAreas, layers }
}

/**
 * Build and store a temporary integration with pre-filled template
 * Preserves existing print areas from Printify products
 * @param config - Integration configuration
 * @returns Integration URL for navigation
 */
export async function buildTemporaryIntegration(config: IntegrationConfig): Promise<string> {
  const {
    templateId,
    templateDetail: providedTemplateDetail,
    variantIds,
    productId,
    clipartData,
    title = 'AI Generated Design',
  } = config

  // Validate clipart data if provided
  const validated = clipartData ? validateClipartData(clipartData) : null

  // Generate IDs
  const integrationId = uuid()
  const mockupId = uuid()

  // Fetch data in parallel if template detail not provided
  const [fetchedVariants, templateRes] = await Promise.all([
    fetchProductVariantsByIds({ variantIds }),
    providedTemplateDetail
      ? Promise.resolve({ data: providedTemplateDetail })
      : (async () => {
          const { TemplatesService } = await import('~/api/services/templates')
          const data = await TemplatesService.getById(templateId)
          return { data }
        })(),
  ])

  const shopifyVariants = fetchedVariants?.variants || []
  const templateDetail = templateRes?.data || { _id: templateId }

  if (!shopifyVariants.length) {
    throw new Error('No valid product variants found')
  }

  // Get the product details from the first variant to check for existing print areas
  const firstVariant = shopifyVariants[0]
  const product = firstVariant?.product

  // Parse existing print areas or create default ones
  const { printAreas, layers } = await parseExistingPrintAreasFromMetafields(
    variantIds,
    product,
    templateDetail,
    validated
  )

  const normalizedPrintAreas = Array.isArray(printAreas) ? printAreas : []
  const printAreaWithTemplate = normalizedPrintAreas.find(
    (printArea: any) => printArea?.template && typeof printArea.template === 'object' && printArea.template._id
  )

  const printAreaIdForUrl = printAreaWithTemplate?._id || normalizedPrintAreas[0]?._id || ''
  const templateIdForUrl
    = (printAreaWithTemplate?.template && (printAreaWithTemplate.template as any)._id)
    || (templateDetail as any)?._id
    || templateId

  // Build a default view so editor/preview can persist per-view overrides
  const defaultViewId = uuid()
  const layerIdsForView = (layers || [])
    .map((l: any) => {
      try {
        return typeof l?.getState === 'function' ? l.getState()._id : l?._id
      } catch {
        return l?._id
      }
    })
    .filter(Boolean)

  // Build variants with mockup and print areas
  const tempVariants = shopifyVariants.map((shopifyVariant: any) => ({
    ...shopifyVariant,
    _id: uuid(),
    productId,
    productActivated: true,
    printAreas, // Use the parsed print areas (preserves existing ones)
    mockup: {
      _id: mockupId,
      label: '',
      layers, // Use the generated layers
      // Frontend-only hydrated data for editor/renderer
      views: [
        {
          _id: defaultViewId,
          mockup: mockupId,
          title: 'Default view',
          baseImage: undefined,
          backgroundImage: undefined,
          maskImage: undefined,
          enableClippingMask: false,
          layers: layerIdsForView,
          overrides: {},
        },
      ],
      selectedViewId: defaultViewId,
    },
  }))

  // Create temporary integration object
  const temporaryIntegration = {
    _id: integrationId,
    title,
    variants: tempVariants,
    publishedAt: null,
    viewport: { left: 0, top: 0, scale: 1 },
    selectedTab: 0,
    config: {
      shouldNotShowModalConfirmPublishAgain: false,
      shouldNotShowModalConfirmRePublishAgain: false,
    },
    previewMode: false,
    allVariantsIntegrated: [],
    variantIdsPublished: [],
  }

  // Store temporary integration
  await storeTemporaryIntegration(temporaryIntegration, mockupId)

  // Return integration URL for navigation
  const searchParams = new URLSearchParams({
    mockup: mockupId,
    showSuccessMessage: 'true',
  })

  if (printAreaIdForUrl) {
    searchParams.set('printAreaId', printAreaIdForUrl)
  }

  if (templateIdForUrl) {
    searchParams.set('templateId', templateIdForUrl)
  }

  searchParams.set('tab', 'design')

  return `${NavMenuItems.PERSONALIZED_PRODUCTS}/${integrationId}?${searchParams.toString()}`
}

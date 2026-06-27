import { FULFILLMENT_PROVIDERS } from '~/constants/fulfillment-providers'
import getProductsListFromVariants from '~/modules/modals/ProductNVariantSelector/utilities/getProductListFromVariants'
import { DEFAULT_PRINT_AREA } from '~/stores/modules/integration/integration'
import type { TLayerIntegrationStore } from '~/stores/modules/integration/layerIntegration'
import { createLayerIntegrationStore, DEFAULT_LAYER_INTEGRATION } from '~/stores/modules/integration/layerIntegration'
import type {
  ImportedProductMetaField,
  ImportedProductMetaFieldValue,
  PrintArea,
  VariantIntegration,
} from '~/types/integration'
import type { IProduct, IVariant } from '~/types/shopify-product'
import { uuid } from '~/utils/uuid'
import { evaluatePlaceholderDimensionPositionOnFeaturedImage } from './evaluatePlaceholderOnFeaturedImage'
import { getVariantMetafields } from './getVariantMetafields'
import { hasTemplate } from './templateHelpers'

// Constants for Magic Values
const JSON_TYPE = 'json'
const PLACEHOLDERS_KEY = 'placeholders'
const POSITION_KEY = 'position'

type GetVariantsSelectedWithNewMockupParams = {
  variantsSelected: IVariant[]
  mockupIdFromSearchParams?: string
  seedTemplateDimensionPx?: { width: number; height: number } | null
  prebuiltPrintAreasByVariantId?: Record<string, PrintArea[]>
  createTemplateForPrintArea?: (
    printArea: PrintArea,
    variant: IVariant,
    product: IProduct,
    allPrintAreas?: PrintArea[]
  ) => unknown
  selectedPrintAreaId?: string
  shopDomain?: string
}

/**
 * Builds variants with mockup/print area data based on selected variants.
 */
export async function getVariantsSelectedWithNewMockup({
  variantsSelected,
  mockupIdFromSearchParams,
  seedTemplateDimensionPx,
  prebuiltPrintAreasByVariantId,
  createTemplateForPrintArea,
  selectedPrintAreaId,
  shopDomain = '',
}: GetVariantsSelectedWithNewMockupParams): Promise<VariantIntegration[]> {
  const productsList = getProductsListFromVariants(variantsSelected)

  const variantsSelectedWithMockup = await Promise.all(
    productsList.map(async (product, index) => {
      const mockupId = index === 0 && mockupIdFromSearchParams ? mockupIdFromSearchParams : uuid()
      const isImportedProduct = FULFILLMENT_PROVIDERS.includes(product.vendor)

      let groupVariantMetafields: Record<string, any> | null = null
      if (isImportedProduct) {
        try {
          const variantIds = product.variants.map(variant => variant.id)
          groupVariantMetafields = await getVariantMetafields({ variantIds })
        } catch (error) {
          console.error('Error fetching metafields:', error)
        }
      }

      return formatVariantsWithMockup(
        product,
        mockupId,
        groupVariantMetafields,
        isImportedProduct,
        seedTemplateDimensionPx,
        prebuiltPrintAreasByVariantId,
        createTemplateForPrintArea,
        selectedPrintAreaId,
        shopDomain
      )
    })
  )

  const flattenedVariants = variantsSelectedWithMockup.flat()
  return flattenedVariants
}

function formatVariantsWithMockup(
  product: any,
  mockupId: string,
  groupVariantMetafields: Record<string, any> | null,
  isImportedProduct: boolean,
  seedTemplateDimensionPx?: { width: number; height: number } | null,
  prebuiltPrintAreasByVariantId?: Record<string, PrintArea[]>,
  createTemplateForPrintArea?: (
    printArea: PrintArea,
    variant: IVariant,
    product: IProduct,
    allPrintAreas?: PrintArea[]
  ) => any,
  selectedPrintAreaId?: string,
  shopDomain: string = ''
): VariantIntegration[] {
  const printAreas: any[] = []
  const layers: any[] = []

  return product.variants.map((variant: any) => {
    const metafield = groupVariantMetafields?.[variant.id]
    const hasMetafields = isImportedProduct && metafield?.type === JSON_TYPE

    // Ensure printAreas are only populated if they are not already defined
    if (printAreas.length === 0) {
      // Priority 1: For imported products (Printify), parse metafields first to get all print areas
      // This ensures multiple print areas from metafields are preserved
      if (hasMetafields) {
        parseMetafieldLayersAndPrintAreas(
          metafield.value,
          printAreas,
          layers,
          product,
          variant,
          createTemplateForPrintArea
            ? (printArea: PrintArea, variantParam: IVariant, productParam: IProduct, allPrintAreas: PrintArea[]) =>
                createTemplateForPrintArea(printArea, variantParam, productParam, allPrintAreas)
            : undefined,
          prebuiltPrintAreasByVariantId,
          selectedPrintAreaId,
          shopDomain
        )
      }
      // Priority 2: Use prebuilt print areas if no metafields were parsed
      // This handles non-imported products or imported products without metafields
      else {
        const prebuilt = prebuiltPrintAreasByVariantId?.[variant.id]
        if (Array.isArray(prebuilt) && prebuilt.length > 0) {
          // Use prebuilt print areas and maintain their IDs
          prebuilt.forEach(pa => {
            // Resolve dimensions if not provided in prebuilt
            const resolvedWidth
              = pa.width || variant?.image?.width || product?.featuredImage?.width || DEFAULT_LAYER_INTEGRATION.width
            const resolvedHeight
              = pa.height || variant?.image?.height || product?.featuredImage?.height || DEFAULT_LAYER_INTEGRATION.height

            // Preserve template from prebuilt print area if it exists
            // Template can be: null/undefined (no template), string ID (from saved integration), or object (full template)
            let template = pa.template
            // Only call factory if template is truly missing (not a valid string ID or object)
            if (!hasTemplate(template) && createTemplateForPrintArea) {
              const printAreaWithDimensions = { ...pa, width: resolvedWidth, height: resolvedHeight }
              template = createTemplateForPrintArea(printAreaWithDimensions, variant, product, printAreas)
            }

            printAreas.push({
              ...DEFAULT_PRINT_AREA,
              ...pa,
              // Preserve print area name from metafield/prebuilt (important for Printify products)
              // Use pa.name if it exists and is not empty, otherwise use default
              name: pa.name && pa.name.trim() ? pa.name : DEFAULT_PRINT_AREA.name,
              width: resolvedWidth,
              height: resolvedHeight,
              template: template || null,
            })

            // Extract templateId from template (can be string or object)
            const templateId = typeof template === 'string' ? template : template?._id

            const layer = createLayerIntegrationStore({
              ...DEFAULT_LAYER_INTEGRATION,
              x: 0,
              y: 0,
              width: resolvedWidth,
              height: resolvedHeight,
              printAreaId: pa._id,
              _id: uuid(),
              layerId: uuid(),
              type: templateId ? 'template' : DEFAULT_LAYER_INTEGRATION.type,
              data: templateId
                ? {
                    ...(typeof template === 'object' && template ? { template } : {}),
                  }
                : undefined,
            })
            layers.push(layer)
          })
        }
        // Priority 3: Create default print area if no prebuilt print areas exist
        else {
          createDefaultLayersAndPrintAreas(
            printAreas,
            layers,
            product,
            variant,
            seedTemplateDimensionPx,
            createTemplateForPrintArea,
            selectedPrintAreaId,
            shopDomain
          )
        }
      }
    }

    // Build a default view for this mockup so every new integration starts with at least one view
    const defaultViewId = uuid()
    const layerIdsForView = layers
      .map((l: any) => {
        try {
          return typeof l?.getState === 'function' ? l.getState()._id : l?._id
        } catch {
          return l?._id
        }
      })
      .filter(Boolean)

    const mockup = {
      _id: mockupId,
      label: '',
      layers,
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
    }

    return {
      ...variant,
      // Always set product activated to true
      productActivated: true,
      _id: uuid(),
      productId: product.id,
      id: variant.id,
      printAreas,
      mockup,
    }
  })
}

function createDefaultLayersAndPrintAreas(
  printAreas: PrintArea[],
  layers: TLayerIntegrationStore[],
  product: IProduct,
  variant: IVariant,
  seedTemplateDimensionPx?: { width: number; height: number } | null,
  createTemplateForPrintArea?: (
    printArea: PrintArea,
    variant: IVariant,
    product: IProduct,
    allPrintAreas?: PrintArea[]
  ) => any,
  selectedPrintAreaId?: string,
  shopDomain: string = ''
): void {
  const printAreaId = uuid()
  const layerId = uuid()

  const variantImage = variant?.image
  const featuredImage = product?.featuredImage

  const resolvedWidth
    = seedTemplateDimensionPx?.width || variantImage?.width || featuredImage?.width || DEFAULT_LAYER_INTEGRATION.width
  const resolvedHeight
    = seedTemplateDimensionPx?.height || variantImage?.height || featuredImage?.height || DEFAULT_LAYER_INTEGRATION.height

  const isImportedProduct = FULFILLMENT_PROVIDERS.includes(product.vendor)

  const layerDimensionPosition = isImportedProduct
    ? evaluatePlaceholderDimensionPositionOnFeaturedImage(
        { ...DEFAULT_LAYER_INTEGRATION, width: resolvedWidth, height: resolvedHeight },
        {
          width: featuredImage?.width || resolvedWidth,
          height: featuredImage?.height || resolvedHeight,
        }
      )
    : {
        ...DEFAULT_LAYER_INTEGRATION,
        x: 0,
        y: 0,
        width: resolvedWidth,
        height: resolvedHeight,
      }

  const defaultLayer = createLayerIntegrationStore({
    ...DEFAULT_LAYER_INTEGRATION,
    ...layerDimensionPosition,
    printAreaId,
    _id: layerId,
    layerId,
  })

  const printAreaName = variant?.displayName || variant?.title || product?.title || DEFAULT_PRINT_AREA.name

  // Create print area first
  const printArea: PrintArea = {
    ...DEFAULT_PRINT_AREA,
    _id: printAreaId,
    name: printAreaName,
    width: resolvedWidth,
    height: resolvedHeight,
    template: null, // Will be set below
  }

  // Create template for this print area if function provided
  if (createTemplateForPrintArea) {
    printArea.template = createTemplateForPrintArea(printArea, variant, product, printAreas)
  }

  printAreas.push(printArea)

  // Extract templateId from template (can be string or object)
  const templateId = typeof printArea.template === 'string' ? printArea.template : printArea.template?._id

  // Update defaultLayer to include template if template exists
  if (templateId && typeof defaultLayer.dispatch === 'function') {
    const currentState = defaultLayer.getState()
    defaultLayer.dispatch({
      type: 'UPDATE_LAYER',
      payload: {
        state: {
          type: 'template',
          data: {
            ...currentState.data,
            ...(typeof printArea.template === 'object' && printArea.template ? { template: printArea.template } : {}),
          },
        },
      },
    })
  }

  layers.push(defaultLayer)
}

function parseMetafieldLayersAndPrintAreas(
  metafieldValue: ImportedProductMetaField['value'],
  printAreas: PrintArea[],
  layers: TLayerIntegrationStore[],
  product: IProduct,
  variant: IVariant,
  createTemplateForPrintArea?: (
    printArea: PrintArea,
    variant: IVariant,
    product: IProduct,
    allPrintAreas: PrintArea[]
  ) => any,
  prebuiltPrintAreasByVariantId?: Record<string, PrintArea[]>,
  selectedPrintAreaId?: string,
  shopDomain: string = ''
): void {
  const variantImage = variant?.image
  const featuredImageWidth = variantImage?.width || product.featuredImage?.width || DEFAULT_LAYER_INTEGRATION.width
  const featuredImageHeight = variantImage?.height || product.featuredImage?.height || DEFAULT_LAYER_INTEGRATION.height

  // Get prebuilt print areas for this variant to preserve IDs from URL
  const prebuiltPrintAreas = prebuiltPrintAreasByVariantId?.[variant.id] || []

  try {
    const parsedValue = typeof metafieldValue === 'string' ? JSON.parse(metafieldValue) : metafieldValue
    const placeholders = (parsedValue[PLACEHOLDERS_KEY] || []) as ImportedProductMetaFieldValue['placeholders']

    placeholders.forEach((placeholder, index) => {
      const layerId = uuid()
      // Use prebuilt print area ID if available (matching by index), otherwise generate new UUID
      // This ensures URL printAreaId matches actual print areas for Printify products
      const printAreaId = prebuiltPrintAreas[index]?._id || uuid()

      // Create print area first
      const printArea: PrintArea = {
        _id: printAreaId,
        name: placeholder[POSITION_KEY],
        width: placeholder.width,
        height: placeholder.height,
        template: null, // Will be set below
      }

      // Create template for this print area if function provided
      // Pass all existing print areas so template name can be generated with correct index
      if (createTemplateForPrintArea) {
        printArea.template = createTemplateForPrintArea(printArea, variant, product, printAreas)
      }

      printAreas.push(printArea)

      // Evaluate placeholder dimension and position on featured image
      const evaluatedPlaceholderDimensionPosition = evaluatePlaceholderDimensionPositionOnFeaturedImage(placeholder, {
        width: featuredImageWidth,
        height: featuredImageHeight,
      })

      const layer = createLayerIntegrationStore({
        ...DEFAULT_LAYER_INTEGRATION,
        // Spread the evaluated placeholder dimension and position
        ...evaluatedPlaceholderDimensionPosition,
        // Spread the print area information
        printAreaId,
        _id: layerId,
        layerId,
      })

      layers.push(layer)
    })
  } catch (error) {
    console.error('Error parsing metafield value:', error)
  }
}

import { uuid } from '~/utils/uuid'
import { convertDimensionToPixels } from '~/utils/lengthUnitToPixels'
import { DEFAULT_TEMPLATE_DIMENSION } from '~/stores/modules/template'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import {
  ensureTemplateHasPreviewProductImage,
  hasTemplate,
  createDefaultTemplate,
  getTemplateId,
} from './templateHelpers'
import { ensureLayerIntegrationHasTemplate } from './integrationHelpers'
import { markEditedTemplate, storeTemplateSnapshot } from '../hooks/editedTemplatesTracker'
import type { PrintArea } from '~/types/integration'
import type { IProduct, IVariant } from '~/types/shopify-product'
import { FULFILLMENT_PROVIDERS } from '~/constants/fulfillment-providers'

type CreateTemplateForPrintAreaFactoryParams = {
  templateSelected: unknown | null
  templateData: unknown | null
  printAreaIdFromSearchParams: string
  prebuiltPrintAreasByVariantId?: Record<string, PrintArea[]>
  mockupIdFromSearchParams?: string
  selectedPrintAreaId?: string
  shopDomain?: string
}

/**
 * Create template function for print areas in new integration.
 * Handles priority: URL printAreaId > preserve existing template (same mockup) > preserve prebuilt template > reuse existing > create new.
 * CRITICAL: Only applies templateSelected to the target printAreaId to prevent applying to all print areas.
 */
export function createTemplateForPrintAreaFactory({
  templateSelected,
  templateData,
  printAreaIdFromSearchParams,
  prebuiltPrintAreasByVariantId,
  mockupIdFromSearchParams,
  selectedPrintAreaId,
  shopDomain = '',
}: CreateTemplateForPrintAreaFactoryParams) {
  let templateSelectedApplied = false

  return (printArea: PrintArea, variant: IVariant, product: IProduct, allPrintAreas: PrintArea[] = []) => {
    // Priority 1: If print area matches printAreaIdFromSearchParams, apply templateSelected
    if (printAreaIdFromSearchParams && printArea._id === printAreaIdFromSearchParams) {
      if (templateSelected && templateData) {
        templateSelectedApplied = true
        return templateSelected
      }
    }

    // Priority 2: Check if this print area already has a template from IntegrationStore
    // IMPORTANT: Only preserve if it's from the SAME mockup
    // This is useful when re-initializing the same integration (e.g., after URL params change)
    // In fresh init flow, IntegrationStore is typically empty, so this check will skip
    // and fallback to Priority 1 (apply templateSelected) or Priority 5 (create default)
    if (mockupIdFromSearchParams) {
      const existingState = IntegrationStore.getState()
      // Only check if IntegrationStore has variants (not empty)
      if (existingState.variants && existingState.variants.length > 0) {
        for (const v of existingState.variants) {
          // Only check variants with matching mockupId
          // This ensures we only preserve templates from the same integration/mockup
          if (v.mockup?._id !== mockupIdFromSearchParams) {
            continue
          }

          const existingPrintArea = v.printAreas?.find(pa => pa._id === printArea._id)
          if (existingPrintArea?.template && hasTemplate(existingPrintArea.template)) {
            // Print area already has a template from the same mockup - preserve it
            // Only exception: if this is the target printAreaId and we have templateSelected, apply it (handled in Priority 1)
            return existingPrintArea.template
          }
        }
      }
    }

    // Priority 3: If templateSelected not applied yet AND printAreaIdFromSearchParams is set,
    // ONLY apply to the target print area (already handled in Priority 1)
    // If printAreaIdFromSearchParams is NOT set, don't apply templateSelected to avoid applying to all print areas
    // This prevents the bug where uploading PSD applies template to all print areas
    if (!templateSelectedApplied && templateSelected && templateData && printAreaIdFromSearchParams) {
      // Only apply if this is the target print area (should have been caught in Priority 1)
      // This is a safety check - if we reach here, something went wrong
      if (printArea._id === printAreaIdFromSearchParams) {
        templateSelectedApplied = true
        return templateSelected
      }
    }

    // Priority 4: Preserve template from prebuilt print areas if exists
    // This ensures templates from saved integrations are preserved
    if (prebuiltPrintAreasByVariantId && variant.id) {
      const prebuiltPrintAreas = prebuiltPrintAreasByVariantId[variant.id]
      if (Array.isArray(prebuiltPrintAreas)) {
        const prebuiltPrintArea = prebuiltPrintAreas.find(pa => pa._id === printArea._id)
        if (prebuiltPrintArea?.template) {
          // If template is a string ID, we'll need to fetch it later
          // For now, preserve it as-is (will be handled in formatVariantsWithMockup)
          return prebuiltPrintArea.template
        }
      }
    }

    // Priority 5: Reuse existing template ID from IntegrationStore or create new one
    // Note: We already checked IntegrationStore in Priority 2, but this handles the case
    // where template exists but we need to extract the ID for creating a default template
    let existingTemplateId: string | undefined

    // Re-check IntegrationStore for template ID (in case template wasn't found in Priority 2)
    const stateForIdCheck = IntegrationStore.getState()
    for (const v of stateForIdCheck.variants) {
      const existingPrintArea = v.printAreas?.find(pa => pa._id === printArea._id)
      if (existingPrintArea?.template) {
        const template = existingPrintArea.template
        if (typeof template === 'string') {
          existingTemplateId = template
        } else if (template && typeof template === 'object' && template._id) {
          existingTemplateId = template._id
        }
        break
      }
    }

    const templateId = existingTemplateId || uuid()

    // Check if this is the selected print area (for default text layer)
    const isSelectedPrintArea = selectedPrintAreaId ? printArea._id === selectedPrintAreaId : false

    // CRITICAL: Different dimension logic for POD vs normal products
    // - POD products (vendor in FULFILLMENT_PROVIDERS): Use print area dimensions OR DEFAULT (never featured image)
    // - Normal products: Use print area dimensions OR featured image OR DEFAULT

    // Check if product is from fulfillment provider (Printify, etc.)
    const vendor = product?.vendor || ''
    const isPODProduct = FULFILLMENT_PROVIDERS.includes(vendor)

    let templateWidth: number
    let templateHeight: number

    if (isPODProduct) {
      // POD product: NEVER use featured image (would be wrong 2048x2048)
      // Use print area dimensions if available, otherwise DEFAULT
      // Editor will create correct template with metafield dimensions later
      templateWidth = printArea.width || DEFAULT_TEMPLATE_DIMENSION.width
      templateHeight = printArea.height || DEFAULT_TEMPLATE_DIMENSION.height
    } else {
      // Normal product: Use print area dimensions if available, otherwise featured image, otherwise DEFAULT
      templateWidth = printArea.width || product?.featuredImage?.width || DEFAULT_TEMPLATE_DIMENSION.width
      templateHeight = printArea.height || product?.featuredImage?.height || DEFAULT_TEMPLATE_DIMENSION.height
    }

    return {
      ...createDefaultTemplate(
        variant,
        {
          width: templateWidth,
          height: templateHeight,
        },
        allPrintAreas,
        product?.featuredImage,
        isSelectedPrintArea,
        shopDomain
      ),
      _id: templateId,
    }
  }
}

/**
 * Mark default templates as edited and store snapshots
 */
export function markDefaultTemplatesAsEdited(variants: any[]): void {
  variants.forEach(variant => {
    variant.printAreas?.forEach((printArea: any) => {
      const template = printArea.template
      if (template && typeof template === 'object' && template._id) {
        const wasMarked = markEditedTemplate(template._id, variant.mockup._id, printArea._id)
        if (wasMarked) {
          // Extract layers from template if available (e.g., from IDB clipart)
          const layersState = Array.isArray(template.layers) ? template.layers : []

          const templateEditor = {
            ...template,
            extractedLayerStores: [],
            extracting: false,
            viewport: { x: 0, y: 0, scale: 1 },
            interactive: true,
            stageRef: { current: null },
            dimension: template.dimension || {
              width: printArea.width || DEFAULT_TEMPLATE_DIMENSION.width,
              height: printArea.height || DEFAULT_TEMPLATE_DIMENSION.height,
              measurementUnit: 'px',
              resolution: 300,
            },
          } as any

          const previewUrl = template.previewUrl || ''

          // Store snapshot with layers if available (preserves clipart from IDB)
          storeTemplateSnapshot(template._id, layersState, templateEditor, previewUrl)
        }

        if (template && typeof template === 'object') {
          ensureLayerIntegrationHasTemplate(variant.mockup?.layers || [], printArea._id, template)
        }
      }
    })
  })
}

/**
 * Prepare template for new integration
 */
export function prepareTemplateForNewIntegration(
  templateData: any | null,
  firstVariant: any,
  templateIdFromParams: string | undefined
): { template: any; templateDimPx: { width: number; height: number } | null } {
  let templateSelected: any | null = templateData
  let templateDimPx: { width: number; height: number } | null = null

  if (templateData?.dimension) {
    templateDimPx = convertDimensionToPixels(templateData.dimension)
  }

  const featuredProductImage = firstVariant?.product?.featuredImage
  if (firstVariant && !templateSelected) {
    templateSelected = {
      ...createDefaultTemplate(
        firstVariant,
        {
          width: templateDimPx?.width || featuredProductImage?.width || DEFAULT_TEMPLATE_DIMENSION.width,
          height: templateDimPx?.height || featuredProductImage?.height || DEFAULT_TEMPLATE_DIMENSION.height,
        },
        [],
        featuredProductImage
      ),
      _id: templateIdFromParams || uuid(),
    }
  }

  templateSelected = ensureTemplateHasPreviewProductImage(featuredProductImage, templateSelected as any)

  return { template: templateSelected, templateDimPx }
}

/**
 * Validate and get final print area ID
 */
export function getFinalPrintAreaId(
  variants: any[],
  printAreaIdFromSearchParams: string
): { printAreaId: string; templateId: string } {
  const firstVariant = variants?.[0]
  const firstPrintArea = firstVariant?.printAreas?.[0]

  const allPrintAreaIds = firstVariant?.printAreas?.map((pa: any) => pa._id) || []
  const isValidPrintAreaId = printAreaIdFromSearchParams && allPrintAreaIds.includes(printAreaIdFromSearchParams)

  const finalPrintAreaId = isValidPrintAreaId ? printAreaIdFromSearchParams : firstPrintArea?._id || ''
  const finalTemplateId = getTemplateId(firstPrintArea?.template) || ''

  return { printAreaId: finalPrintAreaId, templateId: finalTemplateId }
}

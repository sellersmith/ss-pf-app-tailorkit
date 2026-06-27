import { useEffect } from 'react'
import { TemplateEditorStore, DEFAULT_TEMPLATE_DIMENSION } from '~/stores/modules/template'
import { useInitTemplate } from '~/modules/TemplateEditor/hooks/useInitTemplate'
import type { ITemplate } from '~/modules/TemplateEditor/hooks/useInitTemplate'
import type { VariantIntegration } from '~/types/integration'
import { uuid } from '~/utils/uuid'
import { resolveProductPreviewImage } from '~/modules/ProductEditor/utilities/resolveProductPreviewImage'
import { generateDefaultTemplateName } from '../components/PrintAreasBar/utils/generateDefaultTemplateName'
import { IntegrationStore } from '~/stores/modules/integration/integration'

interface UseTemplateInitializationParams {
  targetPrintArea: any
  printAreaId: string
  enabled: boolean
  activeVariant: VariantIntegration | null
}

/**
 * Hook to handle template initialization logic
 * Encapsulates the complex initialization guard and requestAnimationFrame timing
 */
export function useTemplateInitialization(params: UseTemplateInitializationParams) {
  const { targetPrintArea, printAreaId, enabled, activeVariant } = params
  const { initTemplate, initOptionSetLists } = useInitTemplate()

  useEffect(() => {
    if (!enabled || !targetPrintArea) return

    const template = targetPrintArea.template as ITemplate
    const templateState = TemplateEditorStore.getState()
    const currentTemplateId = templateState?._id

    const needsInit = !currentTemplateId || currentTemplateId !== template?._id

    // Only skip init if SAME template AND SAME print area
    const shouldSkipInit
      = !needsInit
      && template?._id
      && currentTemplateId === template._id
      && currentTemplateId !== ''
      && targetPrintArea._id === printAreaId

    if (shouldSkipInit) {
      return
    }

    initOptionSetLists()

    // Use requestAnimationFrame to ensure smooth rendering
    requestAnimationFrame(() => {
      const baseDimension = {
        width: DEFAULT_TEMPLATE_DIMENSION.width,
        height: DEFAULT_TEMPLATE_DIMENSION.height,
        resolution: DEFAULT_TEMPLATE_DIMENSION.resolution,
        measurementUnit: DEFAULT_TEMPLATE_DIMENSION.measurementUnit,
      }

      const hasPrintAreaDimensions = targetPrintArea?.width && targetPrintArea?.height

      if (template?._id) {
        // Initialize EXISTING template
        // Keep original template dimension (do NOT auto-update to print area dimension)
        // Templates selected from library should preserve their original dimensions

        // Use template's own dimension for preview image scaling
        const templateDimensionForScaling = template.dimension
          ? { width: template.dimension.width, height: template.dimension.height }
          : undefined

        // Resolve previewProductImage with priority order:
        // 1. PrintArea.previewProductImage (user-chosen, persisted per print area)
        // 2. Resolve from product/variant image (with smart scaling)
        // 3. Legacy template.previewProductImage (deprecated)
        // 4. Fallback: null
        const previewFromPrintArea = targetPrintArea?.previewProductImage
        const previewFromVariant = resolvePreviewProductImage(activeVariant, templateDimensionForScaling)
        const previewFromTemplate = template?.previewProductImage

        const resolvedPreview = previewFromPrintArea || previewFromVariant || previewFromTemplate || null

        initTemplate({
          ...template,
          previewProductImage: resolvedPreview || undefined,
          // Preserve layers array if it exists (for default text layer)
          ...(template.layers ? { layers: template.layers } : {}),
        })

        // CRITICAL: Sync scaled preview image to IntegrationStore
        // This ensures the initial snapshot has correctly scaled preview image for discard functionality
        // Only sync if we resolved a NEW preview from variant (auto-scaled), not if using existing printArea preview
        if (!previewFromPrintArea && resolvedPreview && typeof window !== 'undefined') {
          try {
            const searchParams = new URLSearchParams(window.location.search)
            const mockupId = searchParams.get('mockup')

            if (mockupId && printAreaId) {
              IntegrationStore.dispatch({
                type: 'UPDATE_PRINT_AREA_PREVIEW_PRODUCT_IMAGE',
                payload: {
                  mockupId,
                  printAreaId,
                  previewProductImage: resolvedPreview,
                },
                skipTrace: true, // Don't create undo step - this is part of initialization
              })
            }
          } catch (error) {
            console.warn('[useTemplateInitialization] Failed to sync preview image to IntegrationStore:', error)
          }
        }
      } else {
        // Create NEW template
        // Step 1: First resolve preview image WITHOUT scaling to get natural dimensions
        const previewFromPrintArea = targetPrintArea?.previewProductImage
        const previewFromVariantRaw = resolvePreviewProductImage(activeVariant, undefined) // No scaling
        const previewFromTemplate = template?.previewProductImage

        // Step 2: Determine template dimensions
        // Priority:
        // 1. Print area dimensions (for Printify/POD products)
        // 2. Featured image natural dimensions (for normal products)
        // 3. Default dimensions (500x500)
        const finalDimension = hasPrintAreaDimensions
          ? {
              // Use print area dimensions for Printify/POD products
              width: targetPrintArea.width,
              height: targetPrintArea.height,
              resolution: baseDimension.resolution,
              measurementUnit: baseDimension.measurementUnit,
            }
          : previewFromVariantRaw
            ? {
                // Use featured image natural dimensions for normal products
                width: previewFromVariantRaw.naturalWidth || previewFromVariantRaw.width || baseDimension.width,
                height: previewFromVariantRaw.naturalHeight || previewFromVariantRaw.height || baseDimension.height,
                resolution: baseDimension.resolution,
                measurementUnit: baseDimension.measurementUnit,
              }
            : { ...baseDimension }

        // Step 3: Calculate preview image WITH scaling based on final template dimension
        const templateDimensionForScaling = {
          width: finalDimension.width,
          height: finalDimension.height,
        }
        const previewFromVariantScaled = resolvePreviewProductImage(activeVariant, templateDimensionForScaling)

        const resolvedPreview = previewFromPrintArea || previewFromVariantScaled || previewFromTemplate || null

        // Generate default template name
        const defaultTemplateName = generateDefaultTemplateName(
          activeVariant?.product?.title,
          activeVariant?.title,
          activeVariant?.printAreas || []
        )

        initTemplate({
          _id: uuid(),
          name: defaultTemplateName,
          psds: [],
          layers: [],
          dimension: finalDimension,
          isCreatingNew: true,
          previewProductImage: resolvedPreview || undefined,
        } as any)

        // CRITICAL: Sync scaled preview image to IntegrationStore for new templates
        // This ensures the initial snapshot has correctly scaled preview image for discard functionality
        // Only sync if we resolved a preview from variant (auto-scaled), not if using existing printArea preview
        if (!previewFromPrintArea && resolvedPreview && typeof window !== 'undefined') {
          try {
            const searchParams = new URLSearchParams(window.location.search)
            const mockupId = searchParams.get('mockup')

            if (mockupId && printAreaId) {
              IntegrationStore.dispatch({
                type: 'UPDATE_PRINT_AREA_PREVIEW_PRODUCT_IMAGE',
                payload: {
                  mockupId,
                  printAreaId,
                  previewProductImage: resolvedPreview,
                },
                skipTrace: true, // Don't create undo step - this is part of initialization
              })
            }
          } catch (error) {
            console.warn('[useTemplateInitialization] Failed to sync preview image to IntegrationStore:', error)
          }
        }
      }
    })
  }, [targetPrintArea, printAreaId, enabled, initTemplate, initOptionSetLists, activeVariant])
}

function resolvePreviewProductImage(
  activeVariant: VariantIntegration | null,
  templateDimension?: { width: number; height: number }
) {
  if (!activeVariant) return null

  const resolved = resolveProductPreviewImage({ variant: activeVariant })
  if (!resolved) return null

  const imageWidth = resolved.width || DEFAULT_TEMPLATE_DIMENSION.width
  const imageHeight = resolved.height || DEFAULT_TEMPLATE_DIMENSION.height

  // Smart scaling for POD products with print area dimensions
  let finalWidth = imageWidth
  let finalHeight = imageHeight
  let left = 0
  let top = 0

  if (templateDimension) {
    const { width: templateWidth, height: templateHeight } = templateDimension

    // Always scale to cover (fill) canvas
    // This ensures featured image covers the entire canvas (may be cropped)
    const scaleToFitWidth = templateWidth / imageWidth
    const scaleToFitHeight = templateHeight / imageHeight

    // Use the LARGER scale to ensure image covers entire canvas (cover mode)
    const scale = Math.max(scaleToFitWidth, scaleToFitHeight)

    finalWidth = imageWidth * scale
    finalHeight = imageHeight * scale
    left = (templateWidth - finalWidth) / 2
    top = (templateHeight - finalHeight) / 2
  }

  return {
    _id: resolved.id || activeVariant.productId || activeVariant.id || uuid(),
    src: resolved.src,
    altText: resolved.altText || activeVariant.title || activeVariant.product?.title || 'Product image',
    left,
    top,
    width: finalWidth,
    height: finalHeight,
    rotation: 0,
    naturalWidth: resolved.width ?? imageWidth,
    naturalHeight: resolved.height ?? imageHeight,
    visible: true,
  }
}

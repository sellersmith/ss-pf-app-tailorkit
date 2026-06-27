import { useEffect } from 'react'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { setTemplateEnvAdapter } from '~/stores/modules/template/env-adapter'
import { useInitTemplate } from '~/modules/TemplateEditor/hooks/useInitTemplate'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { resolveProductPreviewImage } from '~/modules/ProductEditor/utilities/resolveProductPreviewImage'
import { DEFAULT_TEMPLATE_DIMENSION } from '~/stores/modules/template'
import { uuid } from '~/utils/uuid'
import type { VariantIntegration } from '~/types/integration'

interface UseTemplateDiscardHandlerParams {
  mockupId: string
  printAreaId: string
}

/**
 * Resolve preview product image from variant with smart scaling
 * MUST match the scaling logic in useTemplateInitialization
 */
function resolvePreviewFromVariant(
  variant: VariantIntegration | null,
  templateDimension?: { width: number; height: number }
) {
  if (!variant) return null

  const resolved = resolveProductPreviewImage({ variant })
  if (!resolved) return null

  const imageWidth = resolved.width || DEFAULT_TEMPLATE_DIMENSION.width
  const imageHeight = resolved.height || DEFAULT_TEMPLATE_DIMENSION.height

  // Smart scaling for POD products with template dimensions
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
    _id: resolved.id || variant.productId || variant.id || uuid(),
    src: resolved.src,
    altText: resolved.altText || variant.title || variant.product?.title || 'Product image',
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

/**
 * Hook to handle template re-initialization after unified discard
 * Listens to UNIFIED_EDITOR_DISCARDED event and restores template from fresh integration state
 */
export function useTemplateDiscardHandler(params: UseTemplateDiscardHandlerParams) {
  const { mockupId, printAreaId } = params
  const { initTemplate, initOptionSetLists } = useInitTemplate()

  useEffect(() => {
    const handleDiscard = () => {
      // Read fresh data from IntegrationStore after RESET_STATE (not stale closure data)
      const freshState = IntegrationStore.getState()
      const freshVariant = freshState.variants?.find(
        (v: any) => (typeof v.mockup === 'string' ? v.mockup : v.mockup?._id) === mockupId
      )
      const freshPrintArea = freshVariant?.printAreas?.find((pa: any) => pa._id === printAreaId)
      const template = (freshPrintArea?.template as any) || null

      if (template && template._id) {
        // Re-set unified adapter with restored template
        if (mockupId && freshPrintArea?._id) {
          setTemplateEnvAdapter({
            getMode: () => 'unified',
            getUnifiedParams: () => ({
              mockupId,
              printAreaId: freshPrintArea._id,
              templateId: template._id,
            }),
          })
        }

        // Use template's own dimension for preview image scaling
        const templateDimensionForScaling = template.dimension
          ? { width: template.dimension.width, height: template.dimension.height }
          : undefined

        // Resolve previewProductImage with priority:
        // 1. PrintArea.previewProductImage from snapshot (if saved)
        // 2. Resolve from product/variant image with smart scaling (fallback)
        // 3. Legacy template.previewProductImage (deprecated)
        const previewFromPrintArea = freshPrintArea?.previewProductImage
        const previewFromVariant = resolvePreviewFromVariant(freshVariant || null, templateDimensionForScaling)
        const previewFromTemplate = template?.previewProductImage
        const previewToInit = previewFromPrintArea || previewFromVariant || previewFromTemplate || null

        initOptionSetLists()
        initTemplate({
          ...template,
          previewProductImage: previewToInit,
        })
      }
    }

    Transmitter.listen('UNIFIED_EDITOR_DISCARDED', handleDiscard)
    return () => Transmitter.remove('UNIFIED_EDITOR_DISCARDED', handleDiscard)
  }, [mockupId, printAreaId, initTemplate, initOptionSetLists])
}

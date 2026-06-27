import { useCallback } from 'react'
import { TemplateEditorStore } from '~/stores/modules/template'
import { fastCanvasCaptureBlob } from '~/modules/TemplateEditor/utilities/canvas'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import isObject from 'lodash/isObject'

/**
 * Revoke any existing blob URL for a print area to prevent memory leaks
 *
 * When creating new blob URLs for transient previews, we must revoke old ones
 * to avoid accumulating memory. Blob URLs persist until explicitly revoked.
 *
 * @param mockupId - The mockup/variant ID
 * @param printAreaId - The print area ID
 */
function revokeExistingPreviewUrl(mockupId: string, printAreaId: string) {
  const state = IntegrationStore.getState()
  const variant = state.variants.find(v => v.mockup._id === mockupId)
  const printArea = variant?.printAreas?.find(pa => pa._id === printAreaId)
  const template = typeof printArea?.template === 'object' ? printArea.template : null
  const existingUrl = template?.previewUrl

  if (existingUrl && typeof existingUrl === 'string' && existingUrl.startsWith('blob:')) {
    URL.revokeObjectURL(existingUrl)
  }
}

/**
 * Capture template preview (standalone function, can be called outside React)
 *
 * This function captures the current template from TemplateEditorStore and creates
 * a transient blob URL preview. It can be called from anywhere (not just React components).
 *
 * @param mockupId - The mockup/variant ID
 * @param printAreaId - The print area ID
 *
 * @example
 * ```ts
 * // In a non-React context (e.g., event handler)
 * await captureTemplatePreview(mockupId, printAreaId)
 * ```
 */
export async function captureTemplatePreview(mockupId: string, printAreaId: string) {
  const templateState = TemplateEditorStore.getState()
  const stageRef = templateState.stageRef
  const dim = templateState.dimension

  if (!stageRef?.current || !dim) return

  // ⚡ SUPER FAST: No cloning! Hide editors, capture, restore (~50ms vs ~300ms)
  const blob = await fastCanvasCaptureBlob(
    stageRef.current as any,
    Math.max(16, Math.floor(dim.width)),
    Math.max(16, Math.floor(dim.height)),
    'image/png'
  ).catch(console.error)

  if (!blob) {
    return
  }

  // Revoke any existing blob URL first to prevent memory leaks
  revokeExistingPreviewUrl(mockupId, printAreaId)

  // Create object URL directly from blob (instant, 0ms transfer)
  const objectUrl = URL.createObjectURL(blob)

  // Serialize template to plain object to prevent reference sharing
  const serializedLayers = templateState.extractedLayerStores.map((layerStore: any) => layerStore.getState())

  // Get previewProductImage from TemplateEditorStore or existing PrintArea
  // Store it in PrintArea, not template object
  const integrationState = IntegrationStore.getState()
  const variant = integrationState.variants.find(v => v.mockup._id === mockupId)
  const prevPrintArea = variant?.printAreas?.find(pa => pa._id === printAreaId)

  // Priority: TemplateEditorStore > PrintArea.previewProductImage > null
  const previewImageToPreserve = templateState.previewProductImage || prevPrintArea?.previewProductImage || null

  // Check if previewProductImage is valid (has src which is required)
  const shouldPreservePreviewImage
    = previewImageToPreserve && isObject(previewImageToPreserve) && previewImageToPreserve.src

  const plainTemplate: any = {
    _id: templateState._id,
    name: templateState.name,
    shopDomain: templateState.shopDomain || '',
    dimension: { ...templateState.dimension },
    layers: serializedLayers,
    psds: [],
    previewUrl: objectUrl, // Store blob URL directly in template.previewUrl
    category: templateState.category,
    metadata: templateState.metadata, // Include metadata for save
    clipartsAdded: templateState.clipartsAdded, // Include cliparts for save
    type: templateState.type, // Include type for save
    // NOTE: previewProductImage is NOT stored in template anymore - it's stored in PrintArea
  }

  // IMPORTANT: Only update the template object for a print area if it already has a template.
  // When switching away, we want to attach a transient preview to the previous print area
  // without injecting a new template into print areas that had none.
  const hadExistingTemplate = !!(prevPrintArea && prevPrintArea.template && (prevPrintArea.template as any)._id)

  // Update template in PrintArea
  IntegrationStore.dispatch({
    type: 'UPDATE_TEMPLATE_SELECTED_FOR_PRINT_AREA',
    payload: {
      mockupId,
      printAreaId,
      template: hadExistingTemplate ? plainTemplate : null,
    },
    skipTrace: true,
  })

  // Update previewProductImage in PrintArea (separate from template)
  if (shouldPreservePreviewImage) {
    IntegrationStore.dispatch({
      type: 'UPDATE_PRINT_AREA_PREVIEW_PRODUCT_IMAGE',
      payload: {
        mockupId,
        printAreaId,
        previewProductImage: previewImageToPreserve,
      },
      skipTrace: true,
    })
  }
}

/**
 * Hook for capturing transient mockup previews from the design canvas (FAST)
 *
 * This hook wraps the standalone `captureTemplatePreview` function for use in React components.
 *
 * @returns Object with `captureActiveTemplatePreview` function
 *
 * @example
 * ```tsx
 * const { captureActiveTemplatePreview } = useDesignPreview()
 * await captureActiveTemplatePreview(mockupId, printAreaId)
 * ```
 */
export default function useDesignPreview() {
  const captureActiveTemplatePreview = useCallback(async (mockupId: string, printAreaId: string) => {
    await captureTemplatePreview(mockupId, printAreaId)
  }, [])

  return { captureActiveTemplatePreview }
}

/**
 * Store Asset Thumbnail Utilities
 *
 * These functions handle thumbnail generation with preview product image
 * for templates owned by the store asset domain (internal use only).
 */

import type Konva from 'konva'
import type { TemplateEditor } from '~/stores/modules/template'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { exportCanvasWithPreviewImage } from '~/modules/TemplateEditor/utilities/canvas'
import { lengthUnitToPixels } from '~/utils/lengthUnitToPixels'

/**
 * Check if store asset thumbnail feature is enabled for a template
 * Only applicable for templates owned by the store asset domain
 */
export function isStoreAssetThumbnailEnabled(
  shopDomain: string | undefined,
  metadata: TemplateEditor['metadata']
): boolean {
  if (!shopDomain) return false
  const isStoreAssetDomain = window.PUBLIC_ENV.STORE_ASSET_DOMAIN === shopDomain
  return isStoreAssetDomain && (metadata?.saveThumbnailWithPreview ?? false)
}

/**
 * Check if thumbnail generation is needed based on template state
 */
export function shouldGenerateThumbnail(
  shopDomain: string | undefined,
  metadata: TemplateEditor['metadata'],
  previewProductImage: TemplateEditor['previewProductImage']
): boolean {
  const isEnabled = isStoreAssetThumbnailEnabled(shopDomain, metadata)
  const isPreviewImageVisible = !!(previewProductImage && previewProductImage.visible !== false)
  return isEnabled && isPreviewImageVisible
}

/**
 * Get existing thumbnail URL from IntegrationStore for a template
 */
export function getExistingThumbnailUrl(templateId: string): string | undefined {
  const integrationState = IntegrationStore.getState()
  const variant = integrationState.variants.find(v =>
    v.printAreas?.some(pa => {
      const tpl = typeof pa.template === 'object' ? pa.template : null
      return tpl?._id === templateId
    })
  )
  const printArea = variant?.printAreas?.find(pa => {
    const tpl = typeof pa.template === 'object' ? pa.template : null
    return tpl?._id === templateId
  })
  const existingTemplate = typeof printArea?.template === 'object' ? printArea.template : null
  return existingTemplate?.thumbnailUrl
}

/**
 * Generate thumbnail with preview product image for store assets
 * Returns undefined if generation fails or is not applicable
 */
export async function generateStoreAssetThumbnail(
  templateId: string,
  stageRef: React.RefObject<Konva.Stage> | null | undefined,
  dimension: TemplateEditor['dimension'],
  shopDomain: string | undefined,
  metadata: TemplateEditor['metadata'],
  mockupId?: string,
  printAreaId?: string
): Promise<string | undefined> {
  // Early exit if not store asset domain
  if (!shopDomain || window.PUBLIC_ENV.STORE_ASSET_DOMAIN !== shopDomain) {
    return undefined
  }

  // Get previewProductImage from PrintArea (preferred) or fallback to TemplateEditorStore
  let previewProductImage: TemplateEditor['previewProductImage'] = null
  if (mockupId && printAreaId) {
    const integrationState = IntegrationStore.getState()
    const variant = integrationState.variants.find(v => v.mockup._id === mockupId)
    const printArea = variant?.printAreas?.find(pa => pa._id === printAreaId)
    previewProductImage = printArea?.previewProductImage || null
  }

  // Fallback: try to get from TemplateEditorStore if not found in PrintArea
  if (!previewProductImage && typeof window !== 'undefined') {
    const { TemplateEditorStore } = await import('~/stores/modules/template')
    const templateState = TemplateEditorStore.getState()
    if (templateState._id === templateId) {
      previewProductImage = templateState.previewProductImage || null
    }
  }

  const shouldGenerate = shouldGenerateThumbnail(shopDomain, metadata, previewProductImage)
  if (!shouldGenerate || !stageRef?.current) {
    return undefined
  }

  try {
    const _width = dimension.width || 0
    const _height = dimension.height || 0

    // Convert the width and height to pixels
    const width = lengthUnitToPixels(_width, dimension.measurementUnit, dimension.resolution)
    const height = lengthUnitToPixels(_height, dimension.measurementUnit, dimension.resolution)

    console.log(`📸 Generating thumbnail with preview for template ${templateId}...`)
    const base64Thumbnail = await exportCanvasWithPreviewImage(stageRef.current, width, height)

    if (typeof base64Thumbnail === 'string') {
      return base64Thumbnail
    }

    console.error('Failed to generate thumbnail')
    return undefined
  } catch (error) {
    console.error('Error generating thumbnail:', error)
    return undefined
  }
}

/**
 * Extracts personalization properties from a cross-product modal WC instance.
 * Must be called BEFORE disposing the canvas or destroying registries.
 */

import { getStorefrontLayerState } from '../stores/storefront-layer-state'
import { FEATURE_FLAGS } from '../constants/feature-flags'
import { CANVAS_PREVIEW_PROPERTY_KEY } from '../constants'
import { uploadImageToServer } from '../handlers/event-handlers/image-editor/upload-service'

const LAYER_TRANSFORM_PROPERTY_PREFIX = '_%{PROPERTY_PREFIX}%_Layer_'

/**
 * Upload the canvas preview file input to our server and return the hosted URL.
 * For the main product, Shopify handles file uploads natively via multipart FormData.
 * For cross-product addons, we send properties via JSON (/cart/add.js) which can't
 * carry files — so we must upload explicitly and pass the URL string.
 */
async function uploadCanvasPreviewFromForm(form: HTMLFormElement): Promise<string | null> {
  const previewInputName = `properties[${CANVAS_PREVIEW_PROPERTY_KEY}]`
  const fileInput = form.querySelector<HTMLInputElement>(`input[type="file"][name="${previewInputName}"]`)
  if (!fileInput?.files?.length) return null

  try {
    const result = await uploadImageToServer(fileInput.files[0], false)
    if (result.success && result.url) {
      return result.url
    }
  } catch (err) {
    console.warn('[TailorKit] Cross-product preview upload error:', err)
  }
  return null
}

/**
 * @returns Flat record of propertyKey → value (keys WITHOUT `properties[...]` wrapper)
 */
export async function extractPersonalizerProperties(
  customizerElement: HTMLElement,
  instanceId: string
): Promise<Record<string, string>> {
  const properties: Record<string, string> = {}

  const internalForm = customizerElement.querySelector<HTMLFormElement>('form.tlk-cross-product-form')
  if (internalForm) {
    const inputs = internalForm.querySelectorAll<HTMLInputElement>('input[type="hidden"][name]')
    inputs.forEach(input => {
      const rawName = input.name // e.g. "properties[TLK_foo]"
      const value = input.value
      const match = rawName.match(/^properties\[(.+)\]$/)
      const key = match ? match[1] : rawName

      if (key && value !== undefined) {
        properties[key] = value
      }
    })

    // Upload canvas preview file and include the URL in properties.
    // Main product doesn't need this because Shopify handles file uploads
    // natively via multipart FormData. Addons go through JSON /cart/add.js.
    const previewUrl = await uploadCanvasPreviewFromForm(internalForm)
    if (previewUrl) {
      properties[CANVAS_PREVIEW_PROPERTY_KEY] = previewUrl
    }
  } else {
    console.warn(
      `[TailorKit] extractPersonalizerProperties: No .tlk-cross-product-form found in instance "${instanceId}".`,
      'Ensure data-cross-product="true" was set before WC init.'
    )
  }

  // Cross-product modal instances are always safe to read even when MULTI_INSTANCE
  // is off: the store coerces to 'default', but layer IDs are unique per product
  // template (MongoDB ObjectIds), so modal layers won't collide with main page layers.
  const isCrossProductModal = instanceId.endsWith('::modal')
  const isIsolatedInstance = FEATURE_FLAGS.MULTI_INSTANCE || instanceId === 'default' || isCrossProductModal
  // Gate by actual buyer interaction (state has changed layers) rather than feature flag.
  // Layer-renderer.ts now registers layers as interactive whenever the merchant explicitly
  // enables Buyer Interaction toggles, even when LAYER_INTERACTION is false. Gating by flag
  // would silently drop those buyers' transform deltas from the cross-product cart payload.
  if (isIsolatedInstance) {
    const layerState = getStorefrontLayerState(instanceId)
    const changedLayers = layerState.getChangedLayers()

    for (const { layerId, transform, deleted } of changedLayers) {
      const key = `${LAYER_TRANSFORM_PROPERTY_PREFIX}${layerId}`
      const flags = layerState.getFlags(layerId)

      const sx = flags?.originalScaleX || 1
      const sy = flags?.originalScaleY || 1
      const mb = flags?.movementBounds

      if (mb && (!flags?.originalScaleX || !flags?.originalScaleY)) {
        console.warn(
          `[TailorKit] Movement zone layer ${layerId} missing scale factors in instance "${instanceId}", defaulting to 1x`
        )
      }

      // Zone-local → absolute storefront coords → template coords
      const absX = mb ? transform.x + mb.x : transform.x
      const absY = mb ? transform.y + mb.y : transform.y

      const transformData = deleted
        ? { deleted: true }
        : {
            x: absX / sx,
            y: absY / sy,
            w: transform.width / sx,
            h: transform.height / sy,
            r: transform.rotation,
          }

      properties[key] = JSON.stringify(transformData)
    }

    if (changedLayers.length > 0) {
      console.log(`[TailorKit] Extracted ${changedLayers.length} layer transform(s) from instance "${instanceId}"`)
    }
  }

  return properties
}

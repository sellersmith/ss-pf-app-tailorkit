import type { TailorKitProductPersonalizer } from '../components/product-personalizer'
import { getLayerByFieldset } from './query-layer'

/**
 * Get views that contain a specific layer integration ID
 * @param instance - The product personalizer instance
 * @param layerIntegrationId - The layer integration ID to search for
 * @returns Array of views containing the layer integration
 */
export const getViewsByLayerId = (instance: TailorKitProductPersonalizer, layerIntegrationId: string) => {
  const views = instance.productPersonalizer.views

  return (
    views?.filter(
      (v: any) => v.layers?.includes(layerIntegrationId) && v.overrides[layerIntegrationId]?.vsb !== false
    ) || []
  )
}

/**
 * Find and switch to the appropriate view for a layer
 * @param instance - The product personalizer instance
 * @param fieldset - The fieldset element containing layer info
 * @param updateViewBar - Whether to update the view bar UI
 */
export const findViewAndSwitchTo = (
  instance: TailorKitProductPersonalizer,
  fieldset: HTMLFieldSetElement | null,
  updateViewBar: boolean = true
): void => {
  if (!fieldset) return

  // Find the layer integration associated with this fieldset
  const { layerIntegration } = getLayerByFieldset(instance, fieldset)

  // Find views that contain this layer
  const relatedViews = getViewsByLayerId(instance, layerIntegration?.i || '')

  // Switch to the appropriate view if needed
  if (relatedViews && relatedViews.length > 0) {
    instance.dispatchEvent(
      new CustomEvent('tailorkit:set-view', {
        detail: { viewId: relatedViews },
        bubbles: true,
      })
    )
  }
}

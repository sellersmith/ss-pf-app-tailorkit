import type { WizardConfig } from '../../types/wizard'
import {
  collectCustomizationItems,
  resolveLegacyItemIndex,
  type CollectorLayer,
  type CustomizationItem,
} from '../../shared/customization-items'

/**
 * Prepares wizard config for storefront metafield.
 *
 * Re-maps `elementIndex` values so they match the actual DOM order on storefront.
 * Admin assigns indices based on ALL layers, but storefront only renders visible
 * layers — this function bridges the gap by running the same collector on the
 * filtered (visible) layers and remapping each step item's index.
 *
 * Returns null if wizard is not enabled or no valid steps remain.
 */
export function prepareWizardConfig(
  wizardConfig: WizardConfig | null | undefined,
  visibleLayers: CollectorLayer[]
): Record<string, unknown> | null {
  if (!wizardConfig?.enabled) return null

  // Only include steps that have at least one assigned item
  const stepsWithItems = (wizardConfig.steps ?? []).filter(step => step.items.length > 0)
  if (stepsWithItems.length === 0) return null

  // Collect items from the same visible layers that storefront will render.
  // This gives us the correct DOM-order indices.
  const storefrontItems: CustomizationItem[] = collectCustomizationItems(visibleLayers)

  // Build mapping: itemId → storefront DOM index
  const itemIdToIndex = new Map<string, number>()
  storefrontItems.forEach((item, index) => {
    itemIdToIndex.set(item.id, index)
  })

  // Remap steps: replace admin elementIndex with storefront DOM index, drop items that won't render
  const remappedSteps = stepsWithItems
    .map(step => {
      const remappedItems = step.items
        .map(item => {
          const direct = itemIdToIndex.get(item.itemId)
          const storefrontIndex = direct ?? resolveLegacyItemIndex(item.itemId, storefrontItems)
          if (storefrontIndex === undefined) return null // Item won't render on storefront
          return { elementIndex: storefrontIndex }
        })
        .filter((item): item is { elementIndex: number } => item !== null)

      return remappedItems.length > 0 ? { id: step.id, label: step.label, items: remappedItems } : null
    })
    .filter((step): step is NonNullable<typeof step> => step !== null)

  if (remappedSteps.length === 0) return null

  return {
    enabled: true,
    steps: remappedSteps,
  }
}

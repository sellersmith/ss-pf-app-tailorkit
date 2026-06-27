import type { CustomizationItem, CustomizationItemType } from './types'

/**
 * Backward-compat resolver for wizard step item ids that no longer match
 * current collector output.
 *
 * History: an earlier collector version emitted `${layerId}::image_buyer`
 * (literal suffix) for buyer-upload-only image layers. The current collector
 * emits `${layerId}::${optionSetId}` so the id matches the `data-item-id`
 * rendered by admin preview's option-set wrapper. Wizard configs saved during
 * the literal-suffix window still reference the old ids and would otherwise
 * be silently dropped during remap.
 *
 * Strategy: when a saved itemId can't be matched directly, parse the legacy
 * suffix and find a current item with the same layerId and equivalent type.
 *
 * Returns the index in `items` if a fallback match is found, otherwise undefined.
 */
const LEGACY_SUFFIX_TO_TYPE: Record<string, CustomizationItemType> = {
  image_buyer: 'image_buyer',
}

export function resolveLegacyItemIndex(
  legacyItemId: string | undefined,
  items: CustomizationItem[]
): number | undefined {
  if (!legacyItemId) return undefined

  const sepIndex = legacyItemId.lastIndexOf('::')
  if (sepIndex === -1) return undefined

  const layerId = legacyItemId.slice(0, sepIndex)
  const suffix = legacyItemId.slice(sepIndex + 2)
  const expectedType = LEGACY_SUFFIX_TO_TYPE[suffix]
  if (!expectedType) return undefined

  const matchIndex = items.findIndex(it => it.layerId === layerId && it.type === expectedType)
  return matchIndex === -1 ? undefined : matchIndex
}

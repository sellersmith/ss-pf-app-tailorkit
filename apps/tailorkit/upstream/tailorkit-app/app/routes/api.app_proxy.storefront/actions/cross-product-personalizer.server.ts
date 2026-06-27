/**
 * Checks which addon product variants have published TailorKit integrations.
 * Used to enrich GET_DATA_ADDON_VARIANT_CHECKBOX response with hasTailorKitIntegration flag.
 */
import Integration from '~/models/Integration.server'

/** @returns Set of variant GIDs that have published integrations */
export async function getPublishedVariantGids(shopDomain: string, variantGids: string[]): Promise<Set<string>> {
  if (!variantGids.length) return new Set()

  const publishedIntegrations = await Integration.find(
    { shopDomain, publishedAt: { $ne: null }, variants: { $in: variantGids } },
    { variants: 1 }
  ).lean()

  if (!publishedIntegrations.length) return new Set()

  const publishedVariantGidSet = new Set(publishedIntegrations.flatMap(i => (i.variants || []).map(String)))

  return new Set(variantGids.filter(gid => publishedVariantGidSet.has(gid)))
}

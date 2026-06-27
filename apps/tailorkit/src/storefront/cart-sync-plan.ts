export const DEFAULT_TAILORKIT_PROPERTY_PREFIX = '__pf_tailorkit'
export const OPTION_PRICING_PROPERTY_PREFIX = '_TLK Option Cost'

export interface TailorKitCartLineItem {
  key: string
  quantity: number
  price: number
  properties?: Record<string, string | null | undefined>
}

export interface TailorKitCartSyncPlanOptions {
  propertyPrefix?: string
  operationType?: string
}

export interface TailorKitCartQuantityChange {
  key: string
  quantity: number
  properties: Record<string, string | null | undefined>
}

export interface TailorKitCartSyncPlan {
  quantityChanges: TailorKitCartQuantityChange[]
  orphanRemovals: Record<string, 0>
}

function propertyNames(propertyPrefix: string) {
  return {
    refId: `${propertyPrefix}_ref_id`,
    hidden: `${propertyPrefix}_hidden`,
    charm: `${propertyPrefix}_charm`,
    optionCostAmount: `${OPTION_PRICING_PROPERTY_PREFIX} - Amount`,
  }
}

function propertiesOf(item: TailorKitCartLineItem): Record<string, string | null | undefined> {
  return item.properties || {}
}

function isHiddenPricingItem(item: TailorKitCartLineItem, hiddenProperty: string): boolean {
  return propertiesOf(item)[hiddenProperty] === 'true'
}

function refIdOf(item: TailorKitCartLineItem, refIdProperty: string): string {
  return String(propertiesOf(item)[refIdProperty] || '')
}

function hiddenQuantityPerMainUnit(item: TailorKitCartLineItem, optionCostAmountProperty: string): number {
  const originalCost = Number.parseFloat(String(propertiesOf(item)[optionCostAmountProperty] || '0'))
  const itemPrice = item.price / 100

  if (!Number.isFinite(originalCost) || !Number.isFinite(itemPrice) || originalCost <= 0 || itemPrice <= 0) {
    return 0
  }

  return Math.max(1, Math.round(originalCost / itemPrice))
}

function shouldCleanupOrphans(operationType?: string): boolean {
  return Boolean(operationType && operationType !== 'add' && operationType !== 'unknown')
}

/** Creates TailorKit hidden-pricing cart sync operations without performing Shopify Ajax calls. */
export function createTailorKitCartSyncPlan(
  items: TailorKitCartLineItem[],
  options: TailorKitCartSyncPlanOptions = {}
): TailorKitCartSyncPlan {
  const names = propertyNames(options.propertyPrefix || DEFAULT_TAILORKIT_PROPERTY_PREFIX)
  const mainItems = items.filter(item => refIdOf(item, names.refId) && !isHiddenPricingItem(item, names.hidden))
  const hiddenItems = items.filter(item => isHiddenPricingItem(item, names.hidden))
  const mainByRefId = new Map(mainItems.map(item => [refIdOf(item, names.refId), item]))
  const quantityChanges: TailorKitCartQuantityChange[] = []
  const orphanRemovals: Record<string, 0> = {}

  for (const hiddenItem of hiddenItems) {
    const refId = refIdOf(hiddenItem, names.refId)
    const mainItem = mainByRefId.get(refId)

    if (!mainItem) {
      if (refId && shouldCleanupOrphans(options.operationType)) orphanRemovals[hiddenItem.key] = 0
      continue
    }

    if (propertiesOf(hiddenItem)[names.charm] === 'true') continue

    const perMainUnit = hiddenQuantityPerMainUnit(hiddenItem, names.optionCostAmount)
    if (!perMainUnit) continue

    const quantity = Math.max(1, perMainUnit * mainItem.quantity)
    if (quantity !== hiddenItem.quantity) {
      quantityChanges.push({ key: hiddenItem.key, quantity, properties: propertiesOf(hiddenItem) })
    }
  }

  return { quantityChanges, orphanRemovals }
}

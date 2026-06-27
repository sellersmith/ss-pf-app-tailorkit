import { optionSetDataKeys } from '../types/psd'

type OptionSetLike = {
  type?: string
  data?: any
  additionalPricingEnabled?: boolean
}

/**
 * Determine whether the extra-pricing UI should render for a given option set.
 *
 * Backwards-compat rule: if the toggle has never been set (undefined),
 * auto-enable when any item already has a non-zero `additionalPricing.value`.
 * This preserves visibility for stores that configured pricing before the toggle existed.
 */
export function isAdditionalPricingEnabled(optionSet: OptionSetLike | null | undefined): boolean {
  if (!optionSet) return false
  if (typeof optionSet.additionalPricingEnabled === 'boolean') {
    return optionSet.additionalPricingEnabled
  }

  const dataKey = optionSet.type ? optionSetDataKeys[optionSet.type as keyof typeof optionSetDataKeys] : undefined
  if (!dataKey) return false

  const items = optionSet.data?.[dataKey]
  if (!Array.isArray(items)) return false

  return items.some(item => {
    const raw = item?.additionalPricing?.value
    if (raw === null || raw === undefined) return false
    const num = Number(raw)
    return Number.isFinite(num) && num > 0
  })
}

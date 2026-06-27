/**
 * useFeatureAccess Hook
 *
 * Client-side hook to check feature access based on shop's pricing plan.
 * Should be used in components that need to conditionally render based on features.
 */

import { useLoaderData } from '@remix-run/react'
import type { FeatureName } from '~/routes/api.pricing/constants/featurePlans'
import { FEATURE_TO_PLAN_MAP } from '~/routes/api.pricing/constants/featurePlans'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import { isOrderBasedPlan } from '~/models/helpers/pricing-utils'

/**
 * Check if current shop has access to a feature
 *
 * This hook reads the shop data from the loader and checks the plan's feature flags.
 *
 * @param feature - Feature name to check
 * @returns true if shop has access to the feature
 *
 * @example
 * ```tsx
 * function SvgExportButton() {
 *   const canExportSvg = useFeatureAccess('losslessSvgExport')
 *
 *   if (!canExportSvg) {
 *     return <Text>SVG export requires Growth plan</Text>
 *   }
 *
 *   return <Button onClick={handleExport}>Export SVG</Button>
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With FeatureGate component (recommended)
 * function SvgExportButton() {
 *   const canExportSvg = useFeatureAccess('losslessSvgExport')
 *   const requiredPlan = useRequiredPlan('losslessSvgExport')
 *
 *   return (
 *     <FeatureGate
 *       feature="losslessSvgExport"
 *       hasAccess={canExportSvg}
 *       requiredPlan={requiredPlan}
 *     >
 *       <Button onClick={handleExport}>Export SVG</Button>
 *     </FeatureGate>
 *   )
 * }
 * ```
 */
export function useFeatureAccess(feature: FeatureName): boolean {
  const data = useLoaderData<any>()

  // Extract shop data from loader
  // The loader should include shop with subscription.plan populated
  const shop = data?.shop || data?.shopData

  if (!shop?.subscription?.plan) {
    return false
  }

  const plan = shop.subscription.plan as PricingPlanDocument

  // Order-based plans: Check feature flags
  // Detect by presence of usages.orders field
  if (isOrderBasedPlan(plan)) {
    return plan.features?.[feature] === true
  }

  // Revenue-based plans (legacy): Grant all features (grandfather policy)
  return true
}

/**
 * Get required plan tier for a feature
 *
 * @param feature - Feature name
 * @returns Minimum required plan tier or null
 *
 * @example
 * ```tsx
 * const requiredPlan = useRequiredPlan('autoFulfillment')
 * // Returns: 'Growth'
 * ```
 */
export function useRequiredPlan(feature: FeatureName): string | null {
  // This is a simple wrapper around the constant
  // Could be enhanced to fetch from API if needed
  const plans = FEATURE_TO_PLAN_MAP[feature]

  if (!plans || plans.length === 0) {
    return null
  }

  return plans[0]
}

/**
 * Get all features available to current shop
 *
 * @returns Array of feature names the shop has access to
 *
 * @example
 * ```tsx
 * const availableFeatures = useAvailableFeatures()
 * console.log(availableFeatures)
 * // ['highResPngExport', 'losslessSvgExport', 'autoFulfillment']
 * ```
 */
export function useAvailableFeatures(): FeatureName[] {
  const data = useLoaderData<any>()
  const shop = data?.shop || data?.shopData

  if (!shop?.subscription?.plan) {
    return []
  }

  const plan = shop.subscription.plan as PricingPlanDocument

  // Order-based plans: Filter features where flag is true
  // Detect by presence of usages.orders field
  if (isOrderBasedPlan(plan)) {
    if (!plan.features) {
      return []
    }

    return Object.entries(plan.features)
      .filter(([key, value]) => typeof value === 'boolean' && value === true)
      .map(([key]) => key as FeatureName)
  }

  // Revenue-based plans (legacy): All features available
  return Object.keys(FEATURE_TO_PLAN_MAP) as FeatureName[]
}

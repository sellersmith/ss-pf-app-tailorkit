/**
 * Feature Restrict Component
 *
 * Wrapper component that disables child UI elements when user doesn't have feature access.
 * Unlike FeatureGate which shows/hides content, this component keeps UI visible but disabled.
 */

import { cloneElement, isValidElement, type ReactElement } from 'react'
import { Tooltip } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import type { FeatureName } from '~/routes/api.pricing/constants/featurePlans'

export interface FeatureRestrictProps {
  /**
   * Feature to check access for
   */
  feature: FeatureName

  /**
   * Whether the current shop has access to this feature
   */
  hasAccess: boolean

  /**
   * Minimum required plan tier for this feature
   */
  requiredPlan: string | null

  /**
   * Child element to render (should support disabled prop)
   */
  children: ReactElement

  /**
   * Optional custom tooltip message
   */
  tooltipMessage?: string

  /**
   * Whether to show tooltip when disabled (default: true)
   */
  showTooltip?: boolean
}

/**
 * FeatureRestrict component
 *
 * Wraps a single child element and disables it when user doesn't have feature access.
 * Shows tooltip explaining why the feature is disabled.
 *
 * @example
 * ```tsx
 * // In a route loader
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   const shop = await getShopFromSession(request)
 *   const canBulkAssign = hasFeatureAccess(shop, 'bulkAssignedProducts')
 *   const requiredPlan = getRequiredPlanForFeature('bulkAssignedProducts')
 *
 *   return json({ canBulkAssign, requiredPlan })
 * }
 *
 * // In the component
 * function BulkAssignButton() {
 *   const { canBulkAssign, requiredPlan } = useLoaderData<typeof loader>()
 *
 *   return (
 *     <FeatureRestrict
 *       feature="bulkAssignedProducts"
 *       hasAccess={canBulkAssign}
 *       requiredPlan={requiredPlan}
 *     >
 *       <Button onClick={handleBulkAssign}>Bulk Assign Templates</Button>
 *     </FeatureRestrict>
 *   )
 * }
 * ```
 */
export function FeatureRestrict({
  feature,
  hasAccess,
  requiredPlan,
  children,
  tooltipMessage,
  showTooltip = true,
}: FeatureRestrictProps) {
  const { t } = useTranslation()

  // If user has access, render children normally
  if (hasAccess) {
    return children
  }

  // Validate that children is a valid React element
  if (!isValidElement(children)) {
    console.error('FeatureRestrict: children must be a valid React element')
    return children
  }

  // Default tooltip message
  const defaultTooltip = requiredPlan
    ? t('this-feature-requires-plan-or-higher', { plan: requiredPlan })
    : t('this-feature-is-not-available-on-your-current-plan')

  const tooltip = tooltipMessage || defaultTooltip

  // Clone the child element and add disabled prop
  const childProps = (children.props || {}) as Record<string, any>
  const disabledChild = cloneElement(children as ReactElement<any>, {
    ...childProps,
    disabled: true,
  })

  // If tooltip is disabled, just return the disabled child
  if (!showTooltip) {
    return disabledChild
  }

  // Wrap with Tooltip component
  return <Tooltip content={tooltip}>{disabledChild}</Tooltip>
}

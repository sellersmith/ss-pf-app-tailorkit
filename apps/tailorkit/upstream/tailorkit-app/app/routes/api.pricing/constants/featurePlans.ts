/**
 * Feature Gating Constants
 *
 * Maps features to pricing plan tiers for feature gating.
 * Used to restrict premium features based on user's subscription plan.
 */

export type PlanTier = 'Starter' | 'Growth' | 'Enterprise'

/**
 * Available features that can be gated by plan tier
 */
export type FeatureName =
  | 'highResPngExport'
  | 'fulfillment3rdPartyApi'
  | 'upsellCheckbox'
  | 'losslessSvgExport'
  | 'autoFulfillment'
  | 'bulkAssignedProducts'
  | 'priorityFeatureRequests'
  | 'dedicatedSuccessManager'
  | 'charmBuilder'

/**
 * Feature to Plan Mapping
 *
 * Maps each feature to the plan tiers that have access to it.
 * Plans are listed in ascending order (lowest tier first).
 *
 * Example: 'losslessSvgExport' is available on Growth and Enterprise,
 * but NOT on Starter.
 */
export const FEATURE_TO_PLAN_MAP: Record<FeatureName, PlanTier[]> = {
  // Available on all tiers (Starter, Growth, Enterprise)
  highResPngExport: ['Starter', 'Growth', 'Enterprise'],
  fulfillment3rdPartyApi: ['Starter', 'Growth', 'Enterprise'],
  upsellCheckbox: ['Starter', 'Growth', 'Enterprise'],

  // Available on Growth and Enterprise only
  losslessSvgExport: ['Growth', 'Enterprise'],
  autoFulfillment: ['Growth', 'Enterprise'],
  charmBuilder: ['Growth', 'Enterprise'],
  priorityFeatureRequests: ['Growth', 'Enterprise'],

  // Available on Enterprise only
  bulkAssignedProducts: ['Enterprise'],
  dedicatedSuccessManager: ['Enterprise'],
}

/**
 * Human-readable feature names for UI display
 */
export const FEATURE_DISPLAY_NAMES: Record<FeatureName, string> = {
  highResPngExport: 'High-quality print-ready files',
  fulfillment3rdPartyApi: '3rd Party Fulfillment API',
  upsellCheckbox: 'Upsell product at checkout',
  losslessSvgExport: 'Lossless print files (SVG + PNG)',
  autoFulfillment: 'Auto-send files to print provider',
  bulkAssignedProducts: 'Bulk Assigned Products',
  priorityFeatureRequests: 'Priority Feature Requests',
  dedicatedSuccessManager: 'Dedicated Success Manager',
  charmBuilder: 'Charm Builder',
}

/**
 * Feature descriptions for upgrade prompts
 */
export const FEATURE_DESCRIPTIONS: Record<FeatureName, string> = {
  highResPngExport: 'Get high-quality print-ready files for every personalized order',
  fulfillment3rdPartyApi: 'Integrate with third-party fulfillment services like Printify',
  upsellCheckbox: 'Add upsell products at checkout to increase average order value',
  losslessSvgExport: 'Export lossless print files in SVG and PNG formats for perfect quality',
  autoFulfillment: 'Automatically send personalized order files to your print provider',
  bulkAssignedProducts: 'Assign templates to multiple products at once to save time',
  priorityFeatureRequests: 'Get your feature requests prioritized by our product team',
  dedicatedSuccessManager: 'Work with a dedicated success manager for personalized support',
  charmBuilder: 'Create interactive charm placement experiences for your customers',
}

/**
 * Plan tier display information
 */
export const PLAN_TIER_INFO: Record<PlanTier, { displayName: string; color: string }> = {
  Starter: {
    displayName: 'Starter',
    color: 'subdued',
  },
  Growth: {
    displayName: 'Growth',
    color: 'success',
  },
  Enterprise: {
    displayName: 'Enterprise',
    color: 'info',
  },
}

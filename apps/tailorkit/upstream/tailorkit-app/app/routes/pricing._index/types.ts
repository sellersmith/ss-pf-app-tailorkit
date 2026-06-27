import type { TFunction } from 'i18next'
import type { CouponDocument } from '~/models/Coupon'
import type { GroupedPricingPlanDocument, PricingPlanDocument } from '~/models/PricingPlan'
import type { ShopDocument } from '~/models/Shop'
import type { BillingCycleDocument } from '~/models/BillingCycle'

export type PricingVersion = 1 | 2

/**
 * Shared props for SubscriberView and ProspectView.
 * Both views render the /pricing page body; route.tsx selects between them
 * based on `isSubscriberView(shopData, isOldPricingMigration)`.
 */
export interface PricingViewProps {
  t: TFunction
  shopData: ShopDocument | null
  v2Plans: PricingPlanDocument[]
  /** Current plan (from subscription.plan) when populated */
  plan?: PricingPlanDocument | string
  hasActiveV1Plan: boolean
  isOldPricingMigration: boolean
  remainingTrialDays: number | null
  billingCycleBaseline: number
  billingCycles: BillingCycleDocument[]
  showPricingCalculator: boolean
  togglePricingCalculator: () => void
  showFeatureComparisonTable: boolean
  toggleFeatureComparisonTable: () => void
  showFAQ: boolean
  toggleFAQ: () => void
  onSelectPlanByAlias: (alias: string) => void
}

export interface PricingLoaderData {
  version: PricingVersion
  pricingPlans: GroupedPricingPlanDocument[]
  coupon: CouponDocument | null
}

export interface PricingV1Props {
  pricingPlans: GroupedPricingPlanDocument[]
  coupon: CouponDocument | null
}

export interface PricingV2Props {
  // V2 specific props if needed
}

export interface MigrationSectionProps {
  currentVersion: PricingVersion
  // V2 plans to show for migration
  v2Plans?: GroupedPricingPlanDocument[]
}

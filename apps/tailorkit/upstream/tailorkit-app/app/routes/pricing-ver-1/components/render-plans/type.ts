import type { TFunction } from 'i18next'
import type { GroupedPricingPlanDocument, PricingPlanDocument } from '~/models/PricingPlan'
import type { ShopDocument } from '~/models/Shop'

export interface IRenderPlanProps {
  // Translation
  t: TFunction<'translation', undefined>

  // Specific pricing plan
  pricingPlan: GroupedPricingPlanDocument

  // Selected pricing plan
  selectedPlan: PricingPlanDocument

  // Shop config
  shopConfig: ShopDocument

  // Pricing plans
  pricingPlans: GroupedPricingPlanDocument[]

  // Is processing
  processing: boolean

  // Check if customer subscribes which specific plan
  isCurrentPlan: (plan: GroupedPricingPlanDocument) => number | boolean

  // Current pricing plan
  currentPlan: PricingPlanDocument

  // Get selected plan
  getSelectedPlan: (plan: GroupedPricingPlanDocument, optionId?: string) => PricingPlanDocument

  // Can use plan or not
  canUsePlan: (plan: GroupedPricingPlanDocument) => any

  // Select plan handler
  selectPlanHandler: (planId?: string) => void
}

export interface IRenderOutlinePlans {}

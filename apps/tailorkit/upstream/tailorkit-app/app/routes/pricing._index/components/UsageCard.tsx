import { Card, BlockStack, InlineStack, Text, Badge } from '@shopify/polaris'
import type { TFunction } from 'i18next'
import type { ShopDocument } from '~/models/Shop'
import type { SubscriptionDocument } from '~/models/Subscription'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import type { BillingCycleDocument } from '~/models/BillingCycle'
import { calculateAiCreditBalance } from '~/models/helpers/ai-credit-utils'
import { UsageCardTrial, UsageCardRevenueBased, UsageCardOrderBased } from './UsageCardComponents'
import { isOrderBasedPlan } from '~/models/helpers/pricing-utils'
import { useCouponData } from '../hooks/useCouponData'
import { usePurchasedCredits } from '../hooks/usePurchasedCredits'

interface UsageCardProps {
  shopData: ShopDocument | null
  t: TFunction
  /**
   * Billing cycle baseline (orderCount.initial from BillingCycle)
   * Fetched from BillingStateManager via server loader
   */
  billingCycleBaseline: number
  /**
   * Billing cycles (fetched from BillingStateManager.getBillingHistory() in server loader)
   */
  billingCycles?: BillingCycleDocument[]
  /**
   * Subscriber-mode: enables manage popover, next-charge line, Buy Credits CTA,
   * cancel-via-uninstall hint inside the order-based card.
   */
  subscriberMode?: boolean
  /** "Change plan" handler invoked by the manage popover (subscriber mode only). */
  onChangePlan?: () => void
}

/**
 * Helper to check if shop is in FREE trial period (trial-v2 only)
 *
 * Uses field-based detection (NOT pricingVersion) to determine trial status.
 *
 * IMPORTANT: This should ONLY return true for FREE trial plans (price=0, no Shopify charge).
 * Paid plans with Shopify-managed trials should return FALSE here - they show paid plan card instead.
 */
function isInTrialPeriod(subscription: SubscriptionDocument | null): boolean {
  if (!subscription) return false

  const plan = subscription.plan as PricingPlanDocument
  if (!plan) return false

  // ONLY detect FREE trial plan (trial-v2)
  // - price=0 (free)
  // - no Shopify charge (not a paid plan)
  // - has trialDays (trial period defined)
  if (plan.price === 0 && !subscription.shopifyCharge && plan.trialDays && plan.trialDays > 0) {
    // Check if within trial period (calculated from subscription creation)
    const createdAt = new Date(subscription.createdAt)
    const trialEndDate = new Date(createdAt)
    trialEndDate.setDate(trialEndDate.getDate() + plan.trialDays)

    return new Date().getTime() < trialEndDate.getTime()
  }

  // For paid plans (price > 0), ALWAYS return false
  // Even if they have Shopify trial, they should show paid plan card, not trial card
  return false
}

/**
 * Helper to get AI credits usage
 */
function getAiCreditsUsage(
  shopData: ShopDocument | null,
  subscription: SubscriptionDocument | null,
  purchasedCreditsData: { total: number; used: number; remaining: number }
) {
  const aiCredit = shopData?.usages?.aiCredit
  const plan = subscription?.plan as PricingPlanDocument
  const allocationOverride = plan?.aiCreditsPerMonth || undefined
  const balance = calculateAiCreditBalance(aiCredit, allocationOverride)

  return {
    used: balance.monthlyUsage,
    total: balance.monthlyAllocation,
    purchased: purchasedCreditsData.remaining, // Current remaining balance
    purchasedTotal: purchasedCreditsData.total, // Total purchased in cycle
    purchasedUsed: purchasedCreditsData.used, // Used from purchased in cycle
    remaining: balance.totalAvailable,
  }
}

export default function UsageCard(props: UsageCardProps) {
  const { shopData, t, billingCycleBaseline = 0, billingCycles = [], subscriberMode = false, onChangePlan } = props
  const subscription = shopData?.subscription as SubscriptionDocument | null
  const plan = subscription?.plan as PricingPlanDocument | null

  // Fetch coupon data if subscription has couponCode
  const { coupon, loading: couponLoading } = useCouponData(subscription)

  // Fetch purchased AI credits data in current billing cycle
  const { data: purchasedCreditsData, loading: purchasedCreditsLoading } = usePurchasedCredits()

  const isInTrial = isInTrialPeriod(subscription)

  // Trial period state
  if (isInTrial) {
    return (
      <UsageCardTrial
        shop={shopData}
        header={
          <InlineStack gap="100" blockAlign="center">
            <Text as="h2" variant="headingMd">
              {t('current-plan')}
            </Text>
            <Badge>{t('not-selected')}</Badge>
          </InlineStack>
        }
        t={t}
      />
    )
  }

  // Plan selected state - calculate AI credits for paid plans
  const aiCredits = getAiCreditsUsage(shopData, subscription, purchasedCreditsData)

  // Check if plan is order-based (has usages.orders)
  // This is the correct way to detect billing type, NOT using pricingVersion
  const hasOrderBasedBilling = plan && isOrderBasedPlan(plan)

  // Check if plan is revenue-based (has usages.revenue)
  const isRevenueBasedPlan = plan?.usages?.revenue && plan.usages.revenue.length > 0

  // Revenue-based plan UI (Old pricing - V1)
  if (isRevenueBasedPlan) {
    return (
      <UsageCardRevenueBased
        shopData={shopData}
        subscription={subscription}
        plan={plan}
        aiCredits={aiCredits}
        t={t}
        purchasedCreditsLoading={purchasedCreditsLoading}
      />
    )
  }

  // Order-based plan UI (New pricing - V2)
  if (hasOrderBasedBilling) {
    return (
      <UsageCardOrderBased
        shopData={shopData}
        subscription={subscription}
        plan={plan}
        aiCredits={aiCredits}
        t={t}
        billingCycleBaseline={billingCycleBaseline}
        billingCycles={billingCycles}
        coupon={coupon}
        couponLoading={couponLoading}
        purchasedCreditsLoading={purchasedCreditsLoading}
        subscriberMode={subscriberMode}
        onChangePlan={onChangePlan}
      />
    )
  }

  // Fallback: Show simple UI for non-order-based plans or no plan
  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingMd">
            {t('current-plan')}
          </Text>
          <Text as="span" tone="subdued">
            {t('not-selected')}
          </Text>
        </InlineStack>

        <Text as="p" variant="bodySm" tone="subdued">
          {t('select-a-plan-below-to-start-using-tailorkit-features')}
        </Text>
      </BlockStack>
    </Card>
  )
}

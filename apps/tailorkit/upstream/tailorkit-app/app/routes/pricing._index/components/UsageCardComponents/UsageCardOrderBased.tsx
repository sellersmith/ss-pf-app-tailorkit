import {
  BlockStack,
  Box,
  Card,
  InlineGrid,
  InlineStack,
  Link,
  SkeletonBodyText,
  Text,
  useBreakpoints,
} from '@shopify/polaris'
import { useState } from 'react'
import { format } from 'date-fns'
import type { TFunction } from 'i18next'
import type { ShopDocument } from '~/models/Shop'
import type { SubscriptionDocument } from '~/models/Subscription'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import type { BillingCycleDocument } from '~/models/BillingCycle'
import type { CouponDocument } from '~/models/Coupon'
import { getFreeOrdersCount, getOverageFeePerOrder } from '~/models/helpers/pricing-utils'
import { isFirstMonthDealSubscription } from '~/constants/first-month-deal'
import { getTrialStatus } from '~/models/PricingPlan.fns'
import { AiCreditBannerSection } from './AiCreditBannerSection'
import { TrialProgressSection } from './TrialProgressSection'
import { UsageStatsSection } from './UsageStatsSection'
import { ManageSubscriptionPopover } from './ManageSubscriptionPopover'
import { ExtraOrderFeeModal, type CurrentPlanCharges } from '../ExtraOrderFeeModal'

interface UsageCardOrderBasedProps {
  shopData: ShopDocument | null
  subscription: SubscriptionDocument | null
  plan: PricingPlanDocument
  aiCredits: {
    used: number
    total: number
    purchased: number
    purchasedTotal: number
    purchasedUsed: number
  }
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
   * Coupon data for discount calculation (fetched via useCouponData hook)
   */
  coupon?: CouponDocument | null
  /**
   * Loading state for coupon data (for skeleton UI)
   */
  couponLoading?: boolean
  /**
   * Loading state for purchased credits data (for skeleton UI)
   */
  purchasedCreditsLoading?: boolean
  /**
   * Subscriber-mode flag: when true, render manage popover, next-charge line,
   * Buy Credits CTA, and the cancel-via-uninstall passive line.
   * Defaults to false to preserve historical behavior on prospect-style surfaces.
   */
  subscriberMode?: boolean
  /** Click handler for the popover's "Change plan" action (subscriberMode only). */
  onChangePlan?: () => void
}

function formatDate(date: Date | null): string {
  if (!date) return ''
  return format(date, 'MMMM dd, yyyy')
}

export function UsageCardOrderBased(props: UsageCardOrderBasedProps) {
  const {
    shopData,
    subscription,
    plan,
    aiCredits,
    t,
    billingCycleBaseline,
    billingCycles = [],
    coupon,
    couponLoading = false,
    purchasedCreditsLoading = false,
    subscriberMode = false,
    onChangePlan,
  } = props
  const [modalActive, setModalActive] = useState(false)

  const { mdDown } = useBreakpoints()

  // Billing cycles are now passed from loader (no client-side fetch needed)
  const loadingBillingHistory = false

  // Detect trial status
  const trialStatus = getTrialStatus(subscription)
  const isInTrial = trialStatus?.isOnTrial === true

  const planName = plan.name
  const subscriptionFee = plan.price
  const includedOrders = getFreeOrdersCount(plan)
  const overageFeePerOrder = getOverageFeePerOrder(plan)

  // Detect $1 first month deal via capability-based helper
  const isFirstMonthDeal = isFirstMonthDealSubscription(subscription?.finalPrice, subscriptionFee)

  // Calculate order usage using billing cycle baseline from BillingCycle
  const orderCountAtPlanChange = billingCycleBaseline

  // Get last charged order count from most recent usage fee in BillingCycle
  // This prevents double-charging by tracking the checkpoint of last charge
  const activeCycle = billingCycles.find(c => c.status === 'active')
  const lastUsageFee = activeCycle?.charges?.usageFees?.[activeCycle.charges.usageFees.length - 1]
  const orderCountAtLastCharge = lastUsageFee?.orderCount || orderCountAtPlanChange
  const usedOrders = shopData?.usages?.orders || 0
  const planLimit = includedOrders
  const ordersSincePlanChange = usedOrders - orderCountAtPlanChange

  // Determine free and extra orders for DISPLAY (progress bar)
  // This uses ordersSincePlanChange to show quota consumption
  let freeOrders: number
  let extraOrders: number

  if (orderCountAtPlanChange >= planLimit) {
    // Quota exhausted: all orders since baseline are charged (e.g., downgrade scenario)
    freeOrders = 0
    extraOrders = ordersSincePlanChange
  } else {
    // Quota available: consume free orders first (e.g., upgrade or new subscription)
    freeOrders = Math.min(ordersSincePlanChange, planLimit)
    extraOrders = Math.max(0, ordersSincePlanChange - planLimit)
  }

  // Calculate PENDING charges for MODAL (only new orders since last charge)
  // This prevents showing already-submitted charges as "current"
  let currentPlanExtraOrderFee: number
  let pendingExtraOrders: number

  const ordersSinceLastCharge = usedOrders - orderCountAtLastCharge

  if (orderCountAtPlanChange >= planLimit) {
    // Quota exhausted: charge all new orders since last charge
    pendingExtraOrders = ordersSinceLastCharge
    currentPlanExtraOrderFee = pendingExtraOrders * overageFeePerOrder
  } else {
    // Quota available: only charge orders beyond limit since last charge
    const currentOrdersSincePlanChange = usedOrders - orderCountAtPlanChange
    const lastChargeOrdersSincePlanChange = orderCountAtLastCharge - orderCountAtPlanChange

    const currentOverage = Math.max(0, currentOrdersSincePlanChange - planLimit)
    const lastChargeOverage = Math.max(0, lastChargeOrdersSincePlanChange - planLimit)

    pendingExtraOrders = currentOverage - lastChargeOverage
    currentPlanExtraOrderFee = pendingExtraOrders * overageFeePerOrder
  }

  // Calculate TOTAL extra order fee including historical charges from billing cycles
  // Historical: All already-submitted usage charges from BillingCycle
  // Current: Only NEW pending charges since last submission
  const historicalExtraOrderFee = billingCycles.reduce((sum, cycle) => sum + (cycle.charges?.totalUsageFees || 0), 0)
  const totalExtraOrderFee = historicalExtraOrderFee + currentPlanExtraOrderFee

  // During trial: Show pending charges for transparency, but override total to $0.00
  // This helps users understand what they'll be charged after trial ends
  const effectiveSubscriptionFee = isFirstMonthDeal ? 1 : subscriptionFee
  const effectiveExtraOrderFee = totalExtraOrderFee

  const subtotal = effectiveSubscriptionFee + effectiveExtraOrderFee

  // Calculate discount from fetched coupon data
  // Discount only applies to subscription fee, not usage fees
  let discount = 0
  if (coupon && coupon.discount) {
    const discountType = coupon.discount.type
    const discountAmount = coupon.discount.amount

    if (discountType === 'fixed') {
      // Fixed amount discount (e.g., $5 off)
      discount = Math.min(discountAmount, subscriptionFee)
    } else if (discountType === 'percent') {
      // Percentage discount (e.g., 50% off)
      discount = (subscriptionFee * discountAmount) / 100
    }
  }

  // During trial: Override TOTAL to $0.00 (user hasn't been charged yet)
  // But line items show pending charges for transparency
  const total = Math.max(0, subtotal - discount)

  const usagePeriodStart = subscription?.from ? formatDate(new Date(subscription.from)) : formatDate(new Date())
  const usagePeriodEnd = t('present')

  // Trial display values
  const trialDays = plan.trialDays || 14
  const trialCurrentDay = isInTrial ? trialDays - (trialStatus?.daysRemaining || 0) + 1 : 0
  const trialStartFormatted = trialStatus?.trialStartDate ? formatDate(new Date(trialStatus.trialStartDate)) : ''
  const trialEndFormatted = trialStatus?.trialEndDate ? formatDate(new Date(trialStatus.trialEndDate)) : ''

  // Compute regular price start date for $1 deal info box
  // Shopify: $1 charged on trial end, covers trial end → trial end + 30 days
  // Regular $19 charged on trial end + 30 days
  const regularPriceStartDate = isFirstMonthDeal
    ? (() => {
        const d = new Date(subscription?.createdAt || subscription?.from || new Date())
        d.setDate(d.getDate() + trialDays + 30)
        return format(d, 'MMMM dd, yyyy')
      })()
    : ''

  // Calculate current plan charges for the modal
  // Use pendingExtraOrders (orders since last charge) not extraOrders (orders since plan change)
  const currentPlanCharges: CurrentPlanCharges = {
    timeline: new Date(),
    planName: planName,
    feePerOrder: overageFeePerOrder,
    extraOrders: pendingExtraOrders,
    subtotal: currentPlanExtraOrderFee,
  }

  // Active billing cycle's end date = next charge date. Falls back to subscription.from + 30d.
  const nextChargeDate = (() => {
    if (activeCycle?.cycleEndDate) return formatDate(new Date(activeCycle.cycleEndDate))
    if (subscription?.from) {
      const d = new Date(subscription.from)
      d.setDate(d.getDate() + 30)
      return formatDate(d)
    }
    return ''
  })()

  // Upcoming charge = regular subscription fee (deals only apply to the current cycle)
  // + pending (not-yet-charged) overage − any active discount.
  // Distinct from `total`, which is the running cumulative for the current cycle.
  const nextChargeAmount = Math.max(0, subscriptionFee + currentPlanExtraOrderFee - discount)

  return (
    <Card>
      <BlockStack gap="400">
        {/* Header */}
        <InlineStack align="space-between" blockAlign="center" gap="100">
          <InlineStack gap="200" blockAlign="center">
            <Text as="h2" variant="headingMd">
              {t('current-plan')}
            </Text>
            <div
              style={{
                padding: '2px 8px',
                borderRadius: '8px',
                backgroundColor: 'var(--p-color-bg-fill-success-secondary, #cdfee1)',
                display: 'inline-block',
              }}
            >
              <Text as="span" variant="bodySm" fontWeight="semibold" tone="success">
                {planName}
              </Text>
            </div>
          </InlineStack>
          {subscriberMode && onChangePlan && <ManageSubscriptionPopover t={t} onChangePlan={onChangePlan} />}
        </InlineStack>

        {/* Trial progress section (only when in trial) */}
        {isInTrial && (
          <TrialProgressSection
            currentDay={trialCurrentDay}
            totalDays={trialDays}
            startDate={trialStartFormatted}
            endDate={trialEndFormatted}
            planName={planName}
            planPrice={subscriptionFee}
            isFirstMonthDeal={isFirstMonthDeal}
            t={t}
          />
        )}

        {/* Usage period */}
        <BlockStack gap="050">
          <Text as="p" variant="bodyMd" tone="subdued">
            {t('usage-and-charge-from-start-end', {
              start: usagePeriodStart,
              end: usagePeriodEnd,
            })}
          </Text>
          {subscriberMode && nextChargeDate && (
            <Text as="p" variant="bodyMd" tone="subdued">
              {t('next-charge-on-amount', { date: nextChargeDate, amount: `$${nextChargeAmount.toFixed(2)}` })}
            </Text>
          )}
        </BlockStack>

        {/* 2-column layout: Pricing | Usage Stats */}
        <InlineGrid columns={mdDown ? 1 : 2} gap={mdDown ? '200' : '2000'}>
          {/* Left column: Pricing breakdown */}
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <BlockStack gap="050">
                <Text as="p" variant="bodyMd">
                  {t('subscription-fee')}
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  {t('count-free-orders-per-month', { count: includedOrders })}
                </Text>
              </BlockStack>
              {isFirstMonthDeal ? (
                <BlockStack gap="050" inlineAlign="end">
                  <InlineStack gap="100" blockAlign="center">
                    <Text as="span" variant="bodyMd" tone="subdued">
                      <s>${subscriptionFee.toFixed(2)}</s>
                    </Text>
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      $1.00
                    </Text>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {t('first-month-deal')}
                  </Text>
                </BlockStack>
              ) : (
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  ${effectiveSubscriptionFee.toFixed(2)}
                </Text>
              )}
            </InlineStack>

            {effectiveExtraOrderFee > 0 && (
              <InlineStack align="space-between" blockAlign="start">
                <BlockStack gap="050">
                  <Text as="p" variant="bodyMd">
                    {t('extra-order-fee')}
                  </Text>
                  <Link onClick={() => setModalActive(true)} removeUnderline>
                    {t('learn-more')}
                  </Link>
                </BlockStack>
                {loadingBillingHistory ? (
                  <Box width="62px">
                    <SkeletonBodyText lines={1} />
                  </Box>
                ) : (
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    ${effectiveExtraOrderFee.toFixed(2)}
                  </Text>
                )}
              </InlineStack>
            )}

            {/* Subtotal + Discount only render when there's a discount (otherwise Subtotal === Total). */}
            {discount > 0 && (
              <>
                <div
                  style={{
                    borderTop: '1px solid var(--p-color-border-secondary)',
                    margin: '4px 0',
                  }}
                />

                <InlineStack align="space-between">
                  <Text as="p" variant="bodyMd">
                    {t('subtotal')}
                  </Text>
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    ${subtotal.toFixed(2)}
                  </Text>
                </InlineStack>

                <InlineStack align="space-between">
                  <Text as="p" variant="bodyMd">
                    {t('discount')}
                  </Text>
                  {couponLoading ? (
                    <Box width="62px">
                      <SkeletonBodyText lines={1} />
                    </Box>
                  ) : (
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      — ${discount.toFixed(2)}
                    </Text>
                  )}
                </InlineStack>
              </>
            )}

            <div
              style={{
                borderTop: '1px solid var(--p-color-border-secondary)',
                margin: '4px 0',
              }}
            />

            <InlineStack align="space-between">
              <Text as="p" variant="headingLg">
                {t('total')}
              </Text>
              {couponLoading ? (
                <Box width="80px">
                  <SkeletonBodyText lines={1} />
                </Box>
              ) : (
                <Text as="p" variant="headingLg">
                  ${total.toFixed(2)}
                </Text>
              )}
            </InlineStack>

            <Text as="p" variant="bodyMd" tone="subdued">
              {t('billed-on-the-first-day-of-shopify-billing-cycle')}
            </Text>
            {isFirstMonthDeal && (
              <Box background="bg-surface-secondary" borderRadius="200" padding="200">
                <Text as="p" variant="bodySm" tone="subdued">
                  {`Regular price of $${subscriptionFee.toFixed(2)}/mo starts from ${regularPriceStartDate}`}
                </Text>
              </Box>
            )}
          </BlockStack>

          <div>
            {/* Right column: Merged usage stats */}
            <UsageStatsSection
              orders={{ free: freeOrders, total: includedOrders, extra: extraOrders }}
              aiCredits={aiCredits}
              t={t}
              purchasedCreditsLoading={purchasedCreditsLoading}
              showBuyCreditsCta={subscriberMode}
            />
          </div>
        </InlineGrid>

        <AiCreditBannerSection aiCredit={shopData?.usages?.aiCredit} allocation={plan?.aiCreditsPerMonth} />

        {/* Passive cancel hint — Shopify auto-cancels the recurring charge on uninstall. */}
        {subscriberMode && (
          <Text as="p" variant="bodySm" tone="subdued">
            {t('cancel-anytime-by-uninstalling')}
          </Text>
        )}
      </BlockStack>

      {/* Extra Order Fee Modal */}
      <ExtraOrderFeeModal
        active={modalActive}
        onClose={() => setModalActive(false)}
        billingCycles={billingCycles}
        currentPlanCharges={currentPlanCharges}
        t={t}
      />
    </Card>
  )
}

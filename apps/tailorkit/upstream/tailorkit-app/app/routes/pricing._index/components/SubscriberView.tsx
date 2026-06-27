import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BlockStack, Button, InlineStack, Text } from '@shopify/polaris'
import type { PricingViewProps } from '../types'
import { UsageCard } from './index'
import PlanSelectionCards from './PlanSelectionCards'
import { PricingCalculator } from './PricingCalculator'
import { FeatureComparisonTable } from './FeatureComparisonTable'
import { FAQ } from './FAQ'
import { UpgradeDeltaCard } from './UpgradeDeltaCard'
import { buildPlanColumns, buildFeatureDefinitions } from '../utils/buildFeatureComparison'
import { useModal } from '~/utils/hooks/useModal'
import { findTopTierPlan, isTopTierPlan } from '../utils/subscriber-mode'
import { computeMonthlyOrderEstimate } from '../utils/calculator-defaults'
import { getFreeOrdersCount } from '~/models/helpers/pricing-utils'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING, EVENTS_PARAMETERS_NAME } from '~/bootstrap/constants/eventsTracking'
import type { PricingPlanDocument } from '~/models/PricingPlan'

/**
 * Subscriber/Billing view (active paid plan, not in V1→V2 migration).
 *
 * Differs from ProspectView by:
 *  - Heading reads "Billing" (not "Pricing").
 *  - Marketing sections removed: SocialProofSection, OldVsNewComparison.
 *  - Plan-selection grid is collapsed behind "Compare all plans".
 *  - On below-top-tier: focused UpgradeDeltaCard replaces the multi-button bottom CTA.
 *  - On top tier: zero plan cards above the fold.
 *  - PricingCalculator collapsed by default (subscriber already chose a plan).
 */
export default function SubscriberView(props: PricingViewProps) {
  const {
    t,
    shopData,
    v2Plans,
    plan,
    remainingTrialDays,
    billingCycleBaseline,
    billingCycles,
    showPricingCalculator,
    togglePricingCalculator,
    showFeatureComparisonTable,
    toggleFeatureComparisonTable,
    showFAQ,
    toggleFAQ,
    onSelectPlanByAlias,
  } = props
  const { openModal } = useModal()
  const { trackEvent } = useEventsTracking()

  const onTopTier = isTopTierPlan(plan, v2Plans)
  const targetPlan = findTopTierPlan(v2Plans)
  const planName = plan && typeof plan !== 'string' ? plan.name : ''
  const currentPlan = plan && typeof plan !== 'string' ? (plan as PricingPlanDocument) : undefined

  // Personalize the calculator: extrapolate current cycle usage to a 30-day estimate.
  // Falls back to the prospect default (150) when shop usage is unavailable.
  const calculatorInitialOrders = useMemo(() => {
    const usage = shopData?.usages?.orders
    if (typeof usage !== 'number') return 150
    const activeCycle = (billingCycles || []).find(c => c.status === 'active')
    return computeMonthlyOrderEstimate({
      currentOrderUsage: usage,
      cycleStartDate: activeCycle?.cycleStartDate,
      includedQuota: currentPlan ? getFreeOrdersCount(currentPlan) : undefined,
    })
  }, [shopData, billingCycles, currentPlan])

  // Fire BILLING_PAGE_VIEW once per mount. PRICING_PAGE_VIEW is suppressed
  // for the subscriber path in route.tsx to keep the two events mutually
  // exclusive per page load.
  useEffect(() => {
    trackEvent(EVENTS_TRACKING.BILLING_PAGE_VIEW, {
      [EVENTS_PARAMETERS_NAME.CURRENT_PLAN_NAME]: planName,
      [EVENTS_PARAMETERS_NAME.PLAN_ALIAS]: currentPlan?.alias || '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // "Compare all plans" reveals the full PlanSelectionCards grid (default collapsed).
  const [showAllPlans, setShowAllPlans] = useState(false)
  const toggleAllPlans = useCallback(() => {
    const expanded = !showAllPlans
    trackEvent(EVENTS_TRACKING.BILLING_ACTION_CLICK, {
      [EVENTS_PARAMETERS_NAME.ACTION]: 'compare_all_plans',
      [EVENTS_PARAMETERS_NAME.EXPANDED]: expanded,
    })
    setShowAllPlans(expanded)
  }, [trackEvent, showAllPlans])

  // Scroll-to-cards affordance when the manage popover triggers Compare-all reveal
  // (top-tier path). One-shot flag, cleared after scroll.
  const compareSectionRef = useRef<HTMLDivElement>(null)
  const shouldScrollToCompareRef = useRef(false)
  useEffect(() => {
    if (showAllPlans && shouldScrollToCompareRef.current) {
      shouldScrollToCompareRef.current = false
      compareSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [showAllPlans])

  // Manage popover's "Change plan" routes to the most relevant action:
  //  - On top tier: open the comparison grid + scroll to it.
  //  - Below top tier: open the upgrade modal directly via the same handler the
  //    UpgradeDeltaCard CTA uses.
  const handleChangePlan = useCallback(() => {
    if (!onTopTier && targetPlan) {
      onSelectPlanByAlias(targetPlan.alias || targetPlan.name)
      return
    }
    shouldScrollToCompareRef.current = true
    setShowAllPlans(true)
  }, [onTopTier, targetPlan, onSelectPlanByAlias])

  return (
    <BlockStack gap="300">
      {/* Header */}
      <Text as="h1" variant="headingXl">
        {t('billing')}
      </Text>

      {/* Current-plan / usage card (consolidated billing surface) */}
      <UsageCard
        shopData={shopData}
        t={t}
        billingCycleBaseline={billingCycleBaseline}
        billingCycles={billingCycles}
        subscriberMode
        onChangePlan={handleChangePlan}
      />

      {/* Focused upgrade CTA for sub-top-tier subscribers */}
      {!onTopTier && targetPlan && currentPlan && (
        <UpgradeDeltaCard currentPlan={currentPlan} targetPlan={targetPlan} onUpgrade={onSelectPlanByAlias} t={t} />
      )}

      {/* Compare all plans — collapsed by default */}
      {v2Plans.length > 0 && (
        <div ref={compareSectionRef}>
          <BlockStack gap="200">
            <InlineStack align="center">
              <Button variant="plain" removeUnderline onClick={toggleAllPlans}>
                {showAllPlans ? t('hide-compare-all-plans') : t('compare-all-plans')}
              </Button>
            </InlineStack>
            {showAllPlans && (
              <PlanSelectionCards
                t={t}
                plans={v2Plans}
                onSelectPlan={onSelectPlanByAlias}
                remainingTrialDays={remainingTrialDays}
                billingCycleBaseline={billingCycleBaseline}
              />
            )}
          </BlockStack>
        </div>
      )}

      {/* Pricing calculator — collapsed by default for subscribers, personalized */}
      <BlockStack gap="200">
        <Button variant="plain" removeUnderline onClick={togglePricingCalculator}>
          {showPricingCalculator ? t('hide-pricing-plan-calculator') : t('pricing-plan-calculator')}
        </Button>
        {v2Plans.length > 0 && showPricingCalculator && (
          <PricingCalculator t={t} plans={v2Plans} initialOrderCount={calculatorInitialOrders} subscriberMode />
        )}
      </BlockStack>

      {/* Key features comparison */}
      <BlockStack gap="200">
        <InlineStack align="center">
          <Button variant="plain" removeUnderline onClick={toggleFeatureComparisonTable}>
            {showFeatureComparisonTable ? t('hide-key-features') : t('key-features')}
          </Button>
        </InlineStack>
        {v2Plans.length > 0 && showFeatureComparisonTable && (
          <FeatureComparisonTable
            t={t}
            headerLabel={
              <Text as="h3" variant="headingMd" fontWeight="bold">
                {t('key-features')}
              </Text>
            }
            plans={buildPlanColumns(v2Plans)}
            features={buildFeatureDefinitions(v2Plans, t, openModal)}
          />
        )}
      </BlockStack>

      {/* Billing FAQ — subscriber-oriented questions */}
      <BlockStack gap="200">
        <InlineStack align="center">
          <Button variant="plain" onClick={toggleFAQ}>
            {showFAQ ? t('hide-billing-faq') : t('billing-faq')}
          </Button>
        </InlineStack>
        {showFAQ && <FAQ t={t} plans={v2Plans} isSubscriber />}
      </BlockStack>
    </BlockStack>
  )
}

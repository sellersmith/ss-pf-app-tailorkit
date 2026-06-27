import { useEffect, useRef } from 'react'
import { BlockStack, Box, InlineGrid, Text, useBreakpoints } from '@shopify/polaris'
import type { TFunction } from 'i18next'
import type { SubscriptionDocument } from '~/models/Subscription'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import { mapPlansToDisplayData } from '../../utils/planDisplayMapper'
import PlanCard from './PlanCard'
import type { PlanAction } from './PlanCard'
import { useRootLoaderData } from '~/root'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'

interface PlanSelectCardsProps {
  onSelectPlan: (planAlias: string) => void
  loadingPlanAlias?: string
  plans: PricingPlanDocument[]
  t: TFunction
  remainingTrialDays?: number | null
  billingCycleBaseline: number
}

function getPlanAction(
  planAlias: string,
  planPrice: number,
  currentPlanAlias?: string,
  currentPlanPrice?: number
): PlanAction {
  if (!currentPlanAlias) return 'select'
  if (currentPlanAlias === planAlias) return 'current'
  return planPrice > currentPlanPrice! ? 'upgrade' : 'downgrade'
}

export default function PlanSelectCards(props: PlanSelectCardsProps) {
  const { onSelectPlan, loadingPlanAlias, plans, t, remainingTrialDays, billingCycleBaseline } = props
  const { mdDown } = useBreakpoints()
  const { trackDiscovered: trackTrialDiscovered } = useFeatureTracking('dynamic_trial_days')

  // Track when dynamic trial days are displayed to the merchant (once per mount)
  const trackedTrialRef = useRef(false)
  useEffect(() => {
    if (
      remainingTrialDays !== null
      && remainingTrialDays !== undefined
      && remainingTrialDays > 0
      && !trackedTrialRef.current
    ) {
      trackedTrialRef.current = true
      trackTrialDiscovered('pricing_page')
    }
  }, [remainingTrialDays, trackTrialDiscovered])

  // Get shopData and deal flags from root loader (no prop drilling needed)
  const { shopData, isDealActive, isDealEligible } = useRootLoaderData() || {}
  const subscription = shopData?.subscription as SubscriptionDocument | null
  const currentPlan = subscription?.plan as PricingPlanDocument | null
  const currentPlanAlias = currentPlan?.alias
  const currentPlanPrice = currentPlan?.price

  // Get current order count from shopData (cached value - OK for UI display)
  const currentOrderCount = shopData?.usages?.orders || 0

  // Convert database plans to display format with projected pricing
  // billingCycleBaseline comes from BillingStateManager via loader
  const displayPlans = mapPlansToDisplayData(plans, t, subscription, currentOrderCount, billingCycleBaseline)

  // On mobile, show Growth card first (reverse price-sorted order) for CRO
  const orderedPlans = mdDown ? [...displayPlans].reverse() : displayPlans

  const planCards = orderedPlans.map(plan => (
    <PlanCard
      key={plan.alias}
      plan={plan}
      onSelectPlan={onSelectPlan}
      planAction={getPlanAction(plan.alias, plan.price, currentPlanAlias, currentPlanPrice)}
      isLoading={loadingPlanAlias === plan.alias}
      t={t}
      remainingTrialDays={remainingTrialDays}
      isDealActive={isDealActive}
      isDealEligible={isDealEligible}
    />
  ))

  return (
    <Box paddingInline={mdDown ? '400' : '0'}>
      <BlockStack gap="300">
        <Text as="h3" variant="headingMd">
          {t('see-what-each-plan-includes')}
        </Text>
        {mdDown ? (
          <BlockStack gap="400">{planCards}</BlockStack>
        ) : (
          <InlineGrid columns={displayPlans.length} gap="400">
            {planCards}
          </InlineGrid>
        )}
      </BlockStack>
    </Box>
  )
}

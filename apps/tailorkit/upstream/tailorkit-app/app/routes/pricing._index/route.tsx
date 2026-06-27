/**
 * Unified Pricing Page
 *
 * Features:
 * - Auto-detects pricing version (V1 revenue-based vs V2 order-based)
 * - V1 era users (no approved charge): Shows migration discount + OldVsNewComparison
 * - V2 Calculator UI: Shows for new users with PricingCalculator for plan recommendation
 * - SelectPlanModal for confirming plan selection
 * - Discount code validation
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import type { ClientLoaderFunctionArgs } from '@remix-run/react'
import { useLoaderData, useNavigate } from '@remix-run/react'
import { Page, BlockStack } from '@shopify/polaris'
import { showToast, showGenericErrorToast } from '~/utils/toastEvents'
import withNavMenu from '~/bootstrap/hoc/withNavMenu'
import type { WithTranslationProps } from '~/bootstrap/hoc/withTranslation'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import { SelectPlanModal } from './components/SelectPlanModal'
import type { CalculatedPrice } from './components/PricingCalculator/types'
import { fetchPricingPlansV2, fetchTrialInfo, subscribeToPlan, fetchBillingState, fetchBillingCycles } from './fns'
import { useRootLoaderData } from '~/root'
import type { SubscriptionDocument } from '~/models/Subscription'
import { hasActivePlan } from '~/models/PricingPlan.fns'
import { getFreeOrdersCount, getOverageFeePerOrder } from '~/models/helpers/pricing-utils'
import { useModal } from '~/utils/hooks/useModal'
import { MODAL_ID } from '~/constants/modal'
import { MIGRATION_COUPON_CODE } from './utils/oldPricingCalculation'
import type { BillingCycleDocument } from '~/models/BillingCycle'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING, EVENTS_PARAMETERS_NAME } from '~/bootstrap/constants/eventsTracking'
import SubscriberView from './components/SubscriberView'
import ProspectView from './components/ProspectView'
import { isSubscriberView } from './utils/subscriber-mode'

import { calculateRemainingTrialDays, type TrialInfo } from './utils/trial-calculations'

interface LoaderData {
  v2Plans: PricingPlanDocument[]
  chargeCancelled?: boolean
  openBuyCredits?: boolean
  aiCreditsPurchased?: boolean
  trialInfo?: TrialInfo
  billingCycles: BillingCycleDocument[]
  billingCycleBaseline: number
}

export const clientLoader = async ({ request }: ClientLoaderFunctionArgs): Promise<LoaderData> => {
  const { searchParams } = new URL(request.url)

  // Detect if user cancelled Shopify charge approval
  // When cancelled, Shopify redirects back with subscription_id but without charge_id
  const subscriptionId = searchParams.get('subscription_id')
  const chargeId = searchParams.get('charge_id')
  const chargeCancelled = !!subscriptionId && !chargeId

  // Detect if user clicked "Buy AI Credits" from email link
  const openBuyCredits = searchParams.get('buy-credits') === 'true'

  // Detect if user just completed AI credits purchase (from callback route)
  const aiCreditsPurchased = searchParams.get('ai_credits_purchased') === 'true'

  const [v2Plans, trialInfo, billingStateResult, billingCycles] = await Promise.all([
    fetchPricingPlansV2(),
    fetchTrialInfo(),
    fetchBillingState(),
    fetchBillingCycles(),
  ])

  return {
    v2Plans,
    chargeCancelled,
    openBuyCredits,
    aiCreditsPurchased,
    trialInfo,
    billingCycles,
    billingCycleBaseline: billingStateResult.billingCycleBaseline,
  }
}

export function HydrateFallback() {
  return null
}

const Index = withNavMenu(function Index(props: WithTranslationProps) {
  const { t } = props
  const { shopData, isDealActive, isDealEligible } = useRootLoaderData()
  const loaderData = useLoaderData<typeof clientLoader>()
  const navigate = useNavigate()
  const { openModal } = useModal()
  const { trackEvent } = useEventsTracking()

  const { v2Plans = [], chargeCancelled, openBuyCredits, aiCreditsPurchased, trialInfo } = loaderData || {}

  // Calculate remaining trial days based on server trial info
  const remainingTrialDays = useMemo(() => {
    const maxTrialDays = Math.max(...v2Plans.map(p => p.trialDays || 0), 0)
    return calculateRemainingTrialDays(trialInfo, maxTrialDays)
  }, [trialInfo, v2Plans])

  const billingCycles = loaderData?.billingCycles || []
  const billingCycleBaseline = loaderData?.billingCycleBaseline || 0

  // Detect pricing version from shop data
  const subscription = shopData?.subscription as SubscriptionDocument
  const plan = subscription?.plan

  // Check if user has an active V1 revenue-based plan
  // V1 plans should always see V1 UI, regardless of shopifyCharge status
  const hasActiveV1Plan = useMemo(() => {
    if (!subscription || !plan || typeof plan === 'string') {
      return false
    }

    // Check if plan is revenue-based (has usages.revenue but not usages.orders)
    // This is the capability-based detection for V1 plans
    const revenueUsage = plan.usages?.revenue || []
    const isV1Plan = revenueUsage.length > 0 && (!plan.usages?.orders || plan.usages.orders.length === 0)

    return isV1Plan
  }, [subscription, plan])

  // Check if user has approved charge
  const hasApprovedCharge = useMemo(() => {
    if (!subscription) return false
    return subscription.status === 'active' && subscription.shopifyCharge?.status === 'active'
  }, [subscription])

  // User needs migration if they are on a V1 plan, or have never approved a V2 charge
  const isOldPricingMigration = (hasActiveV1Plan && hasApprovedCharge) || (subscription && !hasApprovedCharge)

  // Compute subscriber-mode gate once; used by view selector and state defaults below.
  const subscriberMode = isSubscriberView(shopData, !!isOldPricingMigration)

  // Track pricing page view on mount.
  // Subscriber view fires BILLING_PAGE_VIEW from <SubscriberView /> instead;
  // gate this event on prospect path to keep them mutually exclusive.
  useEffect(() => {
    if (subscriberMode) return
    const currentPlanName = plan && typeof plan !== 'string' ? plan.alias || plan.name || '' : ''
    trackEvent(EVENTS_TRACKING.PRICING_PAGE_VIEW, {
      [EVENTS_PARAMETERS_NAME.HAS_ACTIVE_PLAN]: hasActivePlan(shopData),
      [EVENTS_PARAMETERS_NAME.CURRENT_PLAN_NAME]: currentPlanName,
      [EVENTS_PARAMETERS_NAME.IS_MIGRATION_USER]: !!isOldPricingMigration,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Show success toast after AI credits purchase and clean up URL
  useEffect(() => {
    if (aiCreditsPurchased && typeof window !== 'undefined') {
      showToast(t('ai-credits-purchased-successfully'))
      navigate('/pricing', { replace: true })
    }
  }, [aiCreditsPurchased, navigate, t])

  // Auto-open Buy AI Credits modal when navigating from email link (?buy-credits=true)
  useEffect(() => {
    if (openBuyCredits) {
      openModal(MODAL_ID.BUY_AI_CREDITS_MODAL, { isOpen: true })
      navigate('/pricing', { replace: true })
    }
  }, [openBuyCredits, openModal, navigate])

  // Reload page once to get fresh shopData after cancellation
  // This ensures the cancelled subscription is removed from display
  useEffect(() => {
    if (chargeCancelled && typeof window !== 'undefined') {
      trackEvent(EVENTS_TRACKING.PRICING_CHECKOUT_RESULT, {
        [EVENTS_PARAMETERS_NAME.CHECKOUT_OUTCOME]: 'cancelled',
      })
      const reloaded = sessionStorage.getItem('cancellation_reloaded')
      if (!reloaded) {
        sessionStorage.setItem('cancellation_reloaded', 'true')
        window.location.reload()
      } else {
        // Clear flag after showing the banner once
        sessionStorage.removeItem('cancellation_reloaded')
      }
    }
  }, [chargeCancelled, trackEvent])

  const currentOrderUsage = shopData?.usages?.orders || 0
  const currentAiCreditUsage = shopData?.usages?.aiCredit?.monthlyUsage || 0

  // State for plan selection (V2 calculator UI)
  const [selectedPlan, setSelectedPlan] = useState<PricingPlanDocument | null>(null)
  const [calculatedPrice, setCalculatedPrice] = useState<CalculatedPrice | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubscribing, setIsSubscribing] = useState(false)
  // Subscribers already chose a plan — collapse calculator by default.
  // Prospects: keep open to support shopping/decision-making.
  const [showPricingCalculator, setShowPricingCalculator] = useState(!subscriberMode)
  const [showFeatureComparisonTable, setShowFeatureComparisonTable] = useState(false)
  const [showFAQ, setShowFAQ] = useState(false)

  const togglePricingCalculator = useCallback(() => {
    setShowPricingCalculator(prev => {
      trackEvent(EVENTS_TRACKING.PRICING_SECTION_TOGGLED, {
        [EVENTS_PARAMETERS_NAME.SECTION_NAME]: 'pricing_calculator',
        section_visible: !prev,
      })
      return !prev
    })
  }, [trackEvent])

  const toggleFeatureComparisonTable = useCallback(() => {
    setShowFeatureComparisonTable(prev => {
      const willBeVisible = !prev
      trackEvent(EVENTS_TRACKING.PRICING_SECTION_TOGGLED, {
        [EVENTS_PARAMETERS_NAME.SECTION_NAME]: 'feature_comparison',
        section_visible: willBeVisible,
      })
      if (willBeVisible) {
        trackEvent(EVENTS_TRACKING.PRICING_FEATURE_TABLE_VIEWED)
      }
      return willBeVisible
    })
  }, [trackEvent])

  const toggleFAQ = useCallback(() => {
    setShowFAQ(prev => {
      trackEvent(EVENTS_TRACKING.PRICING_SECTION_TOGGLED, {
        [EVENTS_PARAMETERS_NAME.SECTION_NAME]: 'faq',
        section_visible: !prev,
      })
      return !prev
    })
  }, [trackEvent])

  // Handle plan selection from cards (by alias) - Open modal for confirmation
  const handleSelectPlanByAlias = useCallback(
    (planAlias: string) => {
      const plan = v2Plans.find(p => p.alias === planAlias)

      if (!plan) return

      trackEvent(EVENTS_TRACKING.PRICING_SELECT_PLAN, {
        [EVENTS_PARAMETERS_NAME.PLAN_NAME]: plan.name,
        [EVENTS_PARAMETERS_NAME.PLAN_ALIAS]: planAlias,
        [EVENTS_PARAMETERS_NAME.PLAN_PRICE]: plan.price || 0,
        [EVENTS_PARAMETERS_NAME.SOURCE_COMPONENT]: 'plan_card',
      })

      // Calculate base price for the plan (no discount code from cards)
      const calculatedPrice: CalculatedPrice = {
        subscriptionFee: plan.price || 0,
        extraOrderFee: 0,
        subtotal: plan.price || 0,
        discount: 0,
        total: plan.price || 0,
        includedOrders: getFreeOrdersCount(plan),
        overageFeePerOrder: getOverageFeePerOrder(plan),
      }

      setSelectedPlan(plan)
      setCalculatedPrice(calculatedPrice)
      setIsModalOpen(true)
    },
    [v2Plans, trackEvent]
  )

  // Handle modal close
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  // Handle plan confirmation
  const handleConfirmPlan = useCallback(
    async (discountCode?: string) => {
      if (!selectedPlan) return

      trackEvent(EVENTS_TRACKING.PRICING_CONFIRM_PLAN, {
        [EVENTS_PARAMETERS_NAME.PLAN_NAME]: selectedPlan.name,
        [EVENTS_PARAMETERS_NAME.PLAN_ALIAS]: selectedPlan.alias || '',
        [EVENTS_PARAMETERS_NAME.PLAN_PRICE]: selectedPlan.price || 0,
        [EVENTS_PARAMETERS_NAME.DISCOUNT_CODE]: discountCode || calculatedPrice?.discountCode || '',
        [EVENTS_PARAMETERS_NAME.DISCOUNT_AMOUNT]: calculatedPrice?.discount || 0,
        [EVENTS_PARAMETERS_NAME.TOTAL_PRICE]: calculatedPrice?.total || 0,
        [EVENTS_PARAMETERS_NAME.IS_MIGRATION_USER]: !!isOldPricingMigration,
      })

      setIsSubscribing(true)

      try {
        // Use discount code from parameter if provided, otherwise use the one from calculatedPrice
        const finalDiscountCode = discountCode || calculatedPrice?.discountCode
        const result = await subscribeToPlan(selectedPlan._id, finalDiscountCode)

        if (result.success && result.confirmationUrl) {
          // Redirect to Shopify billing confirmation (same tab)
          window.parent.location.href = result.confirmationUrl
          return // Exit early to prevent error state updates
        }
      } catch {
        showGenericErrorToast()
      } finally {
        setIsSubscribing(false)
      }
    },
    [selectedPlan, calculatedPrice, trackEvent, isOldPricingMigration]
  )

  const sharedViewProps = {
    t,
    shopData,
    v2Plans,
    plan,
    hasActiveV1Plan,
    isOldPricingMigration: !!isOldPricingMigration,
    remainingTrialDays,
    billingCycleBaseline,
    billingCycles,
    showPricingCalculator,
    togglePricingCalculator,
    showFeatureComparisonTable,
    toggleFeatureComparisonTable,
    showFAQ,
    toggleFAQ,
    onSelectPlanByAlias: handleSelectPlanByAlias,
  }

  return (
    <Page>
      <BlockStack gap="300">
        {subscriberMode ? <SubscriberView {...sharedViewProps} /> : <ProspectView {...sharedViewProps} />}

        {/* Select Plan Modal — shared across both views */}
        <SelectPlanModal
          t={t}
          open={isModalOpen}
          onClose={handleCloseModal}
          plan={selectedPlan}
          calculatedPrice={calculatedPrice}
          onConfirm={handleConfirmPlan}
          isLoading={isSubscribing}
          isOldPricingMigration={isOldPricingMigration}
          currentOrderUsage={currentOrderUsage}
          currentAiCreditUsage={currentAiCreditUsage}
          migrationCouponCode={isOldPricingMigration ? MIGRATION_COUPON_CODE : undefined}
          remainingTrialDays={remainingTrialDays}
          isDealActive={isDealActive}
          isDealEligible={isDealEligible}
        />
      </BlockStack>
    </Page>
  )
})

export default Index

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Modal, BlockStack, Text, Spinner, InlineStack, Button, Collapsible } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { MODAL_ID } from '~/constants/modal'
import { useModal } from '~/utils/hooks/useModal'
import { useRootLoaderData } from '~/root'
import PlanSelectionCards from '~/routes/pricing._index/components/PlanSelectionCards'
import { PricingCalculator } from '~/routes/pricing._index/components/PricingCalculator/PricingCalculator'
import { SelectPlanModal } from '~/routes/pricing._index/components/SelectPlanModal/SelectPlanModal'
import { FAQ } from '~/routes/pricing._index/components/FAQ/FAQ'
import { FeatureComparisonTable } from '~/routes/pricing._index/components/FeatureComparisonTable'
import { buildPlanColumns, buildFeatureDefinitions } from '~/routes/pricing._index/utils/buildFeatureComparison'
import { useLiveChat } from '~/utils/hooks/useLiveChat'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import type { CalculatedPrice } from '~/routes/pricing._index/utils/planRecommendation'
import { getFreeOrdersCount, getOverageFeePerOrder } from '~/models/helpers/pricing-utils'
import { fetchPricingPlansV2, fetchBillingState, fetchTrialInfo, subscribeToPlan } from '~/routes/pricing._index/fns'
import { calculateRemainingTrialDays, type TrialInfo } from '~/routes/pricing._index/utils/trial-calculations'

// no-op for buildFeatureDefinitions openModal param (not used in current feature definitions)
const noop = () => {}

export function OnboardingPricingModal() {
  const { t } = useTranslation()
  const { state, closeModal } = useModal()
  const { isDealActive, isDealEligible } = useRootLoaderData() || {}
  const { openChat } = useLiveChat()
  const isOpen = state[MODAL_ID.ONBOARDING_PRICING_MODAL]?.active ?? false

  // Data state
  const [plans, setPlans] = useState<PricingPlanDocument[]>([])
  const [billingCycleBaseline, setBillingCycleBaseline] = useState(0)
  const [trialInfo, setTrialInfo] = useState<TrialInfo>({ hasUsedTrial: false })
  const [isLoadingPlans, setIsLoadingPlans] = useState(false)

  // Collapsible section states
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const [keyFeaturesOpen, setKeyFeaturesOpen] = useState(false)
  const [faqOpen, setFaqOpen] = useState(false)

  // Confirmation step state
  const [selectedPlan, setSelectedPlan] = useState<PricingPlanDocument | null>(null)
  const [calculatedPrice, setCalculatedPrice] = useState<CalculatedPrice | null>(null)
  const [isSubscribing, setIsSubscribing] = useState(false)

  const remainingTrialDays = useMemo(() => {
    const maxTrialDays = Math.max(...plans.map(p => p.trialDays || 0), 0)
    return calculateRemainingTrialDays(trialInfo, maxTrialDays)
  }, [trialInfo, plans])

  // Fetch plans when modal opens
  useEffect(() => {
    if (!isOpen || plans.length > 0) return

    let cancelled = false
    setIsLoadingPlans(true)

    Promise.all([fetchPricingPlansV2(), fetchBillingState(), fetchTrialInfo()])
      .then(([fetchedPlans, billingData, fetchedTrialInfo]) => {
        if (cancelled) return
        setPlans(fetchedPlans)
        setBillingCycleBaseline(billingData.billingCycleBaseline)
        setTrialInfo(fetchedTrialInfo)
      })
      .catch(error => {
        console.error('[OnboardingPricing] Failed to fetch plans:', error)
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPlans(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, plans.length])

  // Reset to plan selection when modal reopens
  useEffect(() => {
    if (isOpen) {
      setSelectedPlan(null)
      setCalculatedPrice(null)
      setCalculatorOpen(false)
      setKeyFeaturesOpen(false)
      setFaqOpen(false)
    }
  }, [isOpen])

  const handleClose = useCallback(() => {
    closeModal(MODAL_ID.ONBOARDING_PRICING_MODAL)
  }, [closeModal])

  // From PlanSelectionCards (receives alias string)
  const handleSelectPlanAlias = useCallback(
    (planAlias: string) => {
      const plan = plans.find(p => p.alias === planAlias)
      if (!plan) return
      setSelectedPlan(plan)
      setCalculatedPrice({
        subscriptionFee: plan.price || 0,
        extraOrderFee: 0,
        subtotal: plan.price || 0,
        discount: 0,
        total: plan.price || 0,
        includedOrders: getFreeOrdersCount(plan),
        overageFeePerOrder: getOverageFeePerOrder(plan),
      })
    },
    [plans]
  )

  const handleCloseConfirm = useCallback(() => {
    setSelectedPlan(null)
    setCalculatedPrice(null)
  }, [])

  const handleConfirmSubscription = useCallback(
    async (discountCode?: string) => {
      if (!selectedPlan?._id) return
      setIsSubscribing(true)
      try {
        const result = await subscribeToPlan(String(selectedPlan._id), discountCode)
        if (result.success && result.confirmationUrl) {
          // Store integration context for auto-publish after billing return
          const pathParts = window.location.pathname.split('/')
          const integrationId = pathParts[pathParts.length - 1]
          const searchParams = new URLSearchParams(window.location.search)
          sessionStorage.setItem(
            'TLK_ONBOARDING_PENDING_PUBLISH',
            JSON.stringify({ integrationId, mockupId: searchParams.get('mockup') || '' })
          )
          window.parent.location.href = result.confirmationUrl
        }
      } catch (error) {
        console.error('[OnboardingPricing] Failed to subscribe:', error)
      } finally {
        setIsSubscribing(false)
      }
    },
    [selectedPlan]
  )

  const handleContactUs = useCallback(() => {
    closeModal(MODAL_ID.ONBOARDING_PRICING_MODAL)
    if (typeof window !== 'undefined' && (window as any).$crisp) {
      setTimeout(() => {
        openChat(t('i-need-help-choosing-a-plan'))
      }, 100)
    } else {
      window.location.href = 'mailto:support@ecomate.co'
    }
  }, [closeModal, openChat, t])

  const showConfirm = selectedPlan !== null && calculatedPrice !== null
  const defaultTrialDays = plans[0]?.trialDays || 0
  const displayTrialDays
    = remainingTrialDays !== null && remainingTrialDays !== undefined ? remainingTrialDays : defaultTrialDays
  // Only show subtitle when it adds info (trial days). Otherwise modal title alone is enough.
  const trialText
    = displayTrialDays > 0
      ? t('select-a-plan-to-continue-enjoy-days-days-free-to-explore-all-features-before-any-payment-is-required', {
          days: displayTrialDays,
        })
      : null

  return (
    <>
      <Modal
        open={isOpen && !showConfirm}
        onClose={handleClose}
        size="large"
        title={t('select-a-plan')}
        secondaryActions={[
          {
            content: t('contact-us'),
            onAction: handleContactUs,
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {trialText && (
              <Text as="p" variant="bodyMd" tone="subdued">
                {trialText}
              </Text>
            )}

            {isLoadingPlans ? (
              <InlineStack align="center">
                <Spinner size="large" />
              </InlineStack>
            ) : (
              <>
                <PlanSelectionCards
                  plans={plans}
                  t={t}
                  onSelectPlan={handleSelectPlanAlias}
                  billingCycleBaseline={billingCycleBaseline}
                  remainingTrialDays={remainingTrialDays}
                />

                <Text as="p" variant="bodySm" tone="subdued">
                  {t('note-ai-credits-define-how-many-ai-generated-items-you-can-create-including-images-and-text')}
                </Text>

                <Button
                  variant="plain"
                  onClick={() => setCalculatorOpen(prev => !prev)}
                  ariaExpanded={calculatorOpen}
                  ariaControls="pricing-calculator-collapsible"
                >
                  {t('pricing-plan-calculator')}
                </Button>

                <Collapsible
                  open={calculatorOpen}
                  id="pricing-calculator-collapsible"
                  transition={{ duration: '200ms', timingFunction: 'ease-in-out' }}
                >
                  <PricingCalculator t={t} plans={plans} />
                </Collapsible>

                <Button
                  variant="plain"
                  onClick={() => setKeyFeaturesOpen(prev => !prev)}
                  ariaExpanded={keyFeaturesOpen}
                  ariaControls="key-features-collapsible"
                >
                  {keyFeaturesOpen ? t('hide-key-features') : t('key-features')}
                </Button>

                <Collapsible
                  open={keyFeaturesOpen}
                  id="key-features-collapsible"
                  transition={{ duration: '200ms', timingFunction: 'ease-in-out' }}
                >
                  <FeatureComparisonTable
                    t={t}
                    headerLabel={
                      <Text as="h3" variant="headingMd" fontWeight="bold">
                        {t('key-features')}
                      </Text>
                    }
                    plans={buildPlanColumns(plans)}
                    features={buildFeatureDefinitions(plans, t, noop)}
                  />
                </Collapsible>

                <Button
                  variant="plain"
                  onClick={() => setFaqOpen(prev => !prev)}
                  ariaExpanded={faqOpen}
                  ariaControls="faq-collapsible"
                >
                  {faqOpen ? t('hide-frequently-asked-questions') : t('frequently-asked-questions')}
                </Button>

                <Collapsible
                  open={faqOpen}
                  id="faq-collapsible"
                  transition={{ duration: '200ms', timingFunction: 'ease-in-out' }}
                >
                  <FAQ t={t} plans={plans} />
                </Collapsible>
              </>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>

      <SelectPlanModal
        t={t}
        open={isOpen && showConfirm}
        onClose={handleCloseConfirm}
        plan={selectedPlan}
        calculatedPrice={calculatedPrice}
        onConfirm={handleConfirmSubscription}
        isLoading={isSubscribing}
        remainingTrialDays={remainingTrialDays}
        isDealActive={isDealActive}
        isDealEligible={isDealEligible}
      />
    </>
  )
}

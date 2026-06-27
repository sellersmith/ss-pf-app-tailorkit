import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLoaderData, useNavigate } from '@remix-run/react'
import { BlockStack, Box, Spinner, Text } from '@shopify/polaris'
import { authenticatedFetch } from '~/shopify/fns.client'
import { PREFERENCES_ACTIONS } from '~/routes/api.preferences/constants'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { useABTestTracking } from '~/hooks/useABTestTracking'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { checkShouldAutoSend } from '~/providers/ChatBotContext'
import { SIMPLIFIED_ONBOARDING_AB_TEST_FLAG } from './flags'
import { CategorySelection } from './CategorySelection'
import { ProductSelectionModal } from './ProductSelectionModal'
import type { OnboardingStep } from './constants'
import type { clientLoader } from '../../route'

interface OnboardingFlowProps {
  onComplete: () => void
  /**
   * When provided, CategorySelection (step 1 of this flow) renders a Polaris
   * back action labeled "Dashboard". Used when the merchant explicitly chose
   * Full Editor from the install-intent page or the dropdown — gives them a
   * way out without committing to a category.
   */
  onBack?: () => void
}

export function OnboardingFlow({ onComplete, onBack }: OnboardingFlowProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { trackEvent } = useEventsTracking()
  const abTracking = useABTestTracking('simplified_product_publish_onboarding', 'control')
  const { shop } = useLoaderData<typeof clientLoader>()
  const isFirstTimeUser = checkShouldAutoSend(shop.appConfig)
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('category')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Track A/B test control group participation (only when AB test is active)
  useEffect(() => {
    if (SIMPLIFIED_ONBOARDING_AB_TEST_FLAG) {
      abTracking.trackDiscovered('onboarding_ab_test')
      abTracking.trackStarted()
    }
  }, [abTracking])

  // Fire start_onboarding once per shop (localStorage-deduped) so the legacy
  // funnel keeps working under the new control flow. Mirrors guard previously
  // used by OnboardingHighLight (the removed legacy entry point).
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!localStorage.getItem('TLK_ONBOARDING_START_AT')) {
      localStorage.setItem('TLK_ONBOARDING_START_AT', Date.now().toString())
    }
    const STARTED_KEY = 'TLK_STARTED_ONBOARDING'
    if (!localStorage.getItem(STARTED_KEY)) {
      localStorage.setItem(STARTED_KEY, 'true')
      trackEvent(EVENTS_TRACKING.START_ONBOARDING, {
        [EVENTS_PARAMETERS_NAME.VALUE]: 'control',
      })
    }
  }, [trackEvent])

  const handleSkip = useCallback(() => {
    trackEvent(EVENTS_TRACKING.SKIP_ONBOARDING)
    // A/B test tracking: control group abandoned
    if (SIMPLIFIED_ONBOARDING_AB_TEST_FLAG) {
      abTracking.trackAbandoned('category')
    }

    // Fire and forget — save preference in background
    authenticatedFetch('/api/preferences', {
      method: 'POST',
      body: JSON.stringify({
        action: PREFERENCES_ACTIONS.UPDATE_OCCURRED_EVENT,
        eventName: 'completed_onboarding',
        value: true,
      }),
    }).catch(error => console.error('[OnboardingFlow] Failed to save skip preference:', error))

    // Navigate immediately to avoid dashboard flash
    navigate('/pricing', { replace: true })
  }, [navigate, trackEvent, abTracking])

  const handleCardClick = useCallback(
    (id: string) => {
      setSelectedCategory(id || null)
      trackEvent(EVENTS_TRACKING.CONTINUE_ONBOARDING, {
        [EVENTS_PARAMETERS_NAME.VALUE]: id,
      })
      setCurrentStep('product')
    },
    [trackEvent]
  )

  const handleCloseProductSelector = useCallback(() => {
    setCurrentStep('category')
  }, [])

  // Track A/B test control group completion when product creation starts
  useEffect(() => {
    if (isCreating && SIMPLIFIED_ONBOARDING_AB_TEST_FLAG) {
      abTracking.trackCompleted('product_created', { selected_category: selectedCategory })
    }
  }, [isCreating, abTracking, selectedCategory])

  if (isCreating) {
    return (
      <Box paddingBlockStart="1600">
        <BlockStack gap="400" inlineAlign="center">
          <Spinner size="large" />
          <Text as="p" variant="bodyMd" tone="subdued">
            {t('setting-up-your-product')}
          </Text>
        </BlockStack>
      </Box>
    )
  }

  return (
    <>
      {currentStep === 'category' && (
        <CategorySelection
          t={t}
          onCardClick={handleCardClick}
          onSkip={handleSkip}
          isFirstTimeUser={isFirstTimeUser}
          onBack={onBack}
        />
      )}

      <ProductSelectionModal
        open={currentStep === 'product'}
        selectedCategory={selectedCategory}
        onClose={handleCloseProductSelector}
        onCreating={setIsCreating}
      />
    </>
  )
}

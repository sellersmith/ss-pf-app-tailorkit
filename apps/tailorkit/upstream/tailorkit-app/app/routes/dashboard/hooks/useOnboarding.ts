import { useEffect, useState } from 'react'
import { useLoaderData, useLocation, useNavigate } from '@remix-run/react'
import type { clientLoader } from '../route'
import { isApprovedCharge, canUseFreeResources } from '~/models/PricingPlan.fns'
import { checkShouldAutoSend } from '~/providers/ChatBotContext'
import { initOnboardingTimestamp } from '~/modules/Onboarding/utilities/initOnboardingTimestamp'
import { isOnboardingRoute } from '~/utils/shopify'
import { authenticatedFetch } from '~/shopify/fns.client'
import { ACTIVE_PRODUCT_ONBOARDING_FLAG } from '../components/OnboardingFlow/flags'
import type { ABTestGroup } from '~/modules/SimplifiedOnboarding/types'

export function useOnboarding() {
  const { shop } = useLoaderData<typeof clientLoader>()

  // Check if shop viewed demo product and onboarding modal
  const isChargeApproved = isApprovedCharge(shop)
  // completedOnboarding keeps its legacy meaning: "merchant finished the
  // onboarding milestone" — used to gate the pricing redirect.
  const completedOnboarding
    = shop.appConfig?.occurredEvents?.completed_onboarding || !checkShouldAutoSend(shop.appConfig)
  // intentPageShown is separate: when the merchant has been through the new
  // install intent page, the legacy auto-render (simplified_onboarding
  // wizard / CategorySelection) should skip — the intent page already
  // captured first-impression flow choice. But we MUST NOT collapse this
  // into completedOnboarding, otherwise unpaid merchants get force-redirected
  // to /pricing immediately after intent capture.
  const intentPageShown = Boolean(shop.appConfig?.onboardingIntent?.shownAt)
  const publishedFirstIntegration = shop.appConfig?.occurredEvents?.published_first_integration

  const [hydrated, setHydrated] = useState(false)
  const [onboardingModalActive, setOnboardingModalActive] = useState(false)
  const [abTestGroup] = useState<ABTestGroup>('control')
  // Sticky flag: once the merchant explicitly picks Full Editor (via intent
  // page or dropdown), we want OnboardingFlow.CategorySelection to render
  // even though `intentPageShown` would otherwise suppress it AND even
  // though the AB test would route them to Quick Setup. Sticky because the
  // dashboard's URL handler strips ?openCreateFlow=full_editor immediately,
  // so we can't rely on the URL surviving to a re-render — we observe the
  // param on first sight and remember.
  const [forceLegacyOnboarding, setForceLegacyOnboarding] = useState(false)

  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    // Check for pending onboarding publish after billing return
    if (typeof window !== 'undefined' && location.search.includes('approved=true')) {
      const pendingPublish = sessionStorage.getItem('TLK_ONBOARDING_PENDING_PUBLISH')
      if (pendingPublish) {
        try {
          const { integrationId, mockupId } = JSON.parse(pendingPublish)
          sessionStorage.removeItem('TLK_ONBOARDING_PENDING_PUBLISH')
          // Validate integrationId is a valid UUID to prevent path injection
          const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          if (!UUID_REGEX.test(integrationId)) return
          const mockupParam = mockupId ? `&mockup=${encodeURIComponent(mockupId)}` : ''
          navigate(`/personalized-products/${integrationId}?onboarding=true&billing_approved=true${mockupParam}`, {
            replace: true,
          })
          return
        } catch {
          sessionStorage.removeItem('TLK_ONBOARDING_PENDING_PUBLISH')
        }
      }
    }

    const isOnboarding = isOnboardingRoute(location.search)

    // Initialize onboarding timestamp if user hasn't completed onboarding yet
    // This ensures COMPLETE_ONBOARDING event can be tracked even when onboarding screen is disabled
    if (typeof window !== 'undefined') {
      const occurredEvents = shop.appConfig?.occurredEvents
      initOnboardingTimestamp(occurredEvents)
    }

    if (isChargeApproved || publishedFirstIntegration) {
      // User has paid or published — let them through
      setOnboardingModalActive(false)
      if (isOnboarding) {
        navigate('/dashboard')
        return
      }
    } else if (completedOnboarding) {
      // User completed/skipped onboarding but hasn't paid yet
      // Only redirect to pricing if they've exceeded the free period
      // (2+ published products or first order received)
      setOnboardingModalActive(false)
      if (!canUseFreeResources({ shopData: shop as any })) {
        navigate('/pricing', { replace: true })
        return
      }
    } else if (intentPageShown) {
      // Merchant went through the new intent page but hasn't completed the
      // legacy onboarding. Skip the auto-render and let the dashboard surface
      // its normal cards + Create dropdown. Don't push to /pricing — the
      // intent-driven destination still needs to play out.
      // Exception: an explicit ?openCreateFlow=full_editor request (from the
      // intent page or a dropdown) flips a sticky flag so CategorySelection
      // renders. Sticky so a follow-up `setSearchParams` strip doesn't make
      // this branch flip onboardingModalActive back to false.
      const params = new URLSearchParams(location.search)
      const openFullEditor = params.get('openCreateFlow') === 'full_editor'
      if (openFullEditor || forceLegacyOnboarding) {
        if (!forceLegacyOnboarding) setForceLegacyOnboarding(true)
        setOnboardingModalActive(true)
      } else {
        setOnboardingModalActive(false)
      }
    } else {
      // New merchant: inline intent discovery in SetupGuideCard is the entry
      // point. Mark intent as shown (idempotent) so subsequent visits go
      // through the intentPageShown branch and avoid re-running this logic.
      if (ACTIVE_PRODUCT_ONBOARDING_FLAG) {
        authenticatedFetch('/api/onboarding-flow-router', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'MARK_INTENT_PAGE_SHOWN' }),
        }).catch(() => {
          /* Non-fatal — inline discovery still renders */
        })
        setOnboardingModalActive(false)
      }
    }

    setHydrated(true)
  }, [
    completedOnboarding,
    intentPageShown,
    isChargeApproved,
    location.search,
    navigate,
    publishedFirstIntegration,
    shop,
    forceLegacyOnboarding,
  ])

  return {
    onboardingModalActive,
    setOnboardingModalActive,
    abTestGroup,
    hydrated,
    forceLegacyOnboarding,
    setForceLegacyOnboarding,
  }
}

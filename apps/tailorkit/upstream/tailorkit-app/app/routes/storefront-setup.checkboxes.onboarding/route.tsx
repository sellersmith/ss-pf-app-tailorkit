import { useLoaderData, useNavigate } from '@remix-run/react'
import themeHelperStyles from 'extensions/onetick-src/src/onetick.css?url'
import { useEffect, useRef } from 'react'
import { NavMenuItems } from '~/bootstrap/app-config'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { SkeletonCheckboxEdit } from '~/components/skeleton/Pages'
import withIdleTracker from '~/modules/IdleTimeTracker/withIdleTracker'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'
import { OnboardingPage } from './components'
import type { loader } from './loader.server'
import { CheckboxOnboardingProvider } from './providers/CheckboxOnboardingProvider'

// Re-export loader and action from separate files
export { action } from './action.server'
export { loader } from './loader.server'

export const links = () => [{ rel: 'stylesheet', href: themeHelperStyles }]

export function HydrateFallback() {
  return null
}

function CheckboxOnboardingRoute() {
  const loaderData = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const { trackEvent } = useEventsTracking()
  const hasTrackedStart = useRef(false)

  // Track onboarding started (only once)
  useEffect(() => {
    if (!loaderData.isOnboardingCompleted && !hasTrackedStart.current) {
      trackEvent(EVENTS_TRACKING.CHECKBOX_ONBOARDING_STARTED)
      hasTrackedStart.current = true
    }
  }, [loaderData.isOnboardingCompleted, trackEvent])

  // Redirect if onboarding is already completed
  useEffect(() => {
    if (loaderData.isOnboardingCompleted) {
      navigate(NavMenuItems.STOREFRONT_SETUP_CHECKBOXES, { replace: true })
    }
  }, [loaderData.isOnboardingCompleted, navigate])

  // Don't render if completed (will redirect)
  if (loaderData.isOnboardingCompleted) {
    return <SkeletonCheckboxEdit />
  }

  return (
    <CheckboxOnboardingProvider initialData={loaderData}>
      <OnboardingPage />
    </CheckboxOnboardingProvider>
  )
}

export default withIdleTracker(withInteractiveChat(CheckboxOnboardingRoute))

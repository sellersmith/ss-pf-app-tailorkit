import { useEffect, useRef } from 'react'
import { useLocation } from '@remix-run/react'
import { useUnifiedPublish } from '~/modules/ProductEditor/hooks/useUnifiedPublish'
import { authenticatedFetch } from '~/shopify/fns.client'
import { PREFERENCES_ACTIONS } from '~/routes/api.preferences/constants'
import { showToast } from '~/utils/toastEvents'
import { useTranslation } from 'react-i18next'
import { TOAST } from '~/constants/toasts'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { isBillingApprovedRoute } from '~/utils/shopify'

/**
 * Wait for IntegrationStore to be populated with variant data.
 * Polls every 500ms, times out after 30 seconds.
 */
function waitForIntegrationReady(): Promise<void> {
  return new Promise((resolve, reject) => {
    const maxWait = 30000
    const interval = 500
    let elapsed = 0

    const check = () => {
      const state = IntegrationStore.getState()
      if (state.variants?.length > 0 && state.variants[0]?.product) {
        resolve()
        return
      }
      elapsed += interval
      if (elapsed >= maxWait) {
        reject(new Error('Timed out waiting for integration data'))
        return
      }
      setTimeout(check, interval)
    }

    check()
  })
}

/**
 * Detects `?billing_approved=true` in the URL after Shopify billing return.
 * Waits for integration data to load, then auto-publishes and marks onboarding as complete.
 */
export function useAutoPublishOnboarding() {
  const location = useLocation()
  const { publishCurrentOnly } = useUnifiedPublish()
  const { t } = useTranslation()
  const publishedRef = useRef(false)

  useEffect(() => {
    if (publishedRef.current) return
    if (!isBillingApprovedRoute(location.search)) return

    publishedRef.current = true

    const autoPublish = async () => {
      try {
        await waitForIntegrationReady()

        await publishCurrentOnly()

        // Mark onboarding as complete
        await authenticatedFetch('/api/preferences', {
          method: 'POST',
          body: JSON.stringify({
            action: PREFERENCES_ACTIONS.UPDATE_OCCURRED_EVENT,
            eventName: 'completed_onboarding',
            value: true,
          }),
        })

        showToast(t(TOAST.UNIFIED_EDITOR.PUBLISHED))
      } catch (error) {
        console.error('[OnboardingAutoPublish] Failed to auto-publish:', error)
        publishedRef.current = false
        showToast(t('auto-publish-failed-please-publish-manually'))
      } finally {
        // Clean URL params regardless of success/failure to prevent pricing modal re-appearing
        const searchParams = new URLSearchParams(window.location.search)
        searchParams.delete('billing_approved')
        searchParams.delete('onboarding')
        const cleanSearch = searchParams.toString()
        const cleanUrl = `${window.location.pathname}${cleanSearch ? `?${cleanSearch}` : ''}`
        window.history.replaceState(null, '', cleanUrl)
      }
    }

    autoPublish()
  }, [location.search, publishCurrentOnly, t])
}

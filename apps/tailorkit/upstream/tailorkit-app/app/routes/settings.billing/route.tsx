import { useTranslation } from 'react-i18next'
import { useRootLoaderData } from '~/root'
import BillingCard from './components/render-billing-card'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { useLayoutEffect, useState } from 'react'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useLocation, useNavigate } from '@remix-run/react'
import { authenticatedFetch } from '~/shopify/fns.client'
import { PRICING_ACTION } from '~/routes/api.pricing/constants'
import { showToast } from '~/utils/toastEvents'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'
import { SettingsBillingSkeleton } from '../settings/components/SettingSkeletons'
import { TOAST } from '~/constants/toasts'

export function HydrateFallback() {
  return <SettingsBillingSkeleton />
}

export default withInteractiveChat(function BillingSetting() {
  const { t } = useTranslation()

  const location = useLocation()
  const navigate = useNavigate()

  const [delayLoad, setDelayLoad] = useState(true)

  const { shopData } = useRootLoaderData()

  const { trackEvent } = useEventsTracking()

  useLayoutEffect(() => {
    trackEvent(EVENTS_TRACKING.OPEN_SETTINGS_BILLING)
  }, [trackEvent])

  useLayoutEffect(() => {
    if (location.search.includes('redeemCouponCode')) {
      const test = location.search.match(/[?&]redeemCouponCode=([^&]+)/)

      if (test?.[1]) {
        authenticatedFetch('/api/pricing', {
          method: 'POST',
          body: JSON.stringify({
            coupon: test[1],
            action: PRICING_ACTION.REDEEM_COUPON,
          }),
        })
          .then(res => {
            if (res.success) {
              navigate('/settings/billing')
            } else {
              showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
            }
          })
          .catch(e => {
            showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
          })
          .finally(() => {
            setDelayLoad(false)
          })
      }
    } else {
      setDelayLoad(false)
    }
  }, [location.search, navigate, t])

  if (delayLoad) {
    return <SettingsBillingSkeleton />
  }

  return <BillingCard t={t} shopData={shopData} />
})

import type { ShopDocument } from '~/models/Shop'
import type { SubscriptionDocument } from '~/models/Subscription'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import { Trans, useTranslation } from 'react-i18next'
import { Banner } from '@shopify/polaris'
import { useCallback, useState } from 'react'
import { useNavigate } from '@remix-run/react'
import { isOrderBasedPlan } from '~/models/helpers/pricing-utils'

const NEW_PRICING_BANNER_NOTIFICATION_DISMISSED_SESSION_KEY = `new-pricing-banner-notification-dismissed-session`

export default function NewPricingBannerNotification(props: { shop: ShopDocument }) {
  const { shop } = props
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [isDismissed, setIsDismissed] = useState(() => {
    return sessionStorage.getItem(NEW_PRICING_BANNER_NOTIFICATION_DISMISSED_SESSION_KEY) === 'true'
  })

  const handleDismiss = useCallback(() => {
    setIsDismissed(true)
    sessionStorage.setItem(NEW_PRICING_BANNER_NOTIFICATION_DISMISSED_SESSION_KEY, 'true')
  }, [])

  // Get current plan to check capabilities (not version number)
  const subscription = shop?.subscription as SubscriptionDocument | null | undefined
  const plan = subscription?.plan as PricingPlanDocument | null | undefined

  // Only show banner for users who are actually on old V1 pricing (revenue-based plan)
  // New users with no subscription should NOT see this — they're V2 by default
  const hasV1RevenuePlan = plan && !isOrderBasedPlan(plan) && (plan.usages?.revenue?.length ?? 0) > 0
  if (isDismissed || !hasV1RevenuePlan) return null

  return (
    <Banner
      title={t('try-new-pricing-plans')}
      onDismiss={handleDismiss}
      action={{
        content: t('learn-more'),
        onAction: () => {
          navigate('/pricing')
        },
      }}
    >
      <Trans
        t={t}
        components={{
          b: <strong />,
        }}
      >
        {t(
          // eslint-disable-next-line max-len
          'You\u2019re currently using the old TailorKit pay-as-you-grow pricing plan. You can keep your current pricing or switch to <b>a new plan with 50% off for the first month</b>.'
        )}
      </Trans>
    </Banner>
  )
}

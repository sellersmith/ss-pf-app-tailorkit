import { BlockStack, Button, Card, ProgressBar, Text, Tooltip } from '@shopify/polaris'
import { XIcon } from '@shopify/polaris-icons'
import type { TFunction } from 'i18next'
import { Trans } from 'react-i18next'
import { useMemo, type ReactNode } from 'react'
import type { ShopDocument } from '~/models/Shop'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import type { SubscriptionDocument } from '~/models/Subscription'
import { getTrialUsageInfo } from '~/models/PricingPlan.fns'
import { isFirstMonthDealSubscription } from '~/constants/first-month-deal'
import { AiCreditBannerSection } from './AiCreditBannerSection'

interface UsageCardTrialProps {
  // Data source
  shop: ShopDocument | null

  // UI customization
  header?: ReactNode | null
  footer?: ReactNode | null
  progressBarSize?: 'small' | 'medium' | 'large'
  onDismiss?: () => void

  t: TFunction
}

export function UsageCardTrial(props: UsageCardTrialProps) {
  const { shop, header, footer, progressBarSize, onDismiss, t } = props

  // Calculate trial data from shop
  const trialData = useMemo(() => {
    if (!shop) return null

    const trialUsage = getTrialUsageInfo(shop)
    if (!trialUsage || trialUsage.isExpired) return null

    // Don't show if user has selected a paid plan (pending approval)
    const subscription = shop?.subscription as SubscriptionDocument | null
    const plan = subscription?.plan as PricingPlanDocument | null
    const hasPendingPaidPlan = subscription?.status === 'pending' && plan?.price > 0
    if (hasPendingPaidPlan) return null

    // Only show for order-based plans
    const currentPlan = plan
    if (!currentPlan?.usages?.orders || currentPlan.usages.orders.length === 0) {
      return null
    }

    const totalPrice = plan?.price
    const planName = plan?.name || plan?.alias || 'unknown'

    return {
      totalPrice,
      planName,
      currentDay: trialUsage.daysPassed + 1,
      totalDays: trialUsage.totalDays,
      startDate: new Date(trialUsage.trialStartDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      endDate: new Date(trialUsage.trialEndDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      freeOrdersUsed: trialUsage.freeOrdersUsed,
      freeOrdersTotal: trialUsage.freeOrdersTotal,
      aiCreditsUsed: trialUsage.aiCreditsUsed,
      aiCreditsTotal: trialUsage.aiCreditsTotal,
      isPaidPlanTrial: (plan?.price || 0) > 0,
      isFirstMonthDeal: isFirstMonthDealSubscription(subscription?.finalPrice, plan?.price),
      accumulatedDebt: trialUsage.accumulatedDebt,
      trialPausedDuration: trialUsage.trialPausedDuration,
    }
  }, [shop])

  // Don't render if no trial data
  if (!trialData) return null

  const data = trialData

  const daysProgress = (data.currentDay / data.totalDays) * 100

  return (
    <Card>
      <div style={{ position: 'relative' }}>
        <BlockStack gap="300">
          {/* Custom header */}
          {header}

          <BlockStack gap="200">
            <Text as="p" variant="headingSm">
              {t('free-14-day-trial')}
            </Text>
            <Text as="p" variant="bodyMd">
              <Trans
                t={t}
                i18nKey="b-currentday-b-of-totaldays"
                values={{
                  currentDay: data.currentDay,
                  totalDays: data.totalDays,
                }}
                components={{ b: <strong /> }}
              />
            </Text>
            <ProgressBar progress={daysProgress} tone="primary" size={progressBarSize} />
          </BlockStack>

          <Text as="p" variant="bodyMd">
            <Trans
              t={t}
              i18nKey={data.isFirstMonthDeal ? 'trial-description-with-deal' : 'trial-description'}
              values={{
                totalDays: data.totalDays,
                startDate: data.startDate,
                endDate: data.endDate,
                dealPrice: '$1.00',
                totalPrice: `$${data.totalPrice?.toFixed(2) || '0.00'}`,
                planName:
                  data.planName?.charAt(0).toUpperCase() + data.planName?.slice(1).toLowerCase() || 'Unknown Plan',
              }}
              components={{ b: <strong /> }}
            />
          </Text>

          <AiCreditBannerSection
            aiCredit={shop?.usages?.aiCredit}
            allocation={(shop?.subscription as any)?.plan?.aiCreditsPerMonth}
            fallback={footer}
          />
        </BlockStack>

        {onDismiss && (
          <div style={{ position: 'absolute', right: 0, top: 0 }}>
            <Tooltip content={t('dismiss')}>
              <Button variant="tertiary" icon={XIcon} onClick={onDismiss} />
            </Tooltip>
          </div>
        )}
      </div>
    </Card>
  )
}

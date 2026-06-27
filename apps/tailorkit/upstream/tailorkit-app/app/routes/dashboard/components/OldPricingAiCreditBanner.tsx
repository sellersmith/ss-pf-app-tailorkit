import { Banner, Bleed, BlockStack, ProgressBar, Text } from '@shopify/polaris'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MODAL_ID } from '~/constants/modal'
import { AI_CREDIT_PER_MONTH } from '~/constants/ai-assistant'
import { calculateAiCreditBalance, getAiCreditBannerState } from '~/models/helpers/ai-credit-utils'
import { isOrderBasedPlan } from '~/models/helpers/pricing-utils'
import type { ShopDocument } from '~/models/Shop'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import type { SubscriptionDocument } from '~/models/Subscription'
import { useModal } from '~/utils/hooks/useModal'

const SESSION_KEY = 'old-pricing-ai-credit-banner-dismissed'

/**
 * AI Credit warning/critical banner **exclusively for old pricing (revenue-based) users**.
 *
 * New pricing (order-based) users already have credit warnings via UsageCardTrial → AiCreditBannerSection,
 * so this component returns null for them.
 *
 * Shows:
 * - Warning (yellow) when monthly credits <= 20% remaining
 * - Critical (red) when total credits = 0
 */
export default function OldPricingAiCreditBanner({ shop }: { shop: ShopDocument | null }) {
  const { t } = useTranslation()
  const { openModal } = useModal()

  const [isDismissed, setIsDismissed] = useState(() => {
    return sessionStorage.getItem(SESSION_KEY) === 'true'
  })

  const handleDismiss = useCallback(() => {
    setIsDismissed(true)
    sessionStorage.setItem(SESSION_KEY, 'true')
  }, [])

  const handleLearnMore = useCallback(() => {
    openModal(MODAL_ID.BUY_AI_CREDITS_MODAL, { isOpen: true })
  }, [openModal])

  const subscription = shop?.subscription as SubscriptionDocument | null | undefined
  const plan = subscription?.plan as PricingPlanDocument | null | undefined
  const isNewPricing = plan && isOrderBasedPlan(plan)

  const aiCredit = shop?.usages?.aiCredit
  const allocation = plan?.aiCreditsPerMonth || AI_CREDIT_PER_MONTH

  const { bannerState, balance } = useMemo(() => {
    return {
      bannerState: getAiCreditBannerState(aiCredit, allocation),
      balance: calculateAiCreditBalance(aiCredit, allocation),
    }
  }, [aiCredit, allocation])

  // Guard: only for old pricing (revenue-based) users
  if (isNewPricing) return null
  if (bannerState === 'none' || isDismissed) return null

  const isCritical = bannerState === 'critical'
  const usageProgress = balance.monthlyAllocation > 0 ? (balance.monthlyUsage / balance.monthlyAllocation) * 100 : 0

  return (
    <Bleed marginBlockStart={'100'}>
      <Banner
        tone={isCritical ? 'critical' : 'warning'}
        title={isCritical ? t('ai-credits-exhausted') : t('ai-credits-running-low')}
        onDismiss={handleDismiss}
        action={{ content: t('learn-more'), onAction: handleLearnMore }}
      >
        <BlockStack gap="200">
          <BlockStack gap="100">
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              {t('free-ai-credits')}
            </Text>
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              {balance.monthlyUsage} {t('of')} {balance.monthlyAllocation}
            </Text>
            <ProgressBar progress={Math.min(usageProgress, 100)} tone="primary" size="small" />
          </BlockStack>
          <Text as="p" variant="bodyMd">
            {isCritical ? t('ai-credits-banner-critical-message') : t('ai-credits-banner-warning-message')}
          </Text>
        </BlockStack>
      </Banner>
    </Bleed>
  )
}

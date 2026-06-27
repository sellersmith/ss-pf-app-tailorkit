import { useCallback, useMemo } from 'react'
import { BlockStack, Box, Button, InlineGrid, InlineStack, ProgressBar, SkeletonBodyText, Text } from '@shopify/polaris'
import type { TFunction } from 'i18next'
import { useModal } from '~/utils/hooks/useModal'
import { MODAL_ID } from '~/constants/modal'
import { getAiCreditBannerState } from '~/models/helpers/ai-credit-utils'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING, EVENTS_PARAMETERS_NAME } from '~/bootstrap/constants/eventsTracking'

interface UsageStatsSectionProps {
  orders: {
    free: number
    total: number
    extra: number
  }
  aiCredits: {
    used: number
    total: number
    purchased: number
    purchasedTotal: number
    purchasedUsed: number
  }
  t: TFunction
  purchasedCreditsLoading?: boolean
  /**
   * When true, render the "Buy more credits" CTA inline with the AI credits stat.
   * Reuses getAiCreditBannerState() to decide visual emphasis (primary tone when
   * remaining ≤ 20% or fully depleted; subdued otherwise).
   */
  showBuyCreditsCta?: boolean
}

/**
 * Stats for orders + AI credits, rendered as a flat fragment so it visually
 * merges with the surrounding Card (no own background/border).
 */
export function UsageStatsSection(props: UsageStatsSectionProps) {
  const { orders, aiCredits, t, purchasedCreditsLoading = false, showBuyCreditsCta = false } = props
  const { openModal } = useModal()
  const { trackEvent } = useEventsTracking()

  const ordersProgress = orders.total > 0 ? (orders.free / orders.total) * 100 : 0
  const aiCreditsProgress = aiCredits.total > 0 ? (aiCredits.used / aiCredits.total) * 100 : 0
  // Purchased credits show usage progress in current billing cycle
  const purchasedCreditsProgress
    = aiCredits.purchasedTotal > 0 ? (aiCredits.purchasedUsed / aiCredits.purchasedTotal) * 100 : 0

  // Surface "Buy more credits" — emphasize when low / depleted
  const aiBannerState = useMemo(
    () =>
      getAiCreditBannerState({ monthlyUsage: aiCredits.used, purchasedCredits: aiCredits.purchased }, aiCredits.total),
    [aiCredits.used, aiCredits.purchased, aiCredits.total]
  )
  const lowCredits = aiBannerState !== 'none'

  const onBuyCredits = useCallback(() => {
    trackEvent(EVENTS_TRACKING.BILLING_ACTION_CLICK, {
      [EVENTS_PARAMETERS_NAME.ACTION]: 'buy_credits',
      [EVENTS_PARAMETERS_NAME.CREDIT_STATE]: aiBannerState,
    })
    openModal(MODAL_ID.BUY_AI_CREDITS_MODAL, { isOpen: true })
  }, [openModal, trackEvent, aiBannerState])

  return (
    <BlockStack gap="300">
      <InlineGrid columns={2} gap="300">
        <BlockStack gap="100">
          <Text as="p" variant="bodyMd" fontWeight="semibold">
            {t('free-orders', { num: orders.total })}
          </Text>
          <Text as="p" variant="bodyMd">
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {orders.free}
            </Text>{' '}
            {t('of')} {orders.total}
          </Text>
          <ProgressBar progress={ordersProgress} tone="primary" size="small" />
        </BlockStack>

        <BlockStack gap="100">
          <Text as="p" variant="bodyMd" fontWeight="semibold">
            {t('extra-orders')}
          </Text>
          <Text as="p" variant="bodyMd">
            {orders.extra}
          </Text>
        </BlockStack>
      </InlineGrid>

      <InlineGrid columns={2} gap="300">
        <BlockStack gap="100">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              {t('free-ai-credits')}
            </Text>
            {showBuyCreditsCta && (
              <Button variant={lowCredits ? 'primary' : 'plain'} size="micro" onClick={onBuyCredits}>
                {t('buy-more-credits')}
              </Button>
            )}
          </InlineStack>
          <Text as="p" variant="bodyMd">
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {aiCredits.used}
            </Text>{' '}
            {t('of')} {aiCredits.total}
          </Text>
          <ProgressBar progress={aiCreditsProgress} tone="primary" size="small" />
        </BlockStack>

        <BlockStack gap="100">
          <Text as="p" variant="bodyMd" fontWeight="semibold">
            {t('purchased-ai-credits')}
          </Text>
          {purchasedCreditsLoading ? (
            <Box width="80px">
              <SkeletonBodyText lines={1} />
            </Box>
          ) : (
            <>
              <Text as="p" variant="bodyMd">
                <Text as="span" variant="bodyMd" fontWeight="semibold">
                  {aiCredits.purchasedUsed}
                </Text>{' '}
                {t('of')} {aiCredits.purchasedTotal}
              </Text>
              <ProgressBar progress={purchasedCreditsProgress} tone="primary" size="small" />
            </>
          )}
        </BlockStack>
      </InlineGrid>
    </BlockStack>
  )
}

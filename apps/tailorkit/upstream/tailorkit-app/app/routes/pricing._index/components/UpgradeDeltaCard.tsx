import { useCallback } from 'react'
import { BlockStack, Box, Button, Card, Icon, InlineStack, Text } from '@shopify/polaris'
import { CheckIcon } from '@shopify/polaris-icons'
import type { TFunction } from 'i18next'
import type { PricingPlanDocument } from '~/models/PricingPlan'
import { getFreeOrdersCount } from '~/models/helpers/pricing-utils'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING, EVENTS_PARAMETERS_NAME } from '~/bootstrap/constants/eventsTracking'

interface UpgradeDeltaCardProps {
  currentPlan: PricingPlanDocument
  targetPlan: PricingPlanDocument
  onUpgrade: (planAlias: string) => void
  t: TFunction
}

/**
 * Map of feature flag → translation key shown when the flag flips off → on.
 * Order is preserved in the rendered list.
 */
const FEATURE_FLAG_LABELS: Array<{ key: keyof NonNullable<PricingPlanDocument['features']>; label: string }> = [
  { key: 'losslessSvgExport', label: 'lossless-print-files-svg-png' },
  { key: 'highResPngExport', label: 'lossless-print-files-svg-png' },
  { key: 'autoFulfillment', label: 'auto-send-files-to-print-provider' },
  { key: 'charmBuilder', label: 'charm-builder' },
  { key: 'fulfillment3rdPartyApi', label: '3rd-party-fulfillment-api' },
  { key: 'priorityFeatureRequests', label: 'priority-feature-requests' },
  { key: 'dedicatedSuccessManager', label: 'dedicated-success-manager' },
]

interface DeltaLine {
  text: string
}

function buildDelta(currentPlan: PricingPlanDocument, targetPlan: PricingPlanDocument, t: TFunction): DeltaLine[] {
  const deltas: DeltaLine[] = []

  // Included orders: positive delta only.
  const ordersDelta = getFreeOrdersCount(targetPlan) - getFreeOrdersCount(currentPlan)
  if (ordersDelta > 0) {
    deltas.push({ text: t('plus-count-included-orders-month', { count: ordersDelta }) })
  }

  // AI credits per month: positive delta only.
  const aiDelta = (targetPlan.aiCreditsPerMonth || 0) - (currentPlan.aiCreditsPerMonth || 0)
  if (aiDelta > 0) {
    deltas.push({ text: t('plus-count-ai-credits-month', { count: aiDelta }) })
  }

  // Feature flags: any that are absent/false on current and true on target.
  const seenLabels = new Set<string>()
  for (const { key, label } of FEATURE_FLAG_LABELS) {
    const currentOn = !!currentPlan.features?.[key]
    const targetOn = !!targetPlan.features?.[key]
    if (!currentOn && targetOn && !seenLabels.has(label)) {
      seenLabels.add(label)
      deltas.push({ text: t(label) })
    }
  }

  return deltas
}

/**
 * Focused upgrade card shown to subscribers below the top tier.
 * Renders only the *delta* between the current plan and the target plan —
 * not a full plan-feature grid.
 */
export function UpgradeDeltaCard(props: UpgradeDeltaCardProps) {
  const { currentPlan, targetPlan, onUpgrade, t } = props
  const { trackEvent } = useEventsTracking()
  const deltas = buildDelta(currentPlan, targetPlan, t)
  const targetAlias = targetPlan.alias || targetPlan.name

  const onCtaClick = useCallback(() => {
    trackEvent(EVENTS_TRACKING.SUBSCRIBER_UPGRADE_INTENT, {
      [EVENTS_PARAMETERS_NAME.FROM_PLAN]: currentPlan.alias || currentPlan.name,
      [EVENTS_PARAMETERS_NAME.TO_PLAN]: targetAlias,
      [EVENTS_PARAMETERS_NAME.PLAN_PRICE]: targetPlan.price || 0,
    })
    onUpgrade(targetAlias)
  }, [trackEvent, currentPlan.alias, currentPlan.name, targetAlias, targetPlan.price, onUpgrade])

  return (
    <Card>
      <BlockStack gap="400">
        <BlockStack gap="100">
          <Text as="h3" variant="headingMd">
            {t('upgrade-to-plan', { name: targetPlan.name })}
          </Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            {t('unlock-with-upgrade', { name: targetPlan.name })}
          </Text>
        </BlockStack>

        <BlockStack gap="200">
          {deltas.map((delta, idx) => (
            <InlineStack key={idx} gap="200" blockAlign="start" wrap={false}>
              <Box>
                <Icon source={CheckIcon} />
              </Box>
              <Text as="span" variant="bodyMd">
                {delta.text}
              </Text>
            </InlineStack>
          ))}
        </BlockStack>

        <Button variant="primary" tone="success" onClick={onCtaClick}>
          {t('upgrade-for-price-mo', { price: (targetPlan.price || 0).toFixed(2) })}
        </Button>
      </BlockStack>
    </Card>
  )
}
